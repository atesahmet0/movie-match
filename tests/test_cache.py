"""Unit tests for SQLite Cache DB."""

import pytest
from movie_match.cache.db import CacheDB
from movie_match.models import FilmMetadata, UserProfile


@pytest.mark.asyncio
async def test_cache_user_profile_crud(tmp_path):
    db_path = tmp_path / "test_cache.db"
    cache = CacheDB(db_path=db_path, ttl_seconds=100)
    await cache.init()

    profile = UserProfile(
        username="cemre",
        display_name="Cemre",
        location="Istanbul",
        bio="Film lover",
        is_pro=True,
    )

    # Save
    await cache.save_user_profile(profile)

    # Retrieve
    cached = await cache.get_user_profile("cemre")
    assert cached is not None
    assert cached.username == "cemre"
    assert cached.location == "Istanbul"
    assert cached.is_pro is True

    # Count
    count = await cache.count_cached_profiles()
    assert count == 1

    # Batch test
    profile2 = UserProfile(username="baris", location="Ankara")
    await cache.save_user_profiles_batch([profile2])
    batch = await cache.get_user_profiles_batch(["cemre", "baris", "nonexistent"])
    assert len(batch) == 2
    assert "cemre" in batch
    assert "baris" in batch

    # Clear
    await cache.clear_cache()
    assert await cache.count_cached_profiles() == 0

    await cache.close()


@pytest.mark.asyncio
async def test_cache_film_metadata(tmp_path):
    db_path = tmp_path / "test_film_cache.db"
    cache = CacheDB(db_path=db_path, ttl_seconds=100)
    await cache.init()

    film = FilmMetadata(
        slug="vampire-hunter-d-bloodlust",
        title="Vampire Hunter D: Bloodlust",
        year=2000,
        director="Yoshiaki Kawajiri",
        rating=4.0,
    )

    await cache.save_film_metadata(film)
    cached = await cache.get_film_metadata("vampire-hunter-d-bloodlust")
    assert cached is not None
    assert cached.title == "Vampire Hunter D: Bloodlust"
    assert cached.year == 2000

    await cache.close()


@pytest.mark.asyncio
async def test_cache_film_page_cache(tmp_path):
    db_path = tmp_path / "test_page_cache.db"
    cache = CacheDB(db_path=db_path, interaction_ttl=100)
    await cache.init()

    items = [
        {"username": "user1", "user_rating": 4.5, "user_liked": True},
        {"username": "user2", "user_rating": 5.0, "user_liked": False},
    ]

    # Save page cache
    await cache.save_film_page("vampire-hunter-d-bloodlust", "likes/", 1, items)

    # Retrieve
    cached = await cache.get_film_page("vampire-hunter-d-bloodlust", "likes/", 1)
    assert cached is not None
    assert len(cached) == 2
    assert cached[0]["username"] == "user1"

    # Miss on page 2
    assert await cache.get_film_page("vampire-hunter-d-bloodlust", "likes/", 2) is None

    assert await cache.count_cached_film_pages() == 1
    await cache.close()
