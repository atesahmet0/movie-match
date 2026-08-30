import json
import asyncio
import hashlib
import hmac
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.templating import Jinja2Templates
from movie_match.logging import get_logger, is_debug_enabled, performance_tracker, setup_logging
from movie_match.models import MultiFilmMatchQuery, SearchQuery, SentimentType, WaitlistRequest
from movie_match.scraper.letterboxd import LetterboxdScraper
from movie_match.scraper.parser import extract_slug_from_input

logger = get_logger("web")
BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
_shared_scraper: Optional[LetterboxdScraper] = None
_shared_loop: Optional[asyncio.AbstractEventLoop] = None
_scraper_lock = asyncio.Lock()
_search_inflight: dict[str, asyncio.Task] = {}
_warm_task: Optional[asyncio.Task] = None

POPULAR_FILMS = (
    "parasite-2019",
    "interstellar",
    "the-substance",
    "fight-club",
    "dune-part-two",
    "spirited-away",
)


def _query_cache_key(kind: str, payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return f"search:{kind}:{hashlib.sha256(canonical.encode()).hexdigest()}"


async def _warm_popular_cache() -> None:
    """Warm metadata and autocomplete without delaying application startup."""
    try:
        scraper = await get_shared_scraper()
        await asyncio.gather(
            *(scraper.get_film_info(slug) for slug in POPULAR_FILMS),
            *(scraper.search_films(slug.replace("-", " "), limit=8) for slug in POPULAR_FILMS),
            return_exceptions=True,
        )
        logger.info("Popular film caches warmed")
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.warning("Popular film cache warming failed", exc_info=True)


async def get_shared_scraper() -> LetterboxdScraper:
    """Create one scraper/cache per process and reuse it across requests."""
    global _shared_scraper, _shared_loop
    current_loop = asyncio.get_running_loop()
    if _shared_scraper is not None and _shared_loop is current_loop:
        return _shared_scraper
    async with _scraper_lock:
        if _shared_scraper is not None and _shared_loop is not current_loop:
            try:
                await _shared_scraper.client.close()
                await _shared_scraper.cache.close()
            except Exception:
                logger.debug("Discarding scraper created on a previous event loop", exc_info=True)
            _shared_scraper = None
        if _shared_scraper is None:
            candidate = LetterboxdScraper()
            try:
                await candidate.client.start()
                await candidate.cache.init()
            except Exception:
                await candidate.client.close()
                raise
            _shared_scraper = candidate
            _shared_loop = current_loop
    return _shared_scraper


async def require_admin(x_admin_token: Optional[str] = Header(default=None)) -> None:
    """Fail closed for operations that expose PII or mutate shared data."""
    expected = os.getenv("MOVIE_MATCH_ADMIN_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Administrative API is not configured")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=401, detail="Administrative access required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=is_debug_enabled())
    logger.info("🎬 Movie Match FastAPI backend started")
    global _warm_task
    if os.getenv("MOVIE_MATCH_WARM_CACHE", "true").lower() not in {"0", "false", "no"}:
        _warm_task = asyncio.create_task(_warm_popular_cache())
    try:
        yield
    finally:
        global _shared_scraper, _shared_loop
        if _warm_task is not None:
            _warm_task.cancel()
            await asyncio.gather(_warm_task, return_exceptions=True)
            _warm_task = None
        if _shared_scraper is not None:
            await _shared_scraper.client.close()
            await _shared_scraper.cache.close()
            _shared_scraper = None
            _shared_loop = None


app = FastAPI(
    title="Movie Match",
    description="Find cinephiles from specific locations who share your movie tastes.",
    version="0.2.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/health")
async def health_check():
    """Health check endpoint for backend status."""
    return {"status": "ok", "service": "movie-match-backend"}


async def _compute_single_search(
    query: SearchQuery,
    cache_key: str,
    *,
    result_callback=None,
    progress_callback=None,
    cancel_event: Optional[asyncio.Event] = None,
) -> dict:
    scraper = await get_shared_scraper()
    matches, stats = await scraper.find_users(
        query,
        progress_callback=progress_callback,
        result_callback=result_callback,
        cancel_event=cancel_event,
    )
    matches_serialized = [match.model_dump(mode="json") for match in matches]
    history_id = await scraper.cache.save_search_history(
        film_slug=stats.film_slug,
        film_title=stats.film_title,
        location_query=query.location_query,
        sentiment=query.sentiment.value,
        rating_range=query.rating_range,
        matches_count=len(matches),
        results_json=json.dumps(matches_serialized, ensure_ascii=False),
    )
    payload = {
        "status": "success",
        "history_id": history_id,
        "film": {"title": stats.film_title, "slug": stats.film_slug},
        "stats": stats.model_dump(mode="json"),
        "matches_count": len(matches),
        "matches": matches_serialized,
    }
    await scraper.cache.save_query_result(cache_key, payload)
    return payload


async def _run_single_search(
    query: SearchQuery,
    *,
    result_callback=None,
    progress_callback=None,
    cancel_event: Optional[asyncio.Event] = None,
    bypass_cache: bool = False,
) -> dict:
    started = time.monotonic()
    performance_tracker.started()
    cache_key = _query_cache_key("single", query.model_dump(mode="json"))
    use_coalescing = result_callback is None and progress_callback is None and cancel_event is None
    task: Optional[asyncio.Task] = None
    try:
        scraper = await get_shared_scraper()
        cached = None if bypass_cache else await scraper.cache.get_query_result(cache_key)
        if cached is not None:
            cached["stats"]["cache_status"] = "hit"
            performance_tracker.finished(time.monotonic() - started, cache_hit=True)
            return cached

        task = _search_inflight.get(cache_key) if use_coalescing else None
        if task is None:
            task = asyncio.create_task(
                _compute_single_search(
                    query,
                    cache_key,
                    result_callback=result_callback,
                    progress_callback=progress_callback,
                    cancel_event=cancel_event,
                )
            )
            if use_coalescing:
                _search_inflight[cache_key] = task
        payload = await asyncio.shield(task) if use_coalescing else await task
        performance_tracker.finished(
            time.monotonic() - started,
            time_to_first_result=payload["stats"].get("time_to_first_result"),
        )
        return payload
    except asyncio.CancelledError:
        performance_tracker.finished(time.monotonic() - started, cancelled=True)
        raise
    except Exception:
        performance_tracker.finished(time.monotonic() - started)
        raise
    finally:
        if use_coalescing and task is not None and task.done() and _search_inflight.get(cache_key) is task:
            _search_inflight.pop(cache_key, None)


async def _compute_taste_search(
    query: MultiFilmMatchQuery,
    cache_key: str,
    *,
    progress_callback=None,
    cancel_event: Optional[asyncio.Event] = None,
) -> dict:
    scraper = await get_shared_scraper()
    matches, stats = await scraper.find_taste_matches(
        query,
        progress_callback=progress_callback,
        cancel_event=cancel_event,
    )
    payload = {
        "status": "success",
        "films": query.films,
        "stats": stats.model_dump(mode="json"),
        "matches_count": len(matches),
        "matches": [match.model_dump(mode="json") for match in matches],
    }
    if not stats.partial:
        await scraper.cache.save_query_result(cache_key, payload)
    return payload


async def _run_taste_search(
    query: MultiFilmMatchQuery,
    *,
    progress_callback=None,
    cancel_event: Optional[asyncio.Event] = None,
    bypass_cache: bool = False,
) -> dict:
    started = time.monotonic()
    performance_tracker.started()
    cache_key = _query_cache_key("taste", query.model_dump(mode="json"))
    use_coalescing = progress_callback is None and cancel_event is None
    task: Optional[asyncio.Task] = None
    try:
        scraper = await get_shared_scraper()
        cached = None if bypass_cache else await scraper.cache.get_query_result(cache_key)
        if cached is not None:
            cached["stats"]["cache_status"] = "hit"
            performance_tracker.finished(time.monotonic() - started, cache_hit=True)
            return cached

        task = _search_inflight.get(cache_key) if use_coalescing else None
        if task is None:
            task = asyncio.create_task(
                _compute_taste_search(
                    query,
                    cache_key,
                    progress_callback=progress_callback,
                    cancel_event=cancel_event,
                )
            )
            if use_coalescing:
                _search_inflight[cache_key] = task
        payload = await asyncio.shield(task) if use_coalescing else await task
        performance_tracker.finished(
            time.monotonic() - started,
            time_to_first_result=payload["stats"].get("time_to_first_result"),
        )
        return payload
    except asyncio.CancelledError:
        performance_tracker.finished(time.monotonic() - started, cancelled=True)
        raise
    except Exception:
        performance_tracker.finished(time.monotonic() - started)
        raise
    finally:
        if use_coalescing and task is not None and task.done() and _search_inflight.get(cache_key) is task:
            _search_inflight.pop(cache_key, None)


@app.get("/api/search")
async def api_search(
    film: str = Query(..., description="Film URL or slug"),
    location: str = Query("Anywhere", description="Target location query (e.g. Anywhere, Turkey, Ankara)"),
    sentiment: SentimentType = Query(SentimentType.LIKED, description="Sentiment: liked, disliked, all"),
    rating: Optional[str] = Query(None, description="Optional star rating (e.g. 5, 4.5, 0.5-2)"),
    max_pages: int = Query(2, ge=1, le=20),
    limit: int = Query(10, ge=1, le=500),
    include_bio: bool = Query(False),
    source_username: Optional[str] = Query(None),
):
    query = SearchQuery(
        film_input=film,
        location_query=location,
        sentiment=sentiment,
        rating_range=rating,
        include_bio=include_bio,
        max_pages=max_pages,
        limit_matches=limit,
        source_username=source_username,
    )

    return await _run_single_search(query)


@app.post("/api/taste-match")
async def api_taste_match(query: MultiFilmMatchQuery, request: Request):
    """Search for users in target location matching multiple films (taste overlap)."""
    if not query.films:
        raise HTTPException(status_code=400, detail="At least one film must be provided")

    cancel_event = asyncio.Event()
    task = asyncio.create_task(_run_taste_search(query, cancel_event=cancel_event))
    endpoint_timeout = max(10.0, float(os.getenv("SEARCH_ENDPOINT_TIMEOUT_SECONDS", "50")))
    deadline = time.monotonic() + endpoint_timeout
    try:
        while not task.done():
            if await request.is_disconnected():
                cancel_event.set()
                task.cancel()
                raise HTTPException(status_code=499, detail="Search cancelled after client disconnected")
            if time.monotonic() >= deadline:
                cancel_event.set()
                task.cancel()
                raise HTTPException(
                    status_code=504,
                    detail="Search reached its time limit. Try fewer pages or a narrower location.",
                )
            await asyncio.wait({task}, timeout=0.25)
        return await task
    finally:
        if not task.done():
            cancel_event.set()
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)


