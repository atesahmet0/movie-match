"""Unit tests for multi-film taste matching and self-matching."""

import pytest
from movie_match.cache.db import CacheDB
from movie_match.models import MultiFilmMatchQuery, UserFilmItem, UserProfile
from movie_match.scraper.letterboxd import LetterboxdScraper


@pytest.mark.asyncio
async def test_find_taste_matches_with_pinned_favorites(tmp_path):
    db_path = tmp_path / "test_taste.db"
    cache = CacheDB(db_path=db_path, ttl_seconds=1000)
    await cache.init()

    # Populate cache with candidate who has 4 pinned favorites
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
        bio="Cinephile in Ankara",
        favorite_films=favs,
    )
    await cache.save_user_profile(p)

    # Populate film metadata and endpoint pages in cache so test is 100% hermetic
    for slug in ["buffalo-66", "princess-mononoke", "the-usual-suspects", "vampire-hunter-d-bloodlust"]:
        from movie_match.models import FilmMetadata
        await cache.save_film_metadata(FilmMetadata(slug=slug, title=slug.replace("-", " ").title()))
        # Save empty results for endpoints
        await cache.save_film_page(slug, f"film/{slug}/likes/", 1, [])
        await cache.save_film_page(slug, f"film/{slug}/ratings/rated/4-5/", 1, [])

    # Fake page cache where verbakimatto only appeared in Buffalo '66 page 1
    await cache.save_film_page(
        "buffalo-66",
        "film/buffalo-66/likes/",
        1,
        [{"username": "verbakimatto", "user_rating": 5.0, "user_liked": True}],
    )

    async with LetterboxdScraper(cache=cache) as scraper:
        # Query with the 4 cornerstone films
        query = MultiFilmMatchQuery(
            films=["buffalo-66", "princess-mononoke", "the-usual-suspects", "vampire-hunter-d-bloodlust"],
            location_query="Ankara",
            min_shared_films=1,
            max_pages_per_film=1,
        )

        matches, stats = await scraper.find_taste_matches(query)
        assert len(matches) == 1
        m = matches[0]
        assert m.username == "verbakimatto"
        # Even though only found on buffalo-66 page 1, his 4 pinned favorites cross-reference all 4 films
        assert m.shared_films_count == 4
        # Weighted score should be high (all films matched, favorites + liked)
        assert m.compatibility_score > 70.0
        # Intensity and affinity scores should be populated
        assert m.intensity_score > 0
        assert m.affinity_score > 0
        shared_slugs = {f.film_slug for f in m.shared_films}
        assert shared_slugs == {"buffalo-66", "princess-mononoke", "the-usual-suspects", "vampire-hunter-d-bloodlust"}
        # Favorites should be marked with is_favorite=True (not hardcoded 5★)
        fav_interactions = [f for f in m.shared_films if f.is_favorite]
        assert len(fav_interactions) >= 3  # At least the 3 found via cross-check

    await cache.close()


@pytest.mark.asyncio
async def test_source_user_excluded_from_results(tmp_path):
    """Source user should not appear in their own taste match results."""
    db_path = tmp_path / "test_self_exclude.db"
    cache = CacheDB(db_path=db_path, ttl_seconds=1000)
    await cache.init()

    favs = [UserFilmItem(slug="fight-club", title="Fight Club", year=1999)]
    p = UserProfile(
        username="testuser",
        display_name="Test User",
        location="Ankara",
        bio="",
        favorite_films=favs,
    )
    await cache.save_user_profile(p)

    from movie_match.models import FilmMetadata
    await cache.save_film_metadata(FilmMetadata(slug="fight-club", title="Fight Club"))
    await cache.save_film_page("fight-club", "film/fight-club/likes/", 1,
        [{"username": "testuser", "user_rating": 5.0, "user_liked": True}])
    await cache.save_film_page("fight-club", "film/fight-club/ratings/rated/4-5/", 1, [])

    async with LetterboxdScraper(cache=cache) as scraper:
        query = MultiFilmMatchQuery(
            films=["fight-club"],
            location_query="Ankara",
            min_shared_films=1,
            max_pages_per_film=1,
            source_username="testuser",
        )
        matches, _ = await scraper.find_taste_matches(query)
        # Source user should be excluded
        assert all(m.username != "testuser" for m in matches)

    await cache.close()

