"""Main Letterboxd scraping and matching orchestration service with stream pipelining and multi-tier caching."""

import asyncio
import time
from typing import Callable, Dict, List, Optional, Set, Tuple
from movie_match.cache.db import CacheDB
from movie_match.matcher.location import LocationMatcher
from movie_match.matcher.sentiment import SentimentPlan, rating_to_stars_text
from movie_match.models import FilmMetadata, ScanStats, SearchQuery, SentimentType, UserMatch, UserProfile
from movie_match.scraper.client import AntiBotHttpClient
from movie_match.scraper.parser import (
    extract_slug_from_input,
    parse_film_page,
    parse_user_profile_page,
    parse_users_from_rating_or_like_page,
    parse_users_from_reviews_page,
)


class LetterboxdScraper:
    """High-performance scraper and matcher for Letterboxd movies and users with multi-tier caching."""

    def __init__(
        self,
        client: Optional[AntiBotHttpClient] = None,
        cache: Optional[CacheDB] = None,
        concurrency: int = 15,
    ):
        self.client = client or AntiBotHttpClient(concurrency=concurrency)
        self.cache = cache or CacheDB()
        self._owns_client = client is None

    async def __aenter__(self):
        await self.client.start()
        await self.cache.init()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._owns_client:
            await self.client.close()
        await self.cache.close()

    async def get_film_info(self, film_slug_or_url: str) -> FilmMetadata:
        """Fetch and cache film metadata."""
        slug = extract_slug_from_input(film_slug_or_url)
        cached = await self.cache.get_film_metadata(slug)
        if cached:
            return cached

        url = f"https://letterboxd.com/film/{slug}/"
        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            return FilmMetadata(slug=slug, title=slug.replace("-", " ").title(), url=url)

        meta = parse_film_page(resp.text, slug)
        await self.cache.save_film_metadata(meta)
        return meta

    async def fetch_user_profile(self, username: str) -> Optional[UserProfile]:
        """Fetch a user profile with multi-tier cache lookup."""
        cached = await self.cache.get_user_profile(username)
        if cached:
            return cached

        url = f"https://letterboxd.com/{username.lower()}/"
        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            return None

        profile = parse_user_profile_page(resp.text, username)
        await self.cache.save_user_profile(profile)
        return profile

    async def find_users(
        self,
        query: SearchQuery,
        progress_callback: Optional[Callable[[str, int, int, int], None]] = None,
    ) -> Tuple[List[UserMatch], ScanStats]:
        """
        Search for users matching target location and sentiment with stream pipelining and multi-tier caching.
        """
        start_time = time.time()
        slug = extract_slug_from_input(query.film_input)
        film_meta = await self.get_film_info(slug)

        matcher = LocationMatcher(query.location_query, include_bio=query.include_bio)
        sentiment_plan = SentimentPlan(query.sentiment, query.rating_range)
        endpoints = sentiment_plan.get_film_endpoints(slug)

        stats = ScanStats(
            film_title=film_meta.title or slug,
            film_slug=slug,
        )

        matches: List[UserMatch] = []
        matched_usernames: Set[str] = set()
        evaluated_usernames: Set[str] = set()
        total_discovered = 0

        # Process endpoints page by page with stream pipelining
        for endpoint_suffix, desc in endpoints:
            if len(matches) >= query.limit_matches:
                break

            for page in range(1, query.max_pages + 1):
                if len(matches) >= query.limit_matches:
                    break

                # 1. Check film page cache first
                items = await self.cache.get_film_page(slug, endpoint_suffix, page)
                if items is None:
                    url = (
                        f"https://letterboxd.com/{endpoint_suffix}page/{page}/"
                        if page > 1
                        else f"https://letterboxd.com/{endpoint_suffix}"
                    )
                    resp = await self.client.get(url)
                    stats.total_pages_scanned += 1
                    if not resp or resp.status_code != 200:
                        break

                    if "reviews" in endpoint_suffix:
                        items = parse_users_from_reviews_page(resp.text)
                    else:
                        items = parse_users_from_rating_or_like_page(resp.text)

                    if not items:
                        break

                    # Save to interaction page cache
                    await self.cache.save_film_page(slug, endpoint_suffix, page, items)
                else:
                    stats.total_pages_scanned += 1

                if not items:
                    break

                # Candidate map for this page
                page_candidates: Dict[str, Dict] = {}
                for item in items:
                    u = item["username"]
                    if u not in evaluated_usernames:
                        page_candidates[u] = {
                            "username": u,
                            "user_rating": item.get("user_rating"),
                            "user_rating_stars": item.get("user_rating_stars", ""),
                            "user_liked": item.get("user_liked"),
                            "user_review": item.get("user_review"),
                            "found_via": desc,
                        }
                        evaluated_usernames.add(u)

                total_discovered += len(page_candidates)
                stats.total_users_discovered = len(evaluated_usernames)

                if not page_candidates:
                    continue

                # Batch check SQLite L1/L2 cache for profiles
                page_usernames = list(page_candidates.keys())
                cached_profiles = await self.cache.get_user_profiles_batch(page_usernames)
                stats.cache_hits += len(cached_profiles)

                uncached_usernames = [u for u in page_usernames if u not in cached_profiles]

                # Evaluate cached profiles immediately
                for u, profile in cached_profiles.items():
                    if u in matched_usernames:
                        continue
                    is_match, fields, matched_text = matcher.match(profile.location, profile.bio)
                    if is_match:
                        matched_usernames.add(u)
                        cand = page_candidates[u]
                        matches.append(
                            UserMatch(
                                username=profile.username,
                                display_name=profile.display_name or profile.username,
                                location=profile.location,
                                bio=profile.bio,
                                avatar_url=profile.avatar_url,
                                profile_url=profile.profile_url,
                                matched_location=matched_text,
                                matched_fields=fields,
                                sentiment_type=query.sentiment,
                                user_rating=cand.get("user_rating"),
                                user_rating_stars=cand.get("user_rating_stars", ""),
                                user_liked=cand.get("user_liked"),
                                user_review=cand.get("user_review"),
                                found_via=cand.get("found_via", ""),
                            )
                        )
                        stats.matches_count = len(matches)
                        if len(matches) >= query.limit_matches:
                            break

                if len(matches) >= query.limit_matches:
                    break

                # Fetch uncached profiles concurrently in batches
                batch_size = 25
                for i in range(0, len(uncached_usernames), batch_size):
                    chunk = uncached_usernames[i : i + batch_size]

                    async def fetch_one(u_name: str) -> Optional[UserProfile]:
                        url = f"https://letterboxd.com/{u_name}/"
                        r = await self.client.get(url)
                        if not r or r.status_code != 200:
                            return None
                        return parse_user_profile_page(r.text, u_name)

                    tasks = [fetch_one(u) for u in chunk]
                    fetched_profiles = await asyncio.gather(*tasks)

                    # Save newly fetched batch atomically in SQLite
                    valid_profiles = [p for p in fetched_profiles if p is not None]
                    if valid_profiles:
                        await self.cache.save_user_profiles_batch(valid_profiles)

                    stats.profiles_fetched += len(chunk)

                    # Evaluate matches for this batch
                    for p in valid_profiles:
                        if p.username in matched_usernames:
                            continue
                        is_match, fields, matched_text = matcher.match(p.location, p.bio)
                        if is_match:
                            matched_usernames.add(p.username)
                            cand = page_candidates[p.username]
                            matches.append(
                                UserMatch(
                                    username=p.username,
                                    display_name=p.display_name or p.username,
                                    location=p.location,
                                    bio=p.bio,
                                    avatar_url=p.avatar_url,
                                    profile_url=p.profile_url,
                                    matched_location=matched_text,
                                    matched_fields=fields,
                                    sentiment_type=query.sentiment,
                                    user_rating=cand.get("user_rating"),
                                    user_rating_stars=cand.get("user_rating_stars", ""),
                                    user_liked=cand.get("user_liked"),
                                    user_review=cand.get("user_review"),
                                    found_via=cand.get("found_via", ""),
                                )
                            )
                            stats.matches_count = len(matches)
                            if len(matches) >= query.limit_matches:
                                break

                    if progress_callback:
                        progress_callback(
                            f"Streaming {desc} (Page {page})",
                            stats.total_pages_scanned,
                            stats.total_users_discovered,
                            stats.matches_count,
                        )

                    if len(matches) >= query.limit_matches:
                        break

        stats.elapsed_seconds = time.time() - start_time
        return matches, stats
