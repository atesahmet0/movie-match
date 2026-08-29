"""Weighted multi-signal compatibility scoring for taste matching.

Computes a compatibility score from four orthogonal signals:
  - Breadth      (0.30): tier-weighted fraction of target films the user shares
  - Intensity    (0.20): how passionately they engaged with those films (ratings, likes, favorites)
  - Affinity     (0.15): strength of discovery signal (likes/fans > ratings > generic)
  - Correlation  (0.35): Pearson correlation on shared film ratings (gold standard)

Plus an IDF-based rarity modifier that boosts niche film overlap.
"""

import math
from typing import Dict, List, Optional, Tuple

# Weights — sum to 1.0
W_BREADTH = 0.30
W_INTENSITY = 0.20
W_AFFINITY = 0.15
W_CORRELATION = 0.35

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

# Tier weights for breadth calculation
TIER_WEIGHTS: Dict[str, float] = {
    "favorite": 3.0,
    "top_rated": 2.0,
    "liked": 1.5,
    "recent": 1.0,
    "unknown": 1.0,
}

# Minimum shared rated films for Pearson correlation to be meaningful
MIN_CORRELATION_PAIRS = 3


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


def _pearson_correlation(
    ratings_a: List[float],
    ratings_b: List[float],
) -> float:
    """Compute Pearson correlation coefficient between two rating vectors.

    Returns a value in [-1, 1]:
      +1 = perfect agreement
       0 = no correlation
      -1 = perfect disagreement

    Requires len(ratings_a) == len(ratings_b) >= 2.
    """
    n = len(ratings_a)
    if n < 2:
        return 0.0

    mean_a = sum(ratings_a) / n
    mean_b = sum(ratings_b) / n

    # Compute covariance and std devs
    cov = sum((a - mean_a) * (b - mean_b) for a, b in zip(ratings_a, ratings_b))
    std_a = math.sqrt(sum((a - mean_a) ** 2 for a in ratings_a))
    std_b = math.sqrt(sum((b - mean_b) ** 2 for b in ratings_b))

    # Avoid division by zero (all same rating)
    if std_a < 1e-9 or std_b < 1e-9:
        # If both users gave the same rating to everything, that's perfect agreement
        if std_a < 1e-9 and std_b < 1e-9:
            return 1.0
        return 0.0

    return cov / (std_a * std_b)


def _film_rarity_weight(member_count: Optional[int]) -> float:
    """IDF-style rarity weight for a film.

    Films with fewer members on Letterboxd carry more matching weight.
    Uses log-IDF with a smoothing constant.

    Returns a multiplier in [1.0, ~3.0]:
      - Very popular film (500k+ members): ~1.0x
      - Moderate popularity (50k members):  ~1.5x
      - Niche film (5k members):            ~2.0x
      - Very niche (<1k members):           ~2.5x
    """
    if member_count is None or member_count <= 0:
        return 1.0  # No data, use neutral weight

    # IDF-inspired: log(reference_pop / actual_pop)
    # Using 500k as reference (approximate Letterboxd mainstream threshold)
    reference = 500_000
    raw = math.log(reference / max(member_count, 100))  # floor at 100 to avoid explosion
    # Clamp to [1.0, 3.0]
    return max(1.0, min(raw + 1.0, 3.0))


class FilmSignals:
    """Holds the scoring signals for a single film interaction."""

    __slots__ = (
        "user_rating", "user_liked", "is_favorite", "found_via",
        "film_tier", "source_rating", "member_count",
    )

    def __init__(
        self,
        user_rating: Optional[float] = None,
        user_liked: Optional[bool] = None,
        is_favorite: bool = False,
        found_via: str = "",
        film_tier: str = "unknown",
        source_rating: Optional[float] = None,
        member_count: Optional[int] = None,
    ):
        self.user_rating = user_rating
        self.user_liked = user_liked
        self.is_favorite = is_favorite
        self.found_via = found_via
        self.film_tier = film_tier
        self.source_rating = source_rating
        self.member_count = member_count


def compute_compatibility_score(
    film_signals: List[FilmSignals],
    total_target_films: int,
    all_target_tiers: Optional[List[str]] = None,
) -> Tuple[float, float, float, float, float]:
    """Compute weighted compatibility score with tier-weighted breadth and rating correlation.

    Args:
        film_signals: Scoring signals for each shared film interaction.
        total_target_films: Total number of target films in the fingerprint.
        all_target_tiers: Tiers of ALL target films (for weighted breadth denominator).
                          If None, falls back to flat breadth.

    Returns: (overall_score, breadth_score, intensity_score, affinity_score, correlation_score)
    All values are percentages in [0, 100].
    """
    if total_target_films <= 0 or not film_signals:
        return (0.0, 0.0, 0.0, 0.0, 0.0)

    shared_count = len(film_signals)

    # --- Breadth (tier-weighted) ---
    if all_target_tiers:
        weighted_shared = sum(
            TIER_WEIGHTS.get(fs.film_tier, 1.0) * _film_rarity_weight(fs.member_count)
            for fs in film_signals
        )
        weighted_total = sum(
            TIER_WEIGHTS.get(t, 1.0)
            for t in all_target_tiers
        )
        breadth = weighted_shared / weighted_total if weighted_total > 0 else 0.0
    else:
        # Flat breadth (legacy fallback)
        breadth = shared_count / total_target_films

    # Clamp breadth to [0, 1] — rarity can push it above 1.0
    breadth = min(breadth, 1.0)

    # --- Intensity (average per-film intensity) ---
    intensities = [
        _film_intensity(fs.user_rating, fs.user_liked, fs.is_favorite)
        for fs in film_signals
    ]
    intensity = sum(intensities) / len(intensities) if intensities else 0.0

    # --- Affinity (average per-film discovery affinity) ---
    affinities = [_film_affinity(fs.found_via) for fs in film_signals]
    affinity = sum(affinities) / len(affinities) if affinities else 0.0

    # --- Correlation (Pearson on shared ratings) ---
    # Collect pairs where both source and candidate have ratings
    source_ratings = []
    candidate_ratings = []
    for fs in film_signals:
        if (
            fs.source_rating is not None and fs.source_rating > 0
            and fs.user_rating is not None and fs.user_rating > 0
        ):
            source_ratings.append(fs.source_rating)
            candidate_ratings.append(fs.user_rating)

    if len(source_ratings) >= MIN_CORRELATION_PAIRS:
        raw_corr = _pearson_correlation(source_ratings, candidate_ratings)
        # Map [-1, 1] → [0, 1] for scoring: -1→0, 0→0.5, 1→1.0
        correlation = (raw_corr + 1.0) / 2.0
    else:
        # Insufficient data — use a neutral estimate based on intensity
        # (if they rate films highly that the source also rates highly, assume mild correlation)
        correlation = 0.5  # Neutral — doesn't help or hurt

    # --- Weighted composite ---
    raw = (
        W_BREADTH * breadth
        + W_INTENSITY * intensity
        + W_AFFINITY * affinity
        + W_CORRELATION * correlation
    )

    # Scale to percentage and clamp
    overall = round(min(raw * 100, 100.0), 1)
    breadth_pct = round(breadth * 100, 1)
    intensity_pct = round(intensity * 100, 1)
    affinity_pct = round(affinity * 100, 1)
    correlation_pct = round(correlation * 100, 1)

    return (overall, breadth_pct, intensity_pct, affinity_pct, correlation_pct)
