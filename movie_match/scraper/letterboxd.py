"""Main Letterboxd scraping and matching orchestration service with stream pipelining and multi-tier caching."""

import asyncio
import time
from typing import Callable, Dict, List, Optional, Set, Tuple
from movie_match.cache.db import CacheDB
from movie_match.matcher.location import LocationMatcher
from movie_match.matcher.sentiment import SentimentPlan, rating_to_stars_text
from movie_match.models import (
    FilmInteraction,
    FilmMetadata,
    MultiFilmMatchQuery,
    ScanStats,
    SearchQuery,
    SentimentType,
    TasteMatchResult,
    UserFilmItem,
    UserMatch,
    UserProfile,
    UserProfileDetail,
)
from movie_match.scraper.client import AntiBotHttpClient
from movie_match.scraper.parser import (
    extract_slug_from_input,
    parse_film_page,
    parse_user_films_page,
    parse_user_profile_detail,
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

    async def get_user_full_profile(self, username: str, include_films: bool = True) -> Optional[UserProfileDetail]:
        """Fetch full user profile, stats, favorite films, and recent/top-rated films."""
        clean_user = username.strip().lower().lstrip("@")
        cached = await self.cache.get_user_profile_detail(clean_user)
        if cached:
            return cached

        url = f"https://letterboxd.com/{clean_user}/"
        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            return None

        profile = parse_user_profile_detail(resp.text, clean_user)

        if profile.favorite_films:
            async def resolve_poster(film_item: UserFilmItem):
                if not film_item.poster_url or "empty-poster" in film_item.poster_url:
                    meta = await self.get_film_info(film_item.slug)
                    if meta.poster_url:
                        film_item.poster_url = meta.poster_url

            await asyncio.gather(*[resolve_poster(f) for f in profile.favorite_films])

        if include_films:
            # Fetch recent films from page 1 of /films/
            recent_films = await self.get_user_films_category(clean_user, "films", page=1)
            profile.recent_films = recent_films[:24]

            # Top rated films from recent or /films/by/rating/
            top_films = [f for f in recent_films if f.user_rating and f.user_rating >= 4.0]
            if not top_films:
                top_films = await self.get_user_films_category(clean_user, "top_rated", page=1)
            profile.top_rated_films = top_films[:24]

            # Liked films from recent or /likes/films/
            liked_films = [f for f in recent_films if f.user_liked]
            if not liked_films:
                liked_films = await self.get_user_films_category(clean_user, "likes", page=1)
            profile.liked_films = liked_films[:24]

        await self.cache.save_user_profile_detail(profile)
        return profile

    async def get_user_films_category(
        self,
        username: str,
        category: str = "films",
        page: int = 1,
    ) -> List[UserFilmItem]:
        """Fetch user films by category (films, top_rated, likes, watchlist)."""
        clean_user = username.strip().lower().lstrip("@")
        cached = await self.cache.get_user_films(clean_user, category, page)
        if cached is not None:
            return cached

        if category == "top_rated":
            url = (
                f"https://letterboxd.com/{clean_user}/films/by/rating/page/{page}/"
                if page > 1
                else f"https://letterboxd.com/{clean_user}/films/by/rating/"
            )
        elif category == "watchlist":
            url = (
                f"https://letterboxd.com/{clean_user}/watchlist/page/{page}/"
                if page > 1
                else f"https://letterboxd.com/{clean_user}/watchlist/"
            )
        elif category == "likes":
            url = (
                f"https://letterboxd.com/{clean_user}/likes/films/page/{page}/"
                if page > 1
                else f"https://letterboxd.com/{clean_user}/likes/films/"
            )
        else:
            url = (
                f"https://letterboxd.com/{clean_user}/films/page/{page}/"
                if page > 1
                else f"https://letterboxd.com/{clean_user}/films/"
            )

        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            if category == "likes":
                # Fallback to watched films with user_liked == True
                watched = await self.get_user_films_category(clean_user, "films", page=page)
                liked = [f for f in watched if f.user_liked]
                await self.cache.save_user_films(clean_user, category, page, liked)
                return liked
            return []

        films = parse_user_films_page(resp.text)
        await self.cache.save_user_films(clean_user, category, page, films)
        return films

    async def find_taste_matches(
        self,
        query: MultiFilmMatchQuery,
        progress_callback: Optional[Callable[[str, int, int, int], None]] = None,
    ) -> Tuple[List[TasteMatchResult], ScanStats]:
        """
        Search for users matching multiple target films in the specified location with Taste Compatibility score.
        """
        start_time = time.time()
        clean_slugs = [extract_slug_from_input(f) for f in query.films if f.strip()]
        if not clean_slugs:
            return [], ScanStats()

        matcher = LocationMatcher(query.location_query, include_bio=query.include_bio)
        sentiment_plan = SentimentPlan(query.sentiment, query.rating_range)

        stats = ScanStats(
            film_title=", ".join(clean_slugs[:3]),
            film_slug=clean_slugs[0] if clean_slugs else "",
        )

        user_film_interactions: Dict[str, List[FilmInteraction]] = {}
        user_profile_cache: Dict[str, Tuple[UserProfile, str, List[str]]] = {}
        all_evaluated_usernames: Set[str] = set()

        for film_idx, slug in enumerate(clean_slugs, 1):
            film_meta = await self.get_film_info(slug)
            film_title = film_meta.title or slug.replace("-", " ").title()
            endpoints = sentiment_plan.get_film_endpoints(slug)[:2]

            for endpoint_suffix, desc in endpoints:
                for page in range(1, query.max_pages_per_film + 1):
                    # Check cache first
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

                        await self.cache.save_film_page(slug, endpoint_suffix, page, items)
                    else:
                        stats.total_pages_scanned += 1

                    if not items:
                        break

                    page_candidates: Dict[str, Dict] = {}
                    for item in items:
                        u = item["username"]
                        page_candidates[u] = {
                            "username": u,
                            "user_rating": item.get("user_rating"),
                            "user_rating_stars": item.get("user_rating_stars", ""),
                            "user_liked": item.get("user_liked"),
                            "user_review": item.get("user_review"),
                            "found_via": desc,
                        }
                        all_evaluated_usernames.add(u)

                    stats.total_users_discovered = len(all_evaluated_usernames)
                    if not page_candidates:
                        continue

                    # Batch check SQLite L1/L2 cache
                    page_usernames = list(page_candidates.keys())
                    cached_profiles = await self.cache.get_user_profiles_batch(page_usernames)
                    stats.cache_hits += len(cached_profiles)

                    uncached_usernames = [u for u in page_usernames if u not in cached_profiles]

                    # Process cached profiles
                    for u, profile in cached_profiles.items():
                        is_match, fields, matched_text = matcher.match(profile.location, profile.bio)
                        if is_match:
                            user_profile_cache[u] = (profile, matched_text, fields)
                            if u not in user_film_interactions:
                                user_film_interactions[u] = []
                            cand = page_candidates[u]
                            # Avoid duplicate interaction entries for the same film
                            if not any(i.film_slug == slug for i in user_film_interactions[u]):
                                user_film_interactions[u].append(
                                    FilmInteraction(
                                        film_slug=slug,
                                        film_title=film_title,
                                        user_rating=cand.get("user_rating"),
                                        user_rating_stars=cand.get("user_rating_stars", ""),
                                        user_liked=cand.get("user_liked"),
                                        user_review=cand.get("user_review"),
                                        found_via=cand.get("found_via", ""),
                                    )
                                )

                    # Fetch uncached profiles concurrently in chunks
                    batch_size = 25
                    for i in range(0, len(uncached_usernames), batch_size):
                        chunk = uncached_usernames[i : i + batch_size]

                        async def fetch_one(u_name: str) -> Optional[UserProfile]:
                            u_url = f"https://letterboxd.com/{u_name}/"
                            r = await self.client.get(u_url)
                            if not r or r.status_code != 200:
                                return None
                            return parse_user_profile_page(r.text, u_name)

                        tasks = [fetch_one(u) for u in chunk]
                        fetched_profiles = await asyncio.gather(*tasks)
                        valid_profiles = [p for p in fetched_profiles if p is not None]
                        if valid_profiles:
                            await self.cache.save_user_profiles_batch(valid_profiles)

                        stats.profiles_fetched += len(chunk)

                        for p in valid_profiles:
                            is_match, fields, matched_text = matcher.match(p.location, p.bio)
                            if is_match:
                                user_profile_cache[p.username] = (p, matched_text, fields)
                                if p.username not in user_film_interactions:
                                    user_film_interactions[p.username] = []
                                cand = page_candidates[p.username]
                                if not any(i.film_slug == slug for i in user_film_interactions[p.username]):
                                    user_film_interactions[p.username].append(
                                        FilmInteraction(
                                            film_slug=slug,
                                            film_title=film_title,
                                            user_rating=cand.get("user_rating"),
                                            user_rating_stars=cand.get("user_rating_stars", ""),
                                            user_liked=cand.get("user_liked"),
                                            user_review=cand.get("user_review"),
                                            found_via=cand.get("found_via", ""),
                                        )
                                    )

                    if progress_callback:
                        progress_callback(
                            f"Scouting film {film_idx}/{len(clean_slugs)} ({slug}) - Page {page}",
                            stats.total_pages_scanned,
                            stats.total_users_discovered,
                            len([u for u, ints in user_film_interactions.items() if len(ints) >= query.min_shared_films]),
                        )

        # Assemble and rank taste match results
        results: List[TasteMatchResult] = []
        total_films_count = len(clean_slugs)

        for u, interactions in user_film_interactions.items():
            if len(interactions) >= query.min_shared_films and u in user_profile_cache:
                p, matched_text, fields = user_profile_cache[u]
                shared_count = len(interactions)
                score = round((shared_count / total_films_count) * 100, 1)
                results.append(
                    TasteMatchResult(
                        username=p.username,
                        display_name=p.display_name or p.username,
                        location=p.location,
                        bio=p.bio,
                        avatar_url=p.avatar_url,
                        profile_url=p.profile_url,
                        matched_location=matched_text,
                        matched_fields=fields,
                        shared_films=interactions,
                        shared_films_count=shared_count,
                        compatibility_score=score,
                        total_target_films=total_films_count,
                    )
                )

        # Sort by shared films count descending, then compatibility score descending
        results.sort(key=lambda r: (r.shared_films_count, r.compatibility_score), reverse=True)
        stats.matches_count = len(results)
        stats.elapsed_seconds = time.time() - start_time

        return results[:query.limit_matches], stats

