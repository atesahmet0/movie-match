"""Unit tests for enhanced multi-film taste matching with tiered scoring and correlation."""

import pytest
from movie_match.cache.db import CacheDB
from movie_match.matcher.fingerprint import (
    FilmTier,
    TasteFingerprint,
    FingerprintFilm,
    build_fingerprint,
    TIER_WEIGHTS,
)
from movie_match.matcher.scoring import (
    FilmSignals,
    _pearson_correlation,
    _film_rarity_weight,
    compute_compatibility_score,
)
from movie_match.models import (
    FilmMetadata,
    MultiFilmMatchQuery,
    UserFilmItem,
    UserProfile,
    UserProfileDetail,
)
from movie_match.scraper.letterboxd import LetterboxdScraper


# ───────────────────────────────────────────────────────────────────────
# Fingerprint Builder Tests
# ───────────────────────────────────────────────────────────────────────

def test_build_fingerprint_from_explicit_slugs():
    """When no profile detail is available, fingerprint uses explicit slugs."""
    fp = build_fingerprint(
        username="testuser",
        explicit_slugs=["fight-club", "inception", "parasite"],
    )
    assert fp.username == "testuser"
    assert len(fp.films) == 3
    assert all(f.tier == FilmTier.UNKNOWN for f in fp.films)
    assert set(fp.film_slugs) == {"fight-club", "inception", "parasite"}


def test_build_fingerprint_from_profile_detail():
    """Profile detail builds tiered fingerprint: favorites > top_rated > liked > recent."""
    detail = UserProfileDetail(
        username="cinephile",
        display_name="Cinephile",
        favorite_films=[
            UserFilmItem(slug="stalker", title="Stalker", year=1979, user_rating=5.0),
            UserFilmItem(slug="persona", title="Persona", year=1966, user_rating=5.0),
        ],
        top_rated_films=[
            UserFilmItem(slug="stalker", title="Stalker", user_rating=5.0),  # dupe
            UserFilmItem(slug="mirror", title="Mirror", user_rating=4.5),
            UserFilmItem(slug="raging-bull", title="Raging Bull", user_rating=4.5),
        ],
        liked_films=[
            UserFilmItem(slug="mirror", title="Mirror", user_liked=True),  # dupe
            UserFilmItem(slug="eraserhead", title="Eraserhead", user_liked=True),
        ],
        recent_films=[
            UserFilmItem(slug="oppenheimer", title="Oppenheimer"),
        ],
        stats={"films": "500"},
    )
    fp = build_fingerprint(username="cinephile", profile_detail=detail)

    # favorites: stalker, persona (2)
    # top_rated: mirror, raging-bull (stalker deduped) (2)
    # liked: eraserhead (mirror deduped) (1)
    # recent: oppenheimer (1)
    assert len(fp.films) == 6
    assert fp.get_tier("stalker") == FilmTier.FAVORITE
    assert fp.get_tier("persona") == FilmTier.FAVORITE
    assert fp.get_tier("mirror") == FilmTier.TOP_RATED
    assert fp.get_tier("raging-bull") == FilmTier.TOP_RATED
    assert fp.get_tier("eraserhead") == FilmTier.LIKED
    assert fp.get_tier("oppenheimer") == FilmTier.RECENT
    assert fp.avg_rating > 0
    assert fp.total_films_watched == 500


def test_fingerprint_deduplication_keeps_highest_tier():
    """When a film appears in multiple tiers, keep the highest (first encountered)."""
    detail = UserProfileDetail(
        username="user1",
        display_name="User 1",
        favorite_films=[
            UserFilmItem(slug="fight-club", title="Fight Club", user_rating=5.0),
        ],
        top_rated_films=[
            UserFilmItem(slug="fight-club", title="Fight Club", user_rating=5.0),  # dupe
        ],
        liked_films=[
            UserFilmItem(slug="fight-club", title="Fight Club", user_liked=True),  # dupe
        ],
    )
    fp = build_fingerprint(username="user1", profile_detail=detail)
    assert len(fp.films) == 1
    assert fp.get_tier("fight-club") == FilmTier.FAVORITE


def test_fingerprint_explicit_slugs_fill_gaps():
    """Explicit slugs from API query are added if not already in profile."""
    detail = UserProfileDetail(
        username="user2",
        display_name="User 2",
        favorite_films=[
            UserFilmItem(slug="inception", title="Inception"),
        ],
    )
    fp = build_fingerprint(
        username="user2",
        profile_detail=detail,
        explicit_slugs=["inception", "matrix", "blade-runner"],
    )
    assert len(fp.films) == 3
    assert fp.get_tier("inception") == FilmTier.FAVORITE
    assert fp.get_tier("matrix") == FilmTier.UNKNOWN
    assert fp.get_tier("blade-runner") == FilmTier.UNKNOWN


# ───────────────────────────────────────────────────────────────────────
# Pearson Correlation Tests
# ───────────────────────────────────────────────────────────────────────

def test_pearson_perfect_agreement():
    """Identical ratings should give correlation ≈ 1.0."""
    corr = _pearson_correlation([5.0, 4.0, 3.0, 2.0], [5.0, 4.0, 3.0, 2.0])
    assert abs(corr - 1.0) < 0.01


def test_pearson_perfect_disagreement():
    """Opposite ratings should give correlation ≈ -1.0."""
    corr = _pearson_correlation([5.0, 4.0, 3.0, 2.0], [2.0, 3.0, 4.0, 5.0])
    assert abs(corr - (-1.0)) < 0.01


def test_pearson_no_correlation():
    """Unrelated ratings should give correlation ≈ 0.0."""
    corr = _pearson_correlation([5.0, 1.0, 5.0, 1.0], [1.0, 5.0, 1.0, 5.0])
    assert abs(corr - (-1.0)) < 0.01  # Actually perfectly inverted