@app.get("/api/search/stream")
async def api_stream_search(
    request: Request,
    films: str = Query(..., min_length=1),
    location: str = Query("Anywhere"),
    sentiment: SentimentType = Query(SentimentType.LIKED),
    rating: Optional[str] = Query(None),
    max_pages: int = Query(2, ge=1, le=20),
    limit: int = Query(10, ge=1, le=500),
    include_bio: bool = Query(False),
    min_shared: int = Query(1, ge=1, le=50),
    source_username: Optional[str] = Query(None),
    refresh: bool = Query(False),
):
    """Stream progress and discovered matches; disconnecting cancels upstream work."""
    clean_films = list(
        dict.fromkeys(
            extract_slug_from_input(item)
            for item in films.split(",")
            if item.strip()
        )
    )
    if not clean_films:
        raise HTTPException(status_code=400, detail="At least one film is required")

    async def event_stream():
        queue: asyncio.Queue[dict] = asyncio.Queue()
        cancel_event = asyncio.Event()
        emitted: set[str] = set()

        def on_progress(message: str, pages: int, users: int, matches: int) -> None:
            queue.put_nowait({
                "type": "progress",
                "message": message,
                "pages": pages,
                "users": users,
                "matches": matches,
            })

        def on_result(match) -> None:
            emitted.add(match.username)
            queue.put_nowait({"type": "result", "match": match.model_dump(mode="json")})

        async def run_search() -> None:
            try:
                if len(clean_films) == 1:
                    payload = await _run_single_search(
                        SearchQuery(
                            film_input=clean_films[0],
                            location_query=location,
                            sentiment=sentiment,
                            rating_range=rating,
                            include_bio=include_bio,
                            max_pages=max_pages,
                            limit_matches=limit,
                            source_username=source_username,
                        ),
                        result_callback=on_result,
                        progress_callback=on_progress,
                        cancel_event=cancel_event,
                        bypass_cache=refresh,
                    )
                else:
                    payload = await _run_taste_search(
                        MultiFilmMatchQuery(
                            films=clean_films,
                            location_query=location,
                            min_shared_films=min(min_shared, len(clean_films)),
                            sentiment=sentiment,
                            rating_range=rating,
                            include_bio=include_bio,
                            max_pages_per_film=max_pages,
                            limit_matches=limit,
                            source_username=source_username,
                        ),
                        progress_callback=on_progress,
                        cancel_event=cancel_event,
                        bypass_cache=refresh,
                    )
                for match in payload["matches"]:
                    if match["username"] not in emitted:
                        emitted.add(match["username"])
                        queue.put_nowait({"type": "result", "match": match})
                queue.put_nowait({"type": "complete", "payload": payload})
            except asyncio.CancelledError:
                queue.put_nowait({"type": "cancelled"})
                raise
            except Exception as exc:
                logger.exception("Streaming search failed")
                queue.put_nowait({"type": "error", "message": str(exc)})

        task = asyncio.create_task(run_search())
        try:
            while True:
                if await request.is_disconnected():
                    cancel_event.set()
                    task.cancel()
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                event_name = event.pop("type")
                yield f"event: {event_name}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event_name in {"complete", "error", "cancelled"}:
                    break
        finally:
            cancel_event.set()
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/metrics")
async def api_metrics():
    metrics = performance_tracker.snapshot()
    if _shared_scraper is not None:
        metrics["proxy"] = _shared_scraper.client.metrics_snapshot()
    return {"status": "success", "metrics": metrics}


