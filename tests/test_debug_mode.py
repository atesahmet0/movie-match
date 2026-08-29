"""Unit tests for movie-match debug mode, logging infrastructure, and performance diagnostics."""

import logging
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typer.testing import CliRunner

from movie_match.cli import app
from movie_match.logging import (
    DebugTracker,
    debug_tracker,
    get_logger,
    is_debug_enabled,
    setup_logging,
)
from movie_match.models import FilmMetadata, SearchQuery, SentimentType, UserProfile
from movie_match.cache.db import CacheDB
from movie_match.scraper.client import AntiBotHttpClient
from movie_match.scraper.letterboxd import LetterboxdScraper

runner = CliRunner()


def test_setup_logging_levels():
    """Test logger initialization with debug, verbose, and custom log levels."""
    # Debug level
    logger = setup_logging(debug=True, force_reconfigure=True)
    assert logger.level == logging.DEBUG

    # Info / verbose level
    logger_v = setup_logging(debug=False, verbose=True, force_reconfigure=True)
    assert logger_v.level == logging.INFO

    # Namespaced logger lookup
    sub_logger = get_logger("test_module")
    assert sub_logger.name == "movie_match.test_module"


def test_is_debug_enabled_env_var(monkeypatch):
    """Test is_debug_enabled detects various environment variable settings."""
    # When no env var is set
    monkeypatch.delenv("DEBUG", raising=False)
    monkeypatch.delenv("MOVIE_MATCH_DEBUG", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    setup_logging(debug=False, force_reconfigure=True)

    # Set DEBUG=1
    monkeypatch.setenv("DEBUG", "1")
    assert is_debug_enabled() is True

    # Set MOVIE_MATCH_DEBUG=true
    monkeypatch.delenv("DEBUG", raising=False)
    monkeypatch.setenv("MOVIE_MATCH_DEBUG", "true")
    assert is_debug_enabled() is True

    # Set LOG_LEVEL=debug
    monkeypatch.delenv("MOVIE_MATCH_DEBUG", raising=False)
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    assert is_debug_enabled() is True

    # Set inactive value
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.setenv("DEBUG", "0")
    # Reset internal flag
    setup_logging(debug=False, force_reconfigure=True)
    assert is_debug_enabled() is False


def test_debug_tracker_metrics_and_table():
    """Test DebugTracker records operations and generates a Rich summary table."""
    tracker = DebugTracker()
    tracker.reset()

    # Record operations
    tracker.record_http_request(duration_sec=0.25, status_code=200, retry=False)
    tracker.record_http_request(duration_sec=0.15, status_code=429, retry=True)
    tracker.record_http_request(duration_sec=0.30, status_code=200, retry=True)
    tracker.record_cache_hit(count=5)
    tracker.record_cache_miss(count=2)
    tracker.record_profile_eval(is_match=True)
    tracker.record_profile_eval(is_match=False)

    assert tracker.http_requests_total == 3
    assert tracker.http_requests_success == 2
    assert tracker.http_rate_limits == 1
    assert tracker.http_retries == 2
    assert tracker.cache_hits == 5
    assert tracker.cache_misses == 2
    assert tracker.profiles_evaluated == 2
    assert tracker.location_matches == 1

    table = tracker.generate_summary_table()
    assert table.title == "🔍 Debug Diagnostics & Performance Summary"
    # Ensure rows exist
    assert len(table.rows) >= 8


@pytest.mark.asyncio
async def test_http_client_debug_tracking():
    """Test that AntiBotHttpClient correctly records debug metrics on requests."""
    debug_tracker.reset()
    client = AntiBotHttpClient()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = "<html></html>"

    with patch.object(client, "start", new=AsyncMock()), \
         patch.object(client, "_session") as mock_session:
        mock_session.get = AsyncMock(return_value=mock_resp)

        resp = await client.get("https://letterboxd.com/film/alien/")
        assert resp is not None
        assert resp.status_code == 200
        assert debug_tracker.http_requests_total == 1
        assert debug_tracker.http_requests_success == 1


@pytest.mark.asyncio
async def test_scraper_debug_tracking_hermetic(tmp_path):
    """Test that LetterboxdScraper records profile evaluations and cache lookups in debug_tracker."""
    debug_tracker.reset()
    setup_logging(debug=True, force_reconfigure=True)

    db_path = tmp_path / "test_debug.db"
    cache = CacheDB(db_path=db_path)
    await cache.init()

    # Pre-populate cache for hermetic execution
    film_slug = "alien"
    await cache.save_film_metadata(FilmMetadata(slug=film_slug, title="Alien"))
    await cache.save_film_page(
        film_slug,
        f"film/{film_slug}/likes/",
        1,
        [
            {"username": "user_ankara", "user_rating": 5.0, "user_liked": True},
            {"username": "user_london", "user_rating": 4.5, "user_liked": True},
        ],
    )
    # Save empty 2nd endpoint to finish quickly
    await cache.save_film_page(film_slug, f"film/{film_slug}/ratings/rated/4-5/", 1, [])
    await cache.save_film_page(film_slug, f"film/{film_slug}/fans/", 1, [])
    await cache.save_film_page(film_slug, f"film/{film_slug}/reviews/by/rating/", 1, [])

    p1 = UserProfile(username="user_ankara", display_name="Ali", location="Ankara, Turkey", profile_url="https://letterboxd.com/user_ankara/")
    p2 = UserProfile(username="user_london", display_name="John", location="London, UK", profile_url="https://letterboxd.com/user_london/")
    await cache.save_user_profiles_batch([p1, p2])

    async with LetterboxdScraper(cache=cache) as scraper:
        query = SearchQuery(
            film_input="alien",
            location_query="Ankara",
            sentiment=SentimentType.LIKED,
            max_pages=1,
            limit_matches=5,
        )
        matches, stats = await scraper.find_users(query)
        assert len(matches) == 1
        assert matches[0].username == "user_ankara"
        assert debug_tracker.profiles_evaluated >= 2
        assert debug_tracker.location_matches >= 1
        assert debug_tracker.cache_hits >= 1

    await cache.close()


def test_cli_help_includes_debug_flags():
    """Verify all CLI subcommands have --debug / -d options registered."""
    for cmd in ["find", "taste-match", "profile", "cache", "serve"]:
        result = runner.invoke(app, [cmd, "--help"])
        assert result.exit_code == 0
        assert "--debug" in result.output or "-d" in result.output