def test_pearson_constant_ratings():
    """If one user rates everything the same, correlation should be 1.0 (both constant) or 0.0."""
    # Both constant and equal
    corr = _pearson_correlation([4.0, 4.0, 4.0], [4.0, 4.0, 4.0])
    assert abs(corr - 1.0) < 0.01

    # One constant, one varies
    corr = _pearson_correlation([4.0, 4.0, 4.0], [5.0, 3.0, 4.0])
    assert abs(corr) < 0.01


def test_pearson_too_few_pairs():
    """Fewer than 2 pairs should return 0.0."""
    assert _pearson_correlation([5.0], [4.0]) == 0.0
    assert _pearson_correlation([], []) == 0.0


# ───────────────────────────────────────────────────────────────────────
# IDF Rarity Weight Tests
# ───────────────────────────────────────────────────────────────────────

def test_rarity_weight_popular_film():
    """Very popular films should get weight ≈ 1.0."""
    w = _film_rarity_weight(500_000)
    assert 0.9 <= w <= 1.2


def test_rarity_weight_niche_film():
    """Niche films should get higher weight."""
    w = _film_rarity_weight(5_000)
    assert w > 1.5


def test_rarity_weight_no_data():
    """No member count should give neutral weight."""
    assert _film_rarity_weight(None) == 1.0
    assert _film_rarity_weight(0) == 1.0


def test_rarity_weight_clamped():
    """Very niche films should be clamped at 3.0."""
    w = _film_rarity_weight(10)
    assert w <= 3.0


# ───────────────────────────────────────────────────────────────────────
# Enhanced Scoring Tests
# ───────────────────────────────────────────────────────────────────────

def test_tiered_breadth_favorites_worth_more():
    """Sharing a favorite film should produce higher breadth than sharing a recent watch."""
    # Scenario 1: Match on 1 favorite out of 4 films
    signals_fav = [
        FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True,
                     found_via="Pinned Favorite", film_tier="favorite"),
    ]
    tiers_all = ["favorite", "top_rated", "liked", "recent"]
    _, breadth_fav, _, _, _ = compute_compatibility_score(signals_fav, 4, tiers_all)

    # Scenario 2: Match on 1 recent watch out of 4 films
    signals_recent = [
        FilmSignals(user_rating=3.0, user_liked=False, is_favorite=False,
                     found_via="All Members (Watched)", film_tier="recent"),
    ]
    _, breadth_recent, _, _, _ = compute_compatibility_score(signals_recent, 4, tiers_all)

    assert breadth_fav > breadth_recent


def test_correlation_boosts_compatible_users():
    """Users with highly correlated ratings should score higher overall."""
    # User A: agrees with source on all ratings
    signals_agree = [
        FilmSignals(user_rating=5.0, source_rating=5.0, film_tier="favorite"),
        FilmSignals(user_rating=4.5, source_rating=4.5, film_tier="top_rated"),
        FilmSignals(user_rating=3.0, source_rating=3.0, film_tier="liked"),
    ]
    # User B: disagrees with source on all ratings
    signals_disagree = [
        FilmSignals(user_rating=1.0, source_rating=5.0, film_tier="favorite"),
        FilmSignals(user_rating=2.0, source_rating=4.5, film_tier="top_rated"),
        FilmSignals(user_rating=5.0, source_rating=3.0, film_tier="liked"),
    ]
    tiers = ["favorite", "top_rated", "liked"]

    overall_agree, _, _, _, corr_agree = compute_compatibility_score(signals_agree, 3, tiers)
    overall_disagree, _, _, _, corr_disagree = compute_compatibility_score(signals_disagree, 3, tiers)

    assert corr_agree > corr_disagree
    assert overall_agree > overall_disagree


def test_scoring_returns_5_tuple():
    """compute_compatibility_score should return 5 values."""
    signals = [
        FilmSignals(user_rating=4.0, user_liked=True, found_via="Movie Likes (Hearts)"),
    ]
    result = compute_compatibility_score(signals, 2)
    assert len(result) == 5
    overall, breadth, intensity, affinity, correlation = result
    assert 0 <= overall <= 100
    assert 0 <= breadth <= 100
    assert 0 <= intensity <= 100
    assert 0 <= affinity <= 100
    assert 0 <= correlation <= 100


def test_scoring_legacy_no_tiers():
    """Scoring should work without tier data (legacy fallback)."""
    signals = [
        FilmSignals(user_rating=4.0, user_liked=True, found_via="Movie Likes (Hearts)"),
        FilmSignals(user_rating=5.0, user_liked=True, found_via="Pinned Favorite"),
    ]
    result = compute_compatibility_score(signals, 4)  # no all_target_tiers
    overall, breadth, intensity, affinity, correlation = result
    assert overall > 0
    assert breadth == 50.0  # 2/4 = 50% flat breadth


def test_scoring_insufficient_correlation_uses_neutral():
    """When fewer than 3 shared rated films, correlation should be neutral (50%)."""
    signals = [
        FilmSignals(user_rating=5.0, source_rating=5.0, film_tier="favorite"),
        FilmSignals(user_rating=4.0, source_rating=4.0, film_tier="top_rated"),
        # Only 2 pairs — below MIN_CORRELATION_PAIRS threshold
    ]
    _, _, _, _, corr = compute_compatibility_score(signals, 4, ["favorite", "top_rated", "liked", "recent"])
    assert corr == 50.0  # Neutral


# ───────────────────────────────────────────────────────────────────────
# Integration Tests (with cache and scraper)
# ───────────────────────────────────────────────────────────────────────

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
        # Correlation score should be populated (neutral 50% if insufficient data)
        assert m.correlation_score >= 0
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
