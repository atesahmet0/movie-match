"""Main Letterboxd scraping and matching orchestration service with stream pipelining and multi-tier caching."""

import asyncio
import os
import time
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from movie_match.cache.db import CacheDB
from movie_match.logging import debug_tracker, get_logger
from movie_match.matcher.fingerprint import TasteFingerprint, build_fingerprint
from movie_match.matcher.location import LocationMatcher
from movie_match.matcher.scoring import FilmSignals, compute_compatibility_score
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

logger = get_logger("scraper")

FILM_SEARCH_CACHE_TTL = 10 * 60
FILM_SEARCH_EMPTY_TTL = 60
FILM_SEARCH_CACHE_SIZE = 256


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
        # Autocomplete traffic is highly repetitive. Keep the parsed result set in
        # process and let identical concurrent requests share one upstream fetch.
        self._film_search_cache: OrderedDict[str, Tuple[float, List[Dict[str, Any]]]] = OrderedDict()
        self._film_search_inflight: Dict[str, asyncio.Task[List[Dict[str, Any]]]] = {}

    async def __aenter__(self):
        await self.client.start()
        try:
            await self.cache.init()
        except Exception:
            if self._owns_client:
                await self.client.close()
            raise
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._owns_client:
            await self.client.close()
        await self.cache.close()

    async def get_film_info(self, film_slug_or_url: str, strict: bool = False) -> Optional[FilmMetadata]:
        """Fetch and cache film metadata."""
        slug = extract_slug_from_input(film_slug_or_url)
        cached = await self.cache.get_film_metadata(slug)
        if cached:
            return cached

        url = f"https://letterboxd.com/film/{slug}/"
        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            if strict:
                return None
            return FilmMetadata(slug=slug, title=slug.replace("-", " ").title(), url=url)

        meta = parse_film_page(resp.text, slug)
        await self.cache.save_film_metadata(meta)
        return meta

    async def fetch_user_profile(self, username: str, force_refresh: bool = False) -> Optional[UserProfile]:
        """Fetch a user profile with multi-tier cache lookup."""
        if not force_refresh:
            cached = await self.cache.get_user_profile(username)
            if cached and cached.favorite_films:
                return cached
            if cached:
                cached_detail = await self.cache.get_user_profile_detail(username)
                if cached_detail and cached_detail.favorite_films:
                    cached.favorite_films = cached_detail.favorite_films
                    await self.cache.save_user_profile(cached)
                    return cached

        url = f"https://letterboxd.com/{username.lower()}/"
        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            if not force_refresh:
                cached = await self.cache.get_user_profile(username)
                if cached:
                    return cached
            return None

        profile = parse_user_profile_page(resp.text, username)
        await self.cache.save_user_profile(profile)
        return profile

    async def find_users(
        self,
        query: SearchQuery,
        progress_callback: Optional[Callable[[str, int, int, int], None]] = None,
        result_callback: Optional[Callable[[UserMatch], None]] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Tuple[List[UserMatch], ScanStats]:
        """
        Search for users matching target location and sentiment with stream pipelining and multi-tier caching.
        """
        start_time = time.time()
        http_requests_at_start = debug_tracker.http_requests_total
        slug = extract_slug_from_input(query.film_input)
        film_meta = await self.get_film_info(slug)
        film_title = film_meta.title or slug.replace("-", " ").title()

        matcher = LocationMatcher(query.location_query, include_bio=query.include_bio)
        sentiment_plan = SentimentPlan(query.sentiment, query.rating_range)
        endpoints = sentiment_plan.get_film_endpoints(slug)

        # Resolve source username for self-exclusion
        source_user_lower: Optional[str] = None
        if query.source_username:
            source_user_lower = query.source_username.strip().lower().lstrip("@") or None

        logger.info(
            f"🔍 Starting user search: film='{slug}' ({film_title}), location='{query.location_query}', "
            f"sentiment='{query.sentiment.value}', max_pages={query.max_pages}, limit={query.limit_matches}"
        )

        stats = ScanStats(
            film_title=film_title,
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
                if cancel_event and cancel_event.is_set():
                    raise asyncio.CancelledError
                if len(matches) >= query.limit_matches:
                    break

                logger.debug(f"[Scraper] Scanning endpoint '{endpoint_suffix}' ({desc}) - Page {page}/{query.max_pages}")

                # 1. Check film page cache first
                cache_started = time.monotonic()
                items = await self.cache.get_film_page(slug, endpoint_suffix, page)
                stats.cache_lookup_seconds += time.monotonic() - cache_started
                if items is None:
                    url = (
                        f"https://letterboxd.com/{endpoint_suffix}page/{page}/"
                        if page > 1
                        else f"https://letterboxd.com/{endpoint_suffix}"
                    )
                    resp = await self.client.get(url)
                    stats.total_pages_scanned += 1
                    if not resp or resp.status_code != 200:
                        logger.debug(f"[Scraper] Endpoint '{endpoint_suffix}' returned status {resp.status_code if resp else 'None'} on page {page} - stopping pagination")
                        break

                    parse_started = time.monotonic()
                    if "reviews" in endpoint_suffix:
                        items = parse_users_from_reviews_page(resp.text)
                    else:
                        items = parse_users_from_rating_or_like_page(resp.text)
                    stats.parse_seconds += time.monotonic() - parse_started

                    if not items:
                        logger.debug(f"[Scraper] No users parsed from '{url}' - stopping pagination")
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
                    if source_user_lower and u.lower() == source_user_lower:
                        continue
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
                logger.debug(f"[Scraper] Discovered {len(page_candidates)} new candidate users on page {page} (total: {stats.total_users_discovered})")

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
                    debug_tracker.record_profile_eval(is_match)
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
                        if stats.time_to_first_result is None:
                            stats.time_to_first_result = time.time() - start_time
                        if result_callback:
                            result_callback(matches[-1])
                        stats.matches_count = len(matches)
                        logger.info(f"[green]✨ Match found:[/green] @{profile.username} ({profile.display_name}) in '{matched_text}' [dim]({len(matches)}/{query.limit_matches})[/dim]")
                        if len(matches) >= query.limit_matches:
                            logger.info(f"Target match limit reached ({query.limit_matches} matches)")
                            break
                    else:
                        logger.debug(f"[dim]No match: @{profile.username} (loc='{profile.location}')[/dim]")

                if len(matches) >= query.limit_matches:
                    break

                # Fetch uncached profiles concurrently in batches
                # For an Anywhere search every valid profile is a match, so avoid
                # fetching more profiles than the remaining result slots. Narrow
                # location searches keep wider batches to preserve throughput.
                batch_size = (
                    max(1, query.limit_matches - len(matches))
                    if matcher.is_anywhere
                    else 25
                )
                for i in range(0, len(uncached_usernames), batch_size):
                    if cancel_event and cancel_event.is_set():
                        raise asyncio.CancelledError
                    chunk = uncached_usernames[i : i + batch_size]
                    logger.debug(f"[Scraper] Fetching {len(chunk)} uncached profiles concurrently (batch {i // batch_size + 1})...")

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
                        debug_tracker.record_profile_eval(is_match)
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
                            if stats.time_to_first_result is None:
                                stats.time_to_first_result = time.time() - start_time
                            if result_callback:
                                result_callback(matches[-1])
                            stats.matches_count = len(matches)
                            logger.info(f"[green]✨ Match found:[/green] @{p.username} ({p.display_name}) in '{matched_text}' [dim]({len(matches)}/{query.limit_matches})[/dim]")
                            if len(matches) >= query.limit_matches:
                                logger.info(f"Target match limit reached ({query.limit_matches} matches)")
                                break
                        else:
                            logger.debug(f"[dim]No match: @{p.username} (loc='{p.location}')[/dim]")

                    if progress_callback:
                        film_display = film_title or query.film_input
                        progress_callback(
                            f"Discovering cinephiles who loved {film_display}...",
                            stats.total_pages_scanned,
                            stats.total_users_discovered,
                            stats.matches_count,
                        )

                    if len(matches) >= query.limit_matches:
                        break

        stats.elapsed_seconds = time.time() - start_time
        stats.upstream_requests = debug_tracker.http_requests_total - http_requests_at_start
        logger.info(
            f"🏁 User search finished in {stats.elapsed_seconds:.2f}s: {len(matches)} matches found "
            f"from {stats.total_users_discovered} candidates ({stats.total_pages_scanned} pages scanned)"
        )
        return matches, stats


    async def resolve_film_poster(self, film_item: UserFilmItem) -> None:
        """Resolve film poster URL from film page metadata if missing."""
        if not film_item.poster_url or "empty-poster" in film_item.poster_url:
            try:
                meta = await self.get_film_info(film_item.slug)
                if meta.poster_url:
                    film_item.poster_url = meta.poster_url
            except Exception:
                pass

    async def resolve_posters_batch(self, films: List[UserFilmItem], limit: int = 36) -> None:
        """Concurrently resolve posters for a list of film items."""
        to_resolve = [f for f in films[:limit] if not f.poster_url or "empty-poster" in f.poster_url]
        if to_resolve:
            await asyncio.gather(*[self.resolve_film_poster(f) for f in to_resolve])

    async def get_user_full_profile(self, username: str, include_films: bool = True) -> Optional[UserProfileDetail]:
        """Fetch full user profile, stats, favorite films, and recent/top-rated films."""
        clean_user = username.strip().lower().lstrip("@")
        cached = await self.cache.get_user_profile_detail(clean_user)
        if cached:
            return cached

        url = f"https://letterboxd.com/{clean_user}/"
        resp = await self.client.get(url)
        if not resp or resp.status_code != 200:
            # Fallback to basic profile in user_profiles cache if available
            fallback = await self.cache.get_user_profile(clean_user)
            if fallback:
                return UserProfileDetail(
                    username=fallback.username,
                    display_name=fallback.display_name,
                    location=fallback.location,
                    bio=fallback.bio,
                    avatar_url=fallback.avatar_url,
                    profile_url=fallback.profile_url,
                    is_pro=fallback.is_pro,
                    is_patron=fallback.is_patron,
                    favorite_films=fallback.favorite_films or [],
                    stats={},
                )
            return None

        profile = parse_user_profile_detail(resp.text, clean_user)

        if profile.favorite_films:
            try:
                await self.resolve_posters_batch(profile.favorite_films, limit=4)
            except Exception:
                pass

        if include_films:
            try:
                # /films/ carries recent activity, /films/by/rating/ carries this
                # member's actual highest-rated films. Deriving "top rated" from
                # the recent page alone left the rating pool one page deep, which
                # is what starves the correlation signal downstream. Both pages
                # are cached and independent, so fetch them together.
                recent_films, rated_films = await asyncio.gather(
                    self.get_user_films_category(clean_user, "films", page=1, resolve_posters=False),
                    self.get_user_films_category(clean_user, "top_rated", page=1, resolve_posters=False),
                    return_exceptions=True,
                )
                if isinstance(recent_films, BaseException):
                    recent_films = []
                if isinstance(rated_films, BaseException):
                    rated_films = []

                profile.recent_films = recent_films[:24]

                # Top rated: the real ranked page first, recent high scorers after
                top_films = [f for f in rated_films if f.user_rating and f.user_rating >= 4.0]
                seen_top = {f.slug for f in top_films}
                top_films.extend(
                    f for f in recent_films
                    if f.user_rating and f.user_rating >= 4.0 and f.slug not in seen_top
                )
                profile.top_rated_films = top_films[:24]

                # Liked films from recent or /likes/films/
                liked_films = [f for f in recent_films if f.user_liked]
                if not liked_films:
                    liked_films = await self.get_user_films_category(clean_user, "likes", page=1, resolve_posters=False)
                profile.liked_films = liked_films[:24]

                # Pinned favorites are parsed from the profile poster row, which
                # carries no rating markup — so the strongest tier arrives
                # unrated and can never contribute a correlation pair. Backfill
                # from the rated pages we already have in hand.
                if profile.favorite_films:
                    ratings_by_slug = {
                        f.slug: f.user_rating
                        for f in list(rated_films) + list(recent_films)
                        if f.slug and f.user_rating
                    }
                    for fav in profile.favorite_films:
                        if fav.user_rating is None and fav.slug in ratings_by_slug:
                            fav.user_rating = ratings_by_slug[fav.slug]
                            fav.user_rating_stars = rating_to_stars_text(fav.user_rating)
            except Exception:
                pass

        try:
            await self.cache.save_user_profile_detail(profile)
        except Exception:
            pass

        return profile

    async def get_user_films_category(
        self,
        username: str,
        category: str = "films",
        page: int = 1,
        resolve_posters: bool = True,
    ) -> List[UserFilmItem]:
        """Fetch user films by category (films, top_rated, likes, watchlist)."""
        clean_user = username.strip().lower().lstrip("@")
        cached = await self.cache.get_user_films(clean_user, category, page)
        if cached is not None:
            if resolve_posters:
                needs_resolve = [f for f in cached[:36] if not f.poster_url or "empty-poster" in f.poster_url]
                if needs_resolve:
                    await self.resolve_posters_batch(needs_resolve)
                    await self.cache.save_user_films(clean_user, category, page, cached)
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
                watched = await self.get_user_films_category(clean_user, "films", page=page, resolve_posters=resolve_posters)
                liked = [f for f in watched if f.user_liked]
                await self.cache.save_user_films(clean_user, category, page, liked)
                return liked
            return []

        films = parse_user_films_page(resp.text)
        if resolve_posters and films:
            await self.resolve_posters_batch(films[:36])
        await self.cache.save_user_films(clean_user, category, page, films)
        return films
    @staticmethod
    def _cross_check_favorites(
        username: str,
        favorite_films: List[UserFilmItem],
        target_slugs: List[str],
        film_title_map: Dict[str, str],
        interactions: List[FilmInteraction],
    ) -> None:
        """Cross-check a user's pinned favorites against target film slugs.

        Appends FilmInteraction entries for any matching favorites not already recorded.
        Uses is_favorite=True and preserves the user's actual rating (None if unknown)
        instead of fabricating a 5★ rating.
        """
        if not favorite_films:
            return
        for fav in favorite_films:
            if fav.slug in target_slugs:
                if not any(i.film_slug == fav.slug for i in interactions):
                    interactions.append(
                        FilmInteraction(
                            film_slug=fav.slug,
                            film_title=fav.title or film_title_map.get(
                                fav.slug, fav.slug.replace("-", " ").title()
                            ),
                            user_rating=fav.user_rating,
                            user_rating_stars=fav.user_rating_stars or "",
                            user_liked=True,
                            found_via="Pinned Favorite",
                            is_favorite=True,
                        )
                    )
                else:
                    # Mark existing interaction as favorite if found
                    for i in interactions:
                        if i.film_slug == fav.slug:
                            i.is_favorite = True
                            break

    async def find_taste_matches(
        self,
        query: MultiFilmMatchQuery,
        progress_callback: Optional[Callable[[str, int, int, int], None]] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Tuple[List[TasteMatchResult], ScanStats]:
        """
        Search for users matching multiple target films in the specified location with Taste Compatibility score.

        The explicitly requested films are always the candidate-discovery set. When a
        source username is provided, its expanded fingerprint is used only as bounded
        scoring evidence after candidates have been discovered.
        """
        start_time = time.time()
        http_requests_at_start = debug_tracker.http_requests_total
        discovery_slugs = list(dict.fromkeys(extract_slug_from_input(f) for f in query.films if f.strip()))
        if not discovery_slugs:
            return [], ScanStats()

        logger.info(
            f"🎯 Starting taste match: {len(discovery_slugs)} films, location='{query.location_query}', "
            f"min_shared={query.min_shared_films}, limit={query.limit_matches}"
        )

        stats = ScanStats(
            film_title=", ".join(discovery_slugs[:3]),
            film_slug=discovery_slugs[0],
        )
        deadline = time.monotonic() + max(
            5.0, float(os.getenv("SEARCH_MAX_SECONDS", "180"))
        )
        # Sized against what the session pool can actually deliver in the time
        # budget: ~24 concurrent requests at roughly a second each is ~20/s, so
        # 180s is on the order of 3-4k requests. Set these below that and they,
        # not the clock, silently become the limit.
        request_budget = max(25, int(os.getenv("SEARCH_MAX_UPSTREAM_REQUESTS", "4000")))
        profile_budget = max(25, int(os.getenv("SEARCH_MAX_PROFILE_FETCHES", "2500")))
        # The scan hunts for one convincing match rather than a wide pool: it
        # stops the moment a candidate clears this bar, and otherwise spends the
        # full budget looking for one, returning the best of what it found.
        #
        # Quality and evidence are gated separately rather than through the
        # shrunk ranking score. Shrinkage caps what a thin match can reach, so a
        # single bar on it would be unreachable on small film sets and every
        # search would burn the whole budget.
        strong_match_score = float(os.getenv("SEARCH_STRONG_MATCH_SCORE", "85"))
        strong_match_confidence = float(os.getenv("SEARCH_STRONG_MATCH_CONFIDENCE", "0.6"))
        strong_match_min_shared = max(
            query.min_shared_films, int(os.getenv("SEARCH_STRONG_MATCH_MIN_SHARED", "2"))
        )

        def _budget_reason() -> Optional[str]:
            if cancel_event and cancel_event.is_set():
                raise asyncio.CancelledError
            if time.monotonic() >= deadline:
                return "time_budget"
            if debug_tracker.http_requests_total - http_requests_at_start >= request_budget:
                return "request_budget"
            if stats.profiles_fetched >= profile_budget:
                return "profile_budget"
            return None

        def _stop_for_budget() -> bool:
            reason = _budget_reason()
            if reason is None:
                return False
            stats.partial = True
            stats.stop_reason = reason
            return True

        # Resolve source username for self-exclusion
        source_user_lower: Optional[str] = None
        if query.source_username:
            source_user_lower = query.source_username.strip().lower().lstrip("@") or None

        # --- Build Taste Fingerprint (expanded film pool) ---
        fingerprint: Optional[TasteFingerprint] = None
        if source_user_lower:
            logger.info(f"Building taste fingerprint for source user @{source_user_lower}...")
            source_profile_detail = None
            fingerprint_timeout = max(
                1.0, float(os.getenv("SEARCH_FINGERPRINT_TIMEOUT_SECONDS", "8"))
            )
            try:
                source_profile_detail = await asyncio.wait_for(
                    self.get_user_full_profile(source_user_lower, include_films=True),
                    timeout=min(fingerprint_timeout, max(0.1, deadline - time.monotonic())),
                )
            except asyncio.TimeoutError:
                logger.warning(
                    f"Taste fingerprint enrichment timed out for @{source_user_lower}; "
                    "continuing with the selected films"
                )
            fingerprint = build_fingerprint(
                username=source_user_lower,
                profile_detail=source_profile_detail,
                explicit_slugs=discovery_slugs,
            )
            logger.info(
                f"Taste fingerprint created for @{source_user_lower}: "
                f"{len(fingerprint.film_slugs)} scoring films; "
                f"discovery remains limited to {len(discovery_slugs)} selected films"
            )
        else:
            # No source user — build minimal fingerprint from explicit slugs
            fingerprint = build_fingerprint(
                username="",
                explicit_slugs=discovery_slugs,
            )

        scoring_slugs = list(dict.fromkeys(fingerprint.film_slugs))

        matcher = LocationMatcher(query.location_query, include_bio=query.include_bio)
        sentiment_plan = SentimentPlan(query.sentiment, query.rating_range)

        user_film_interactions: Dict[str, List[FilmInteraction]] = {}
        user_profile_cache: Dict[str, Tuple[UserProfile, str, List[str]]] = {}
        all_evaluated_usernames: Set[str] = set()
        film_title_map: Dict[str, str] = {
            film.slug: film.title or film.slug.replace("-", " ").title()
            for film in fingerprint.films
        }
        film_member_counts: Dict[str, Optional[int]] = {}

        total_films_count = len(scoring_slugs)
        all_target_tiers = (
            [fingerprint.get_tier(s) for s in scoring_slugs] if fingerprint else None
        )

        def _score_interactions(interactions: List[FilmInteraction]):
            """Score one candidate's interactions with the current evidence.

            Used both mid-scan (to spot a strong match early) and for the final
            ranking, so the bar the scan stops at is the same number the result
            is ranked by. Mid-scan the evidence is partial: the library
            cross-reference afterwards adds shared films, which raises
            confidence but can move the averaged signals either way, so the
            reported score may differ slightly from the one that triggered the
            stop.
            """
            film_signals = [
                FilmSignals(
                    user_rating=fi.user_rating,
                    user_liked=fi.user_liked,
                    is_favorite=fi.is_favorite,
                    found_via=fi.found_via,
                    film_tier=(
                        fi.film_tier
                        if fi.film_tier != "unknown" or not fingerprint
                        else fingerprint.get_tier(fi.film_slug)
                    ),
                    source_rating=(
                        fingerprint.get_source_rating(fi.film_slug) if fingerprint else None
                    ),
                    member_count=film_member_counts.get(fi.film_slug),
                )
                for fi in interactions
            ]
            return compute_compatibility_score(
                film_signals, total_films_count, all_target_tiers,
            )

        def _found_strong_match() -> Optional[str]:
            """Return the username of a candidate already good enough to stop for."""
            for u_name, interactions in user_film_interactions.items():
                if source_user_lower and u_name.lower() == source_user_lower:
                    continue
                if len(interactions) < strong_match_min_shared:
                    continue
                if u_name not in user_profile_cache:
                    continue
                score = _score_interactions(interactions)
                if (
                    score.overall >= strong_match_score
                    and score.confidence >= strong_match_confidence
                ):
                    return u_name
            return None

        def _register_location_match(
            u: str,
            profile: UserProfile,
            matched_text: str,
            fields: List[str],
            slug: str,
            film_title: str,
            cand: Dict,
        ) -> None:
            """Register a location-matched user and their film interaction."""
            user_profile_cache[u] = (profile, matched_text, fields)
            if u not in user_film_interactions:
                user_film_interactions[u] = []
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
                        film_tier=fingerprint.get_tier(slug) if fingerprint else "unknown",
                    )
                )
            # Cross-check favorites (unified helper)
            self._cross_check_favorites(
                u, profile.favorite_films, scoring_slugs,
                film_title_map, user_film_interactions[u],
            )

        # Metadata lookups are independent and the HTTP client already enforces a
        # safe concurrency limit. Resolving them together removes one full network
        # round trip per film from the critical path on a cold search.
        metadata_started = time.monotonic()
        metadata_tasks = [
            asyncio.create_task(self.get_film_info(slug)) for slug in discovery_slugs
        ]
        metadata_done, metadata_pending = await asyncio.wait(
            metadata_tasks,
            timeout=max(0.0, deadline - time.monotonic()),
        )
        for pending_task in metadata_pending:
            pending_task.cancel()
        if metadata_pending:
            await asyncio.gather(*metadata_pending, return_exceptions=True)
            stats.partial = True
            stats.stop_reason = "time_budget"
        film_metadata = [
            task.result()
            if task in metadata_done and not task.cancelled() and task.exception() is None
            else None
            for task in metadata_tasks
        ]
        stats.metadata_seconds = time.monotonic() - metadata_started
        metadata_by_slug = dict(zip(discovery_slugs, film_metadata))

        scan_slugs = sorted(
            discovery_slugs,
            key=lambda slug: (
                metadata_by_slug[slug].member_count is None if metadata_by_slug[slug] else True,
                metadata_by_slug[slug].member_count
                if metadata_by_slug[slug] and metadata_by_slug[slug].member_count is not None
                else float("inf"),
            ),
        )

        stop_scanning = _stop_for_budget()
        for film_idx, slug in enumerate(scan_slugs, 1):
            if stop_scanning or _stop_for_budget():
                break
            film_meta = metadata_by_slug[slug] or FilmMetadata(
                slug=slug,
                title=slug.replace("-", " ").title(),
            )
            film_title = film_meta.title or slug.replace("-", " ").title()
            film_title_map[slug] = film_title
            film_member_counts[slug] = film_meta.member_count
            endpoints = sentiment_plan.get_film_endpoints(slug)[:2]

            logger.debug(f"[Scraper] Scouting film {film_idx}/{len(scan_slugs)}: '{slug}' ({film_title})")

            for endpoint_suffix, desc in endpoints:
                if stop_scanning or _stop_for_budget():
                    stop_scanning = True
                    break
                for page in range(1, query.max_pages_per_film + 1):
                    if _stop_for_budget():
                        stop_scanning = True
                        break
                    # Check cache first
                    cache_started = time.monotonic()
                    items = await self.cache.get_film_page(slug, endpoint_suffix, page)
                    stats.cache_lookup_seconds += time.monotonic() - cache_started
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

                        parse_started = time.monotonic()
                        if "reviews" in endpoint_suffix:
                            items = parse_users_from_reviews_page(resp.text)
                        else:
                            items = parse_users_from_rating_or_like_page(resp.text)
                        stats.parse_seconds += time.monotonic() - parse_started

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
                        debug_tracker.record_profile_eval(is_match)
                        if is_match:
                            _register_location_match(
                                u, profile, matched_text, fields,
                                slug, film_title, page_candidates[u],
                            )

                    # Fetch uncached profiles concurrently in chunks
                    batch_size = 25
                    for i in range(0, len(uncached_usernames), batch_size):
                        if _stop_for_budget():
                            stop_scanning = True
                            break
                        remaining_profiles = profile_budget - stats.profiles_fetched
                        chunk = uncached_usernames[i : i + min(batch_size, remaining_profiles)]
                        if not chunk:
                            stats.partial = True
                            stats.stop_reason = "profile_budget"
                            stop_scanning = True
                            break
                        logger.debug(f"[Scraper] Fetching {len(chunk)} uncached profiles for film '{slug}'...")

                        async def fetch_one(u_name: str) -> Optional[UserProfile]:
                            u_url = f"https://letterboxd.com/{u_name}/"
                            r = await self.client.get(u_url)
                            if not r or r.status_code != 200:
                                return None
                            return parse_user_profile_page(r.text, u_name)

                        tasks = [asyncio.create_task(fetch_one(u)) for u in chunk]
                        remaining_seconds = max(0.0, deadline - time.monotonic())
                        done, pending = await asyncio.wait(tasks, timeout=remaining_seconds)
                        for pending_task in pending:
                            pending_task.cancel()
                        if pending:
                            await asyncio.gather(*pending, return_exceptions=True)
                            stats.partial = True
                            stats.stop_reason = "time_budget"
                            stop_scanning = True
                        fetched_profiles = [
                            task.result()
                            for task in tasks
                            if task in done and not task.cancelled() and task.exception() is None
                        ]
                        valid_profiles = [p for p in fetched_profiles if p is not None]
                        if valid_profiles:
                            await self.cache.save_user_profiles_batch(valid_profiles)

                        stats.profiles_fetched += len(chunk)

                        for p in valid_profiles:
                            is_match, fields, matched_text = matcher.match(p.location, p.bio)
                            debug_tracker.record_profile_eval(is_match)
                            if is_match:
                                _register_location_match(
                                    p.username, p, matched_text, fields,
                                    slug, film_title, page_candidates[p.username],
                                )

                        if stop_scanning:
                            break

                    if progress_callback:
                        film_display = film_title or slug
                        progress_callback(
                            f"Finding shared fans of {film_display} ({film_idx}/{len(scan_slugs)})...",
                            stats.total_pages_scanned,
                            stats.total_users_discovered,
                            len([u for u, ints in user_film_interactions.items() if len(ints) >= query.min_shared_films]),
                        )

                    if stop_scanning:
                        break

                if stop_scanning:
                    break

            # Skip when the loop is already unwinding on an exhausted budget —
            # that is a truncation, and should be reported as one.
            strong_match = None if stop_scanning else _found_strong_match()
            if strong_match:
                # A convincing match is the goal, so stop looking. This is a
                # successful finish, not a truncation — leave stats.partial off
                # so the UI does not report it as a budget cut.
                stats.stop_reason = "strong_match"
                logger.info(
                    f"Stopping multi-film scan: @{strong_match} cleared the strong-match "
                    f"bar (score >= {strong_match_score}, confidence >= {strong_match_confidence}) "
                    f"after {film_idx}/{len(scan_slugs)} films"
                )
                break

            if stop_scanning:
                break

        # Cross-reference candidate profile details / library for all location matches
        logger.debug(f"[Matcher] Cross-referencing libraries for {len(user_profile_cache)} location-matched users...")
        profile_entries = list(user_profile_cache.items())
        detail_started = time.monotonic()
        cached_details = await self.cache.get_user_profile_details_batch(
            [u_name for u_name, _ in profile_entries]
        )
        stats.cache_lookup_seconds += time.monotonic() - detail_started
        for u_name, (p, matched_text, fields) in profile_entries:
            cached_detail = cached_details.get(u_name.lower())
            if u_name not in user_film_interactions:
                user_film_interactions[u_name] = []

            # Check favorites on profile (unified helper)
            self._cross_check_favorites(
                u_name, p.favorite_films, scoring_slugs,
                film_title_map, user_film_interactions[u_name],
            )

            # Check cached detail (favorites + top rated + liked + recent)
            if cached_detail:
                self._cross_check_favorites(
                    u_name, cached_detail.favorite_films, scoring_slugs,
                    film_title_map, user_film_interactions[u_name],
                )
                all_lib_films = (
                    (cached_detail.top_rated_films or [])
                    + (cached_detail.liked_films or [])
                    + (cached_detail.recent_films or [])
                )
                for lf in all_lib_films:
                    if lf.slug in scoring_slugs:
                        if not any(i.film_slug == lf.slug for i in user_film_interactions[u_name]):
                            user_film_interactions[u_name].append(
                                FilmInteraction(
                                    film_slug=lf.slug,
                                    film_title=lf.title or film_title_map.get(lf.slug, lf.slug.replace("-", " ").title()),
                                    user_rating=lf.user_rating,
                                    user_rating_stars=lf.user_rating_stars,
                                    user_liked=lf.user_liked,
                                    found_via="User Library / Liked",
                                )
                            )

        # Assemble and rank taste match results using weighted scoring model
        results: List[TasteMatchResult] = []
        if fingerprint:
            for interactions in user_film_interactions.values():
                for interaction in interactions:
                    if interaction.film_tier == "unknown":
                        interaction.film_tier = fingerprint.get_tier(interaction.film_slug)

        for u, interactions in user_film_interactions.items():
            # Exclude source user from their own results
            if source_user_lower and u.lower() == source_user_lower:
                continue
            if len(interactions) >= query.min_shared_films and u in user_profile_cache:
                p, matched_text, fields = user_profile_cache[u]

                score = _score_interactions(interactions)

                res = TasteMatchResult(
                    username=p.username,
                    display_name=p.display_name or p.username,
                    location=p.location,
                    bio=p.bio,
                    avatar_url=p.avatar_url,
                    profile_url=p.profile_url,
                    matched_location=matched_text,
                    matched_fields=fields,
                    shared_films=interactions,
                    shared_films_count=len(interactions),
                    compatibility_score=score.overall,
                    intensity_score=score.intensity,
                    affinity_score=score.affinity,
                    correlation_score=score.correlation,
                    correlation_pairs=score.correlation_pairs,
                    confidence=score.confidence,
                    ranking_score=score.ranking_score,
                    total_target_films=total_films_count,
                )
                results.append(res)
                logger.info(
                    f"[green]✨ Taste match:[/green] @{p.username} ({p.display_name}) -> "
                    f"[bold yellow]{score.overall}% Match[/bold yellow] "
                    f"(rank {score.ranking_score}, {score.correlation_pairs} rated pairs, "
                    f"{len(interactions)} shared: {', '.join(i.film_slug for i in interactions[:3])})"
                )

        # Sort by the evidence-shrunk ranking score, not the displayed score: a
        # one-film match with no ratings can score high on the signals we could
        # measure, and should not outrank a well-evidenced match because of it.
        results.sort(
            key=lambda r: (r.ranking_score, r.compatibility_score, r.shared_films_count),
            reverse=True,
        )
        stats.matches_count = len(results)
        stats.elapsed_seconds = time.time() - start_time
        stats.time_to_first_result = stats.elapsed_seconds if results else None
        stats.upstream_requests = debug_tracker.http_requests_total - http_requests_at_start
        logger.info(f"🏁 Taste match finished in {stats.elapsed_seconds:.2f}s: {len(results)} matches found")

        return results[:query.limit_matches], stats


    async def search_films(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search films with bounded caching and concurrent-request coalescing."""
        clean_q = " ".join(query.split())
        if not clean_q:
            return []

        cache_key = clean_q.casefold()
        now = time.monotonic()
        cached = self._film_search_cache.get(cache_key)
        if cached:
            cached_at, cached_results = cached
            ttl = FILM_SEARCH_CACHE_TTL if cached_results else FILM_SEARCH_EMPTY_TTL
            if now - cached_at < ttl:
                self._film_search_cache.move_to_end(cache_key)
                return cached_results[:limit]
            del self._film_search_cache[cache_key]

        persistent_key = f"film-search:{cache_key}"
        persistent = await self.cache.get_query_result(persistent_key)
        if persistent is not None:
            persistent_results = persistent.get("results", [])
            self._film_search_cache[cache_key] = (time.monotonic(), persistent_results)
            return persistent_results[:limit]

        task = self._film_search_inflight.get(cache_key)
        if task is None:
            task = asyncio.create_task(self._fetch_film_search(clean_q))
            self._film_search_inflight[cache_key] = task

        try:
            # A browser abandoning an old autocomplete query should not cancel the
            # shared upstream lookup that a newer request may still be awaiting.
            results = await asyncio.shield(task)
        finally:
            if task.done() and self._film_search_inflight.get(cache_key) is task:
                self._film_search_inflight.pop(cache_key, None)

        self._film_search_cache[cache_key] = (time.monotonic(), results)
        self._film_search_cache.move_to_end(cache_key)
        while len(self._film_search_cache) > FILM_SEARCH_CACHE_SIZE:
            self._film_search_cache.popitem(last=False)
        if results:
            await self.cache.save_query_result(persistent_key, {"results": results})
        return results[:limit]

    async def _fetch_film_search(self, query: str) -> List[Dict[str, Any]]:
        """Fetch and parse the largest supported suggestion set once."""

        import urllib.parse
        from selectolax.parser import HTMLParser

        encoded = urllib.parse.quote(query)
        url = f"https://letterboxd.com/s/search/{encoded}/"
        headers = {
            "X-Requested-With": "XMLHttpRequest",
            "Referer": f"https://letterboxd.com/search/{encoded}/",
        }
        response = await self.client.get(url, headers=headers)
        if not response or response.status_code != 200:
            return []

        tree = HTMLParser(response.text)
        films: List[Dict[str, Any]] = []
        seen_slugs = set()

        for li in tree.css("li.search-result"):
            fig = li.css_first(".react-component.figure, [data-item-slug], div[data-film-slug]")
            slug = fig.attributes.get("data-item-slug") or fig.attributes.get("data-film-slug") if fig else None

            if not slug:
                for a in li.css('a[href^="/film/"]'):
                    href = a.attributes.get("href", "")
                    parts = [p for p in href.strip("/").split("/") if p]
                    if len(parts) >= 2 and parts[0] == "film":
                        slug = parts[1]
                        break

            if not slug or slug in seen_slugs:
                continue

            title_a = li.css_first("h2 a, .film-title-wrapper a, span.prettify a, h2 span a")
            title = title_a.text(strip=True) if title_a else ""

            year_a = li.css_first("small.metadata a, .metadata a, p.metadata a")
            year_text = year_a.text(strip=True) if year_a else None
            year = int(year_text) if year_text and year_text.isdigit() else None

            director_a = li.css_first('p.film-metadata a[href*="/director/"], p.metadata a[href*="/director/"]')
            director = director_a.text(strip=True) if director_a else None

            if title:
                seen_slugs.add(slug)
                films.append({
                    "slug": slug,
                    "title": title,
                    "year": year,
                    "director": director,
                    "film_url": f"https://letterboxd.com/film/{slug}/",
                })
                if len(films) >= 25:
                    break

        return films
