"""FastAPI backend application for Movie Match web dashboard and REST API."""

import asyncio
import json
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from movie_match.cache.db import CacheDB
from movie_match.models import MultiFilmMatchQuery, SearchQuery, SentimentType
from movie_match.scraper.letterboxd import LetterboxdScraper
from movie_match.scraper.parser import extract_slug_from_input


BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI(
    title="Letterboxd Movie Matcher",
    description="Find Letterboxd users from specific locations who liked or disliked movies.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    max_pages: int = Query(3, ge=1, le=20),
    limit: int = Query(50, ge=1, le=500),
    include_bio: bool = Query(True),
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

    async with LetterboxdScraper() as scraper:
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

    async with LetterboxdScraper() as scraper:
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

    async with LetterboxdScraper() as scraper:
        profile = await scraper.get_user_full_profile(clean_user, include_films=True)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Letterboxd user '{clean_user}' not found")

    return {
        "status": "success",
        "profile": profile.model_dump(),
    }


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

    async with LetterboxdScraper() as scraper:
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
async def api_history(limit: int = Query(50, ge=1, le=100)):
    """Retrieve list of previous search summaries."""
    cache = CacheDB()
    await cache.init()
    history = await cache.get_search_history(limit=limit)
    await cache.close()
    return {"status": "success", "history": history}


@app.get("/api/history/{history_id}")
async def api_history_item(history_id: int):
    """Retrieve full results of a specific historical search."""
    cache = CacheDB()
    await cache.init()
    item = await cache.get_search_history_item(history_id)
    await cache.close()
    if not item:
        raise HTTPException(status_code=404, detail="Search history item not found")
    return {"status": "success", "item": item}


@app.delete("/api/history")
async def api_clear_history():
    """Clear all search history."""
    cache = CacheDB()
    await cache.init()
    await cache.clear_search_history()
    await cache.close()
    return {"status": "success", "message": "Search history cleared."}


@app.get("/api/film-info")
async def api_film_info(film: str = Query(...)):
    slug = extract_slug_from_input(film)
    async with LetterboxdScraper() as scraper:
        meta = await scraper.get_film_info(slug)
    return meta.model_dump()


@app.get("/api/films/search")
async def api_search_films(
    q: str = Query(..., min_length=1, description="Search query for films"),
    limit: int = Query(10, ge=1, le=25),
):
    """Search Letterboxd for films by title / keyword."""
    async with LetterboxdScraper() as scraper:
        results = await scraper.search_films(q, limit=limit)
    return {"status": "success", "query": q, "results": results}


