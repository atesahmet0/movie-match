"""Unit & integration tests for backend PostHog analytics and saved matched users."""

import asyncio
import json
import pytest
from fastapi.testclient import TestClient

from movie_match.analytics import (
    capture_backend_exception,
    capture_event,
    flush_analytics,
    init_analytics,
    track_api_request,
    track_circuit_breaker,
    track_http_request,
    track_proxy_block,
    track_search_completed,
    track_search_failed,
    track_search_started,
)
from movie_match.cache.db import SqliteCacheBackend
from movie_match.models import UserProfile, UserFilmItem
from movie_match.web.app import app


@pytest.mark.asyncio
async def test_analytics_event_helpers_non_blocking():
    """Verify that all analytics event helpers execute safely without throwing."""
    # Test with real EU key or fallback in non-blocking mode
    init_analytics()

    # Track HTTP proxy request
    track_http_request(
        url="https://letterboxd.com/film/parasite-2019/likes/",
        status_code=200,
        duration_sec=0.123,
        retry_attempt=1,
        response_bytes=10420,
        proxy_mode="rotating",
        proxy_used=True,
    )

    # Track Proxy Block (403/429)
    track_proxy_block(
        url="https://letterboxd.com/film/parasite-2019/likes/",
        status_code=403,
        backoff_sec=1.5,
        attempt=1,
        max_retries=3,
        session_generation=2,
    )

    # Track Circuit Breaker
    track_circuit_breaker(
        event="circuit_opened",
        pause_sec=10.0,
        recent_blocks=5,
    )

    # Track Search Started / Completed / Failed
    track_search_started("taste_match", {"films": ["parasite-2019"], "location": "Berlin"})
    track_search_completed(
        search_type="taste_match",
        duration_sec=1.45,
        matches_count=3,
        location="Berlin",
        films_count=1,
        matched_usernames=["cinephile1", "cinephile2"],
    )
    track_search_failed("taste_match", "Connection error", 0.5, status_code=500)

    # Track API request
    track_api_request(
        path="/api/films/search",
        method="GET",
        status_code=200,
        duration_ms=45.2,
        request_size_bytes=120,
        response_size_bytes=4500,
    )

    # Capture exception
    try:
        raise ValueError("Test analytics exception capture")
    except Exception as e:
        capture_backend_exception(e, context={"test": True})

    flush_analytics()


@pytest.mark.asyncio
async def test_sqlite_saved_matched_users_persistence(tmp_path):
    """Test that candidate and matched user profiles are saved and retrieved properly."""
    db_file = str(tmp_path / "test_matched_users.db")
    cache = SqliteCacheBackend(db_path=db_file)
    await cache.init()

    # Save multiple user profiles with favorite films
    profiles = [
        UserProfile(
            username="ankara_film_lover",
            display_name="Cine Ankara",
            location="Ankara, Turkey",
            bio="Watching Turkish and French cinema",
            avatar_url="https://example.com/avatar1.jpg",
            profile_url="https://letterboxd.com/ankara_film_lover/",
            favorite_films=[
                UserFilmItem(slug="winter-sleep", title="Winter Sleep", year=2014, user_rating=5.0),
                UserFilmItem(slug="burning-2018", title="Burning", year=2018, user_rating=4.5),
            ],
        ),
        UserProfile(
            username="berlin_critic",
            display_name="Kino Berlin",
            location="Berlin, Germany",
            bio="Berlinale fan",
            avatar_url="https://example.com/avatar2.jpg",
            profile_url="https://letterboxd.com/berlin_critic/",
            favorite_films=[
                UserFilmItem(slug="wings-of-desire", title="Wings of Desire", year=1987, user_rating=5.0),
            ],
        ),
    ]

    await cache.save_user_profiles_batch(profiles)

    # Retrieve all saved users
    all_users = await cache.get_saved_matched_users(limit=10)
    assert len(all_users) == 2
    usernames = {u["username"] for u in all_users}
    assert "ankara_film_lover" in usernames
    assert "berlin_critic" in usernames
    assert len(all_users[0]["favorite_films"]) > 0

    # Retrieve with location filter
    filtered_users = await cache.get_saved_matched_users(limit=10, location="Ankara")
    assert len(filtered_users) == 1
    assert filtered_users[0]["username"] == "ankara_film_lover"
    assert filtered_users[0]["location"] == "Ankara, Turkey"

    await cache.close()


def test_api_telemetry_middleware_and_saved_users_endpoint():
    """Verify FastAPI telemetry middleware captures requests and /api/matches/saved-users responds."""
    client = TestClient(app)

    # 1. Test health check
    res_health = client.get("/health")
    assert res_health.status_code == 200

    # 2. Test saved users endpoint
    res_users = client.get("/api/matches/saved-users?limit=10")
    assert res_users.status_code == 200
    data = res_users.json()
    assert data["status"] == "success"
    assert "users" in data
    assert isinstance(data["users"], list)

    # 3. Test waitlist event tracking
    res_waitlist = client.post(
        "/api/waitlist",
        json={"email": "analytics_test@example.com", "feature": "backend_tracing_tier"},
    )
    assert res_waitlist.status_code == 200

    # 4. Test newsletter event tracking
    res_newsletter = client.post(
        "/api/newsletter",
        json={"email": "newsletter_test@example.com", "source": "unit_test"},
    )
    assert res_newsletter.status_code == 200
