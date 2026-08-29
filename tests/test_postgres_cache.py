"""Tests for PostgreSQL cache backend and dual-backend dispatch."""

import os
import pytest
from movie_match.cache.db import CacheDB, PostgresCacheBackend, SqliteCacheBackend
from movie_match.models import FilmMetadata, UserFilmItem, UserProfile, UserProfileDetail


def test_cache_backend_selection(monkeypatch):
    """Verify that CacheDB selects the right backend based on URL / environment."""
    # When DATABASE_URL is not set -> SQLite
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    db_sqlite = CacheDB(database_url=None)
    assert isinstance(db_sqlite.backend, SqliteCacheBackend)
    assert db_sqlite.backend_type == "sqlite"

    # When db_path is explicitly provided -> SQLite even if DATABASE_URL is set
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/mydb")
    from pathlib import Path
    db_sqlite_path = CacheDB(db_path=Path("/tmp/test.db"))
    assert isinstance(db_sqlite_path.backend, SqliteCacheBackend)
    assert db_sqlite_path.backend_type == "sqlite"

    # With Postgres URL -> Postgres
    db_pg = CacheDB(database_url="postgresql://user:pass@localhost:5432/mydb")
    assert isinstance(db_pg.backend, PostgresCacheBackend)
    assert db_pg.backend_type == "postgres"
    assert db_pg.backend.database_url == "postgresql://user:pass@localhost:5432/mydb"

    # With postgres:// prefix -> normalized to postgresql://
    db_pg_alt = CacheDB(database_url="postgres://user:pass@localhost:5432/mydb")
    assert isinstance(db_pg_alt.backend, PostgresCacheBackend)
    assert db_pg_alt.backend.database_url == "postgresql://user:pass@localhost:5432/mydb"


TEST_PG_URL = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
has_postgres = bool(TEST_PG_URL and ("postgres" in TEST_PG_URL))


@pytest.mark.skipif(not has_postgres, reason="No live PostgreSQL database configured in TEST_DATABASE_URL")
@pytest.mark.asyncio
async def test_postgres_cache_crud():
    """Live PostgreSQL CRUD verification test."""
    cache = CacheDB(database_url=TEST_PG_URL, ttl_seconds=100)
    await cache.init()

    # Clear before test
    await cache.clear_cache()

    profile = UserProfile(
        username="postgres_user",
        display_name="Postgres Fan",
        location="Berlin, Germany",
        bio="Testing PostgreSQL",
        is_pro=True,
        favorite_films=[
            UserFilmItem(slug="blade-runner", title="Blade Runner", year=1982),
        ],
    )

    # Save
    await cache.save_user_profile(profile)

    # Retrieve
    cached = await cache.get_user_profile("postgres_user")
    assert cached is not None
    assert cached.username == "postgres_user"
    assert cached.location == "Berlin, Germany"
    assert cached.is_pro is True
    assert len(cached.favorite_films) == 1
    assert cached.favorite_films[0].slug == "blade-runner"

    # Batch test
    profile2 = UserProfile(username="postgres_user2", location="Munich")
    await cache.save_user_profiles_batch([profile2])
    batch = await cache.get_user_profiles_batch(["postgres_user", "postgres_user2", "nonexistent"])
    assert len(batch) == 2
    assert "postgres_user" in batch
    assert "postgres_user2" in batch

    # Film metadata
    film = FilmMetadata(
        slug="blade-runner",
        title="Blade Runner",
        year=1982,
        director="Ridley Scott",
        rating=4.5,
    )
    await cache.save_film_metadata(film)
    cached_film = await cache.get_film_metadata("blade-runner")
    assert cached_film is not None
    assert cached_film.title == "Blade Runner"
    assert cached_film.rating == 4.5

    # History
    hist_id = await cache.save_search_history(
        film_slug="blade-runner",
        film_title="Blade Runner",
        location_query="Berlin",
        sentiment="liked",
        matches_count=5,
        results_json="[]",
    )
    assert hist_id > 0
    hist_item = await cache.get_search_history_item(hist_id)
    assert hist_item is not None
    assert hist_item["film_slug"] == "blade-runner"

    await cache.close()


@pytest.mark.asyncio
async def test_postgres_backend_mock_queries():
    """Verify PostgresCacheBackend method execution, query construction, and parameter handling."""
    from unittest.mock import AsyncMock, MagicMock
    import json

    backend = PostgresCacheBackend(
        database_url="postgresql://user:pass@localhost:5432/testdb",
        ttl_seconds=100,
    )

    mock_conn = AsyncMock()
    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.close = AsyncMock()
    backend.pool = mock_pool

    # 1. save_user_profile
    profile = UserProfile(username="testuser", display_name="Test User", location="Izmir")
    await backend.save_user_profile(profile)
    assert mock_conn.execute.called
    assert "INSERT INTO user_profiles" in mock_conn.execute.call_args[0][0]

    # 2. get_user_profile
    mock_conn.fetchrow.return_value = {
        "username": "testuser",
        "display_name": "Test User",
        "location": "Izmir",
        "bio": "",
        "avatar_url": "",
        "profile_url": "https://letterboxd.com/testuser/",
        "is_pro": False,
        "is_patron": False,
        "favorite_films_json": json.dumps([{"slug": "alien", "title": "Alien"}]),
        "updated_at": 1700000000.0,
    }
    # Clear memory cache to force query
    backend._mem_profiles.clear()
    fetched = await backend.get_user_profile("testuser")
    assert fetched is not None
    assert fetched.username == "testuser"
    assert len(fetched.favorite_films) == 1
    assert fetched.favorite_films[0].slug == "alien"

    # 3. save_user_profiles_batch
    await backend.save_user_profiles_batch([profile])
    assert mock_conn.executemany.called
    assert "INSERT INTO user_profiles" in mock_conn.executemany.call_args[0][0]

    # 4. get_user_profiles_batch
    mock_conn.fetch.return_value = [
        {
            "username": "testuser",
            "display_name": "Test User",
            "location": "Izmir",
            "bio": "",
            "avatar_url": "",
            "profile_url": "https://letterboxd.com/testuser/",
            "is_pro": False,
            "is_patron": False,
            "favorite_films_json": "",
            "updated_at": 1700000000.0,
        }
    ]
    backend._mem_profiles.clear()
    batch = await backend.get_user_profiles_batch(["testuser"])
    assert len(batch) == 1
    assert "testuser" in batch

    # 5. save_search_history
    mock_conn.fetchval.return_value = 42
    hist_id = await backend.save_search_history(
        film_slug="dune-2",
        film_title="Dune 2",
        location_query="Izmir",
        sentiment="liked",
        matches_count=10,
        results_json="[]",
    )
    assert hist_id == 42

    # 6. clear_cache
    await backend.clear_cache()
    assert mock_conn.execute.called

    # 7. close
    await backend.close()
    assert mock_pool.close.called
