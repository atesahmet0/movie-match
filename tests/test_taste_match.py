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
    breadth_fav = compute_compatibility_score(signals_fav, 4, tiers_all).breadth

    # Scenario 2: Match on 1 recent watch out of 4 films
    signals_recent = [
        FilmSignals(user_rating=3.0, user_liked=False, is_favorite=False,
                     found_via="All Members (Watched)", film_tier="recent"),
    ]
    breadth_recent = compute_compatibility_score(signals_recent, 4, tiers_all).breadth

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

    agree = compute_compatibility_score(signals_agree, 3, tiers)
    disagree = compute_compatibility_score(signals_disagree, 3, tiers)

    assert agree.correlation > disagree.correlation
    assert agree.overall > disagree.overall


def test_scoring_returns_full_breakdown():
    """compute_compatibility_score should return a complete ScoreBreakdown."""
    signals = [
        FilmSignals(user_rating=4.0, user_liked=True, found_via="Movie Likes (Hearts)"),
    ]
    result = compute_compatibility_score(signals, 2)
    assert 0 <= result.overall <= 100
    assert 0 <= result.breadth <= 100
    assert 0 <= result.intensity <= 100
    assert 0 <= result.affinity <= 100
    assert 0 <= result.correlation <= 100
    assert result.correlation_pairs == 0
    assert 0 <= result.confidence <= 1
    assert 0 <= result.ranking_score <= 100


def test_scoring_legacy_no_tiers():
    """Scoring should work without tier data (legacy fallback)."""
    signals = [
        FilmSignals(user_rating=4.0, user_liked=True, found_via="Movie Likes (Hearts)"),
        FilmSignals(user_rating=5.0, user_liked=True, found_via="Pinned Favorite"),
    ]
    result = compute_compatibility_score(signals, 4)  # no all_target_tiers
    assert result.overall > 0
    assert result.breadth == 50.0  # 2/4 = 50% flat breadth


def test_scoring_insufficient_correlation_reports_placeholder():
    """Below 3 shared rated films correlation is a placeholder, not a measurement.

    It is reported as the neutral 50% for display but excluded from the
    weighted average, so it neither helps nor caps the score.
    """
    signals = [
        FilmSignals(user_rating=5.0, source_rating=5.0, film_tier="favorite"),
        FilmSignals(user_rating=4.0, source_rating=4.0, film_tier="top_rated"),
        # Only 2 pairs — below MIN_CORRELATION_PAIRS threshold
    ]
    result = compute_compatibility_score(signals, 4, ["favorite", "top_rated", "liked", "recent"])
    assert result.correlation == 50.0  # Neutral placeholder
    assert result.correlation_pairs == 2


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
    p_detail = UserProfileDetail(
        username="testuser",
        display_name="Test User",
        location="Ankara",
        bio="",
        favorite_films=favs,
        top_rated_films=[],
        liked_films=[],
        recent_films=[],
    )
    await cache.save_user_profile_detail(p_detail)

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


@pytest.mark.asyncio
async def test_source_fingerprint_does_not_expand_candidate_discovery(tmp_path):
    """Profile history may affect scoring, but only explicitly selected films are scanned."""
    cache = CacheDB(db_path=tmp_path / "discovery_scope.db", ttl_seconds=1000)
    await cache.init()

    source = UserProfileDetail(
        username="source",
        favorite_films=[UserFilmItem(slug="alien", title="Alien")],
        top_rated_films=[
            UserFilmItem(slug="hidden-gem", title="Hidden Gem", user_rating=5.0)
        ],
    )
    await cache.save_user_profile_detail(source)
    for slug in ("alien", "hidden-gem"):
        await cache.save_film_metadata(FilmMetadata(slug=slug, title=slug.title()))
        await cache.save_film_page(slug, f"film/{slug}/likes/", 1, [])
        await cache.save_film_page(slug, f"film/{slug}/ratings/rated/4-5/", 1, [])

    # This candidate is discoverable only through the expanded fingerprint film.
    await cache.save_film_page(
        "hidden-gem",
        "film/hidden-gem/likes/",
        1,
        [{"username": "should-not-be-scanned", "user_rating": 5.0, "user_liked": True}],
    )

    async with LetterboxdScraper(cache=cache) as scraper:
        matches, stats = await scraper.find_taste_matches(
            MultiFilmMatchQuery(
                films=["alien"],
                source_username="source",
                max_pages_per_film=1,
            )
        )

    assert matches == []
    assert stats.total_pages_scanned == 2
    await cache.close()


@pytest.mark.asyncio
async def test_taste_search_returns_partial_results_at_profile_budget(
    tmp_path, monkeypatch
):
    cache = CacheDB(db_path=tmp_path / "profile_budget.db", ttl_seconds=1000)
    await cache.init()
    await cache.save_film_metadata(FilmMetadata(slug="alien", title="Alien"))
    candidates = [
        {"username": f"viewer-{index}", "user_rating": 4.5, "user_liked": True}
        for index in range(30)
    ]
    await cache.save_film_page("alien", "film/alien/likes/", 1, candidates)
    await cache.save_film_page("alien", "film/alien/ratings/rated/4-5/", 1, [])
    monkeypatch.setenv("SEARCH_MAX_PROFILE_FETCHES", "25")

    async with LetterboxdScraper(cache=cache) as scraper:
        async def blocked_profile(_url):
            return None

        monkeypatch.setattr(scraper.client, "get", blocked_profile)
        matches, stats = await scraper.find_taste_matches(
            MultiFilmMatchQuery(films=["alien"], max_pages_per_film=1)
        )

    assert matches == []
    assert stats.partial is True
    assert stats.stop_reason == "profile_budget"
    assert stats.profiles_fetched == 25
    await cache.close()
