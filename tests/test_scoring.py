"""Unit tests for the weighted compatibility scoring model."""

import pytest
from movie_match.matcher.scoring import (
    FilmSignals,
    compute_compatibility_score,
    _film_intensity,
    _film_affinity,
)


# ======================== _film_intensity tests ========================


class TestFilmIntensity:
    def test_high_rating_liked_favorite(self):
        """5★ + liked + favorite should cap at 1.0."""
        result = _film_intensity(5.0, True, True)
        assert result == 1.0

    def test_high_rating_only(self):
        """5★ with no like/favorite = 1.0 (5/5)."""
        result = _film_intensity(5.0, False, False)
        assert result == 1.0

    def test_medium_rating_liked(self):
        """3.5★ + liked = 0.7 + 0.15 = 0.85."""
        result = _film_intensity(3.5, True, False)
        assert result == pytest.approx(0.85, abs=0.01)

    def test_low_rating_no_like(self):
        """1.0★ = 0.2."""
        result = _film_intensity(1.0, False, False)
        assert result == pytest.approx(0.2, abs=0.01)

    def test_unknown_rating_neutral(self):
        """No rating = baseline 0.6."""
        result = _film_intensity(None, False, False)
        assert result == pytest.approx(0.6, abs=0.01)

    def test_unknown_rating_but_liked(self):
        """No rating + liked = 0.6 + 0.15 = 0.75."""
        result = _film_intensity(None, True, False)
        assert result == pytest.approx(0.75, abs=0.01)

    def test_unknown_rating_but_favorite(self):
        """No rating + favorite = 0.6 + 0.25 = 0.85."""
        result = _film_intensity(None, False, True)
        assert result == pytest.approx(0.85, abs=0.01)

    def test_capped_at_one(self):
        """Ensure intensity never exceeds 1.0 even with all bonuses."""
        result = _film_intensity(5.0, True, True)
        assert result <= 1.0


# ======================== _film_affinity tests ========================


class TestFilmAffinity:
    def test_pinned_favorite(self):
        assert _film_affinity("Pinned Favorite") == 1.0

    def test_movie_likes(self):
        assert _film_affinity("Movie Likes (Hearts)") == 0.90

    def test_rated_4_5(self):
        assert _film_affinity("Rated 4.0 - 5.0 Stars") == 0.70

    def test_unknown_source(self):
        assert _film_affinity("Something Unknown") == 0.50

    def test_empty_source(self):
        assert _film_affinity("") == 0.50

    def test_fuzzy_like_match(self):
        """Should match via fuzzy 'like' keyword."""
        assert _film_affinity("Liked by many") == 0.90


# ======================== compute_compatibility_score tests ========================


class TestComputeCompatibilityScore:
    def test_empty_signals(self):
        overall, breadth, intensity, affinity = compute_compatibility_score([], 4)
        assert overall == 0.0
        assert breadth == 0.0

    def test_zero_target_films(self):
        signals = [FilmSignals(user_rating=5.0)]
        overall, _, _, _ = compute_compatibility_score(signals, 0)
        assert overall == 0.0

    def test_perfect_match_all_favorites(self):
        """User has all 4 target films as favorites with 5★ ratings."""
        signals = [
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Pinned Favorite"),
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Pinned Favorite"),
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Pinned Favorite"),
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Pinned Favorite"),
        ]
        overall, breadth, intensity, affinity = compute_compatibility_score(signals, 4)
        assert breadth == 100.0
        assert intensity == 100.0
        assert affinity == 100.0
        assert overall == 100.0

    def test_partial_overlap_high_intensity(self):
        """User matched 2/4 films but rated them both 5★ and liked."""
        signals = [
            FilmSignals(user_rating=5.0, user_liked=True, found_via="Movie Likes (Hearts)"),
            FilmSignals(user_rating=5.0, user_liked=True, found_via="Movie Likes (Hearts)"),
        ]
        overall, breadth, intensity, affinity = compute_compatibility_score(signals, 4)
        assert breadth == 50.0
        assert intensity == 100.0  # capped at 1.0 per film
        assert overall > 50.0  # intensity and affinity should push it above pure breadth

    def test_full_overlap_low_intensity(self):
        """User matched 4/4 films but rated them all 2★, no likes."""
        signals = [
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
        ]
        overall, breadth, intensity, affinity = compute_compatibility_score(signals, 4)
        assert breadth == 100.0
        assert intensity < 50.0  # low ratings
        assert overall < 80.0  # pulled down by low intensity

    def test_passionate_fan_beats_casual_watcher(self):
        """A user with 2/4 films rated 5★ + favorites should outscore 4/4 films rated 2★."""
        passionate = [
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Movie Likes (Hearts)"),
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Pinned Favorite"),
        ]
        casual = [
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
            FilmSignals(user_rating=2.0, found_via="All Member Ratings"),
        ]
        passionate_score, _, _, _ = compute_compatibility_score(passionate, 4)
        casual_score, _, _, _ = compute_compatibility_score(casual, 4)
        assert passionate_score > casual_score, (
            f"Passionate fan ({passionate_score}) should beat casual watcher ({casual_score})"
        )

    def test_single_film_query(self):
        """With only 1 target film, breadth = 100% if matched."""
        signals = [FilmSignals(user_rating=4.0, user_liked=True, found_via="Movie Likes (Hearts)")]
        overall, breadth, _, _ = compute_compatibility_score(signals, 1)
        assert breadth == 100.0
        assert overall > 80.0

    def test_score_never_exceeds_100(self):
        """Score should never exceed 100 regardless of inputs."""
        signals = [
            FilmSignals(user_rating=5.0, user_liked=True, is_favorite=True, found_via="Pinned Favorite")
            for _ in range(10)
        ]
        overall, _, _, _ = compute_compatibility_score(signals, 5)
        assert overall <= 100.0