@app.get("/api/user/{username}")
async def api_user_profile(username: str):
    """Retrieve full Letterboxd user profile, stats, favorite films, and recent watches."""
    clean_user = username.strip().lstrip("@")
    if not clean_user:
        raise HTTPException(status_code=400, detail="Username is required")

    try:
        scraper = await get_shared_scraper()
        profile = await scraper.get_user_full_profile(clean_user, include_films=True)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Letterboxd user '{clean_user}' not found")

        return {
            "status": "success",
            "profile": profile.model_dump(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to retrieve Letterboxd profile for '{clean_user}': {str(e)}")


@app.get("/api/user/{username}/films")
async def api_user_films(
    username: str,
    category: str = Query("films", description="Category: films, top_rated, likes, watchlist"),
    page: int = Query(1, ge=1, le=50),
):
    """Retrieve paginated films for a specific user category."""
    clean_user = username.strip().lstrip("@")
    if not clean_user:
        raise HTTPException(status_code=400, detail="Username is required")

    scraper = await get_shared_scraper()
    films = await scraper.get_user_films_category(clean_user, category=category, page=page)

    return {
        "status": "success",
        "username": clean_user,
        "category": category,
        "page": page,
        "films_count": len(films),
        "films": [f.model_dump() for f in films],
    }


@app.get("/api/history")
async def api_history(limit: int = Query(50, ge=1, le=100), _: None = Depends(require_admin)):
    """Retrieve list of previous search summaries."""
    cache = (await get_shared_scraper()).cache
    history = await cache.get_search_history(limit=limit)
    return {"status": "success", "history": history}


@app.get("/api/history/{history_id}")
async def api_history_item(history_id: int, _: None = Depends(require_admin)):
    """Retrieve full results of a specific historical search."""
    cache = (await get_shared_scraper()).cache
    item = await cache.get_search_history_item(history_id)
    if not item:
        raise HTTPException(status_code=404, detail="Search history item not found")
    return {"status": "success", "item": item}


@app.delete("/api/history")
async def api_clear_history(_: None = Depends(require_admin)):
    """Clear all search history."""
    cache = (await get_shared_scraper()).cache
    await cache.clear_search_history()
    return {"status": "success", "message": "Search history cleared."}


@app.post("/api/cache/clear")
async def api_clear_cache(_: None = Depends(require_admin)):
    """Clear local SQLite database cache."""
    cache = (await get_shared_scraper()).cache
    await cache.clear_cache()
    return {"status": "success", "message": "Local cache cleared successfully."}


@app.get("/api/film-info")
async def api_film_info(film: str = Query(...)):
    slug = extract_slug_from_input(film)
    scraper = await get_shared_scraper()
    meta = await scraper.get_film_info(slug, strict=True)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Film '{slug}' was not found")
    return meta.model_dump()


@app.get("/api/films/search")
async def api_search_films(
    response: Response,
    q: str = Query(..., min_length=1, description="Search query for films"),
    limit: int = Query(10, ge=1, le=25),
):
    """Search Letterboxd for films by title / keyword."""
    scraper = await get_shared_scraper()
    results = await scraper.search_films(q, limit=limit)
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return {"status": "success", "query": q, "results": results}


@app.post("/api/waitlist")
async def api_save_waitlist(req: WaitlistRequest):
    """Save email lead to database waitlist for upcoming features."""
    email = req.email.strip()
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")

    cache = (await get_shared_scraper()).cache
    lead_id = await cache.save_waitlist_lead(email=email, feature=req.feature or "extended_tier")

    return {
        "status": "success",
        "lead_id": lead_id,
        "message": "Thank you! You have been added to the early access waitlist.",
    }


@app.get("/api/waitlist")
async def api_get_waitlist(limit: int = Query(100, ge=1, le=500), _: None = Depends(require_admin)):
    """Retrieve saved waitlist leads."""
    cache = (await get_shared_scraper()).cache
    leads = await cache.get_waitlist_leads(limit=limit)
    return {"status": "success", "leads": leads, "count": len(leads)}
