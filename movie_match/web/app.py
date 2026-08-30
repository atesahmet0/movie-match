import json
import asyncio
import hmac
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates
from movie_match.logging import get_logger, is_debug_enabled, setup_logging
from movie_match.models import MultiFilmMatchQuery, SearchQuery, SentimentType, WaitlistRequest
from movie_match.scraper.letterboxd import LetterboxdScraper
from movie_match.scraper.parser import extract_slug_from_input

logger = get_logger("web")
BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
_shared_scraper: Optional[LetterboxdScraper] = None
_shared_loop: Optional[asyncio.AbstractEventLoop] = None
_scraper_lock = asyncio.Lock()


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
    try:
        yield
    finally:
        global _shared_scraper, _shared_loop
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


@app.get("/api/search")
async def api_search(
    film: str = Query(..., description="Film URL or slug"),
    location: str = Query("Anywhere", description="Target location query (e.g. Anywhere, Turkey, Ankara)"),
    sentiment: SentimentType = Query(SentimentType.LIKED, description="Sentiment: liked, disliked, all"),
    rating: Optional[str] = Query(None, description="Optional star rating (e.g. 5, 4.5, 0.5-2)"),
    max_pages: int = Query(2, ge=1, le=20),
    limit: int = Query(10, ge=1, le=500),
    include_bio: bool = Query(False),
):
    query = SearchQuery(
        film_input=film,
        location_query=location,
        sentiment=sentiment,
        rating_range=rating,
        include_bio=include_bio,
        max_pages=max_pages,
        limit_matches=limit,
    )

    scraper = await get_shared_scraper()
    matches, stats = await scraper.find_users(query)
    # Save to search history
    matches_serialized = [m.model_dump() for m in matches]
    history_id = await scraper.cache.save_search_history(
        film_slug=stats.film_slug,
        film_title=stats.film_title,
        location_query=location,
        sentiment=sentiment.value,
        rating_range=rating,
        matches_count=len(matches),
        results_json=json.dumps(matches_serialized, ensure_ascii=False),
    )

    return {
        "status": "success",
        "history_id": history_id,
        "film": {
            "title": stats.film_title,
            "slug": stats.film_slug,
        },
        "stats": stats.model_dump(),
        "matches_count": len(matches),
        "matches": matches_serialized,
    }


@app.post("/api/taste-match")
async def api_taste_match(query: MultiFilmMatchQuery):
    """Search for users in target location matching multiple films (taste overlap)."""
    if not query.films:
        raise HTTPException(status_code=400, detail="At least one film must be provided")

    scraper = await get_shared_scraper()
    matches, stats = await scraper.find_taste_matches(query)
    matches_serialized = [m.model_dump() for m in matches]

    return {
        "status": "success",
        "films": query.films,
        "stats": stats.model_dump(),
        "matches_count": len(matches),
        "matches": matches_serialized,
    }


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
