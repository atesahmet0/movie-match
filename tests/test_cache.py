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
    assert await cache.count_cached_film_pages() == 1
    await cache.close()


@pytest.mark.asyncio
async def test_cache_user_detail_and_films(tmp_path):
    db_path = tmp_path / "test_user_detail.db"
    cache = CacheDB(db_path=db_path, ttl_seconds=100)
    await cache.init()

    from movie_match.models import UserFilmItem, UserProfileDetail
    profile = UserProfileDetail(
        username="karsten",
        display_name="Karsten",
        location="Ankara",
        stats={"films": "400"},
        favorite_films=[
            UserFilmItem(slug="alien", title="Alien", year=1979),
            UserFilmItem(slug="sunshine-2007", title="Sunshine", year=2007),
        ],
    )

    await cache.save_user_profile_detail(profile)
    cached_detail = await cache.get_user_profile_detail("karsten")
    assert cached_detail is not None
    assert cached_detail.username == "karsten"
    assert cached_detail.display_name == "Karsten"
    assert len(cached_detail.favorite_films) == 2
    assert cached_detail.favorite_films[0].slug == "alien"

    # User films
    films = [
        UserFilmItem(slug="the-odyssey", title="The Odyssey", user_rating=4.0, user_liked=True),
        UserFilmItem(slug="interstellar", title="Interstellar", user_rating=5.0, user_liked=True),
    ]
    await cache.close()


@pytest.mark.asyncio
async def test_cache_user_profile_with_favorite_films(tmp_path):
    db_path = tmp_path / "test_user_favs.db"
    cache = CacheDB(db_path=db_path, ttl_seconds=100)
    await cache.init()

    from movie_match.models import UserFilmItem
    favs = [
        UserFilmItem(slug="buffalo-66", title="Buffalo '66", year=1998),
        UserFilmItem(slug="princess-mononoke", title="Princess Mononoke", year=1997),
        UserFilmItem(slug="the-usual-suspects", title="The Usual Suspects", year=1995),
        UserFilmItem(slug="vampire-hunter-d-bloodlust", title="Vampire Hunter D: Bloodlust", year=2000),
    ]
    p = UserProfile(
        username="verbakimatto",
        display_name="Ahmet Rıza Ateş",
        location="Ankara, Turkey",
        favorite_films=favs,
    )

    await cache.save_user_profile(p)
    cached = await cache.get_user_profile("verbakimatto")
    assert cached is not None
    assert cached.username == "verbakimatto"
    assert len(cached.favorite_films) == 4
    assert cached.favorite_films[0].slug == "buffalo-66"
    assert cached.favorite_films[3].slug == "vampire-hunter-d-bloodlust"

    # Batch test
    batch = await cache.get_user_profiles_batch(["verbakimatto"])
    assert len(batch["verbakimatto"].favorite_films) == 4

    await cache.close()


