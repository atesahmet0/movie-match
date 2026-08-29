"""Weighted multi-signal compatibility scoring for taste matching.

Computes a compatibility score from three orthogonal signals:
  - Breadth  (0.40): fraction of target films the user has interacted with
  - Intensity (0.35): how passionately they engaged with those films (ratings, likes, favorites)
  - Affinity  (0.25): strength of discovery signal (likes/fans > ratings > generic)
"""

from typing import List, Optional

# Weights — sum to 1.0
W_BREADTH = 0.40
W_INTENSITY = 0.35
W_AFFINITY = 0.25

# Discovery-source affinity bonuses (higher = stronger signal)
AFFINITY_MAP = {
    "Pinned Favorite": 1.0,
    "Pinned 4 Favorites": 1.0,
    "Top 4 Favorite Fans": 0.95,
    "Movie Likes (Hearts)": 0.90,
    "Highest Rated Reviews": 0.80,
    "User Library / Liked": 0.75,
    "Rated 4.0 - 5.0 Stars": 0.70,
    "Rated 5 stars": 0.85,
    "Rated 4.5 stars": 0.80,
    "Rated 4-5 stars": 0.70,
    "Rated 0.5 - 2.0 Stars (Disliked)": 0.30,
    "Lowest Rated Reviews": 0.25,
    "All Members (Watched)": 0.50,
    "All Member Ratings": 0.50,
}
DEFAULT_AFFINITY = 0.50


def _film_intensity(
    user_rating: Optional[float],
    user_liked: Optional[bool],
    is_favorite: bool,
) -> float:
    """Compute per-film intensity score in [0, 1].

    Combines rating signal, like signal, and favorite signal.
    """
    # Base from rating (if available)
    if user_rating is not None and user_rating > 0:
        base = min(user_rating / 5.0, 1.0)
    else:
        # Unknown rating — assign neutral baseline
        base = 0.6

    # Liked bonus
    if user_liked:
        base += 0.15

    # Pinned favorite bonus (strongest signal)
    if is_favorite:
        base += 0.25

    return min(base, 1.0)


def _film_affinity(found_via: str) -> float:
    """Map discovery source to an affinity score in [0, 1]."""
    if not found_via:
        return DEFAULT_AFFINITY

    # Check exact match first
    if found_via in AFFINITY_MAP:
        return AFFINITY_MAP[found_via]

    # Fuzzy match for custom rating strings like "Rated 4.5 stars"
    found_lower = found_via.lower()
    if "favorite" in found_lower or "pinned" in found_lower:
        return 1.0
    if "like" in found_lower or "heart" in found_lower:
        return 0.90
    if "fan" in found_lower:
        return 0.95
    if "review" in found_lower:
        return 0.75
    if "rated" in found_lower:
        return 0.70

    return DEFAULT_AFFINITY


class FilmSignals:
    """Holds the scoring signals for a single film interaction."""

    __slots__ = ("user_rating", "user_liked", "is_favorite", "found_via")

    def __init__(
        self,
        user_rating: Optional[float] = None,
        user_liked: Optional[bool] = None,
        is_favorite: bool = False,
        found_via: str = "",
    ):
        self.user_rating = user_rating
        self.user_liked = user_liked
        self.is_favorite = is_favorite
        self.found_via = found_via


def compute_compatibility_score(
    film_signals: List[FilmSignals],
    total_target_films: int,
) -> tuple[float, float, float, float]:
    """Compute weighted compatibility score.

    Returns: (overall_score, breadth_score, intensity_score, affinity_score)
    All values are percentages in [0, 100].
    """
    if total_target_films <= 0 or not film_signals:
        return (0.0, 0.0, 0.0, 0.0)

    shared_count = len(film_signals)

    # --- Breadth ---
    breadth = shared_count / total_target_films  # [0, 1]

    # --- Intensity (average per-film intensity) ---
    intensities = [
        _film_intensity(fs.user_rating, fs.user_liked, fs.is_favorite)
        for fs in film_signals
    ]
    intensity = sum(intensities) / len(intensities) if intensities else 0.0

    # --- Affinity (average per-film discovery affinity) ---
    affinities = [_film_affinity(fs.found_via) for fs in film_signals]
    affinity = sum(affinities) / len(affinities) if affinities else 0.0

    # --- Weighted composite ---
    raw = (W_BREADTH * breadth) + (W_INTENSITY * intensity) + (W_AFFINITY * affinity)

    # Scale to percentage and clamp
    overall = round(min(raw * 100, 100.0), 1)
    breadth_pct = round(breadth * 100, 1)
    intensity_pct = round(intensity * 100, 1)
    affinity_pct = round(affinity * 100, 1)

    return (overall, breadth_pct, intensity_pct, affinity_pct)
