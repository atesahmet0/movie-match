"""Weighted multi-signal compatibility scoring for taste matching.

Computes a compatibility score from four orthogonal signals:
  - Breadth      (0.30): tier-weighted fraction of target films the user shares
  - Intensity    (0.20): how passionately they engaged with those films (ratings, likes, favorites)
  - Affinity     (0.15): strength of discovery signal (likes/fans > ratings > generic)
  - Correlation  (0.35): Pearson correlation on shared film ratings (gold standard)

Signals that cannot be measured are dropped and their weight is redistributed
across the signals that could be, so a missing input never masquerades as a
mediocre one. Because dropping a signal makes thin evidence look confident, the
breakdown also carries a `ranking_score` that shrinks toward the neutral prior
when there is little evidence — display `overall`, sort on `ranking_score`.

Plus an IDF-based rarity modifier that boosts niche film overlap.
"""

import math
from typing import Dict, List, NamedTuple, Optional

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

# Intensity fallback for a film the member watched but never rated
DEFAULT_UNRATED_BASELINE = 0.6

# Rarity is a modest bonus on breadth, not a per-film multiplier on the
# numerator alone (which used to let a single niche film saturate breadth).
RARITY_BONUS_MAX = 0.25

# Evidence needed before a score is trusted at face value for ranking.
# Shared films count once; films rated by both sides count half again.
CONFIDENCE_FULL_EVIDENCE = 6.0
NEUTRAL_PRIOR = 0.5


class ScoreBreakdown(NamedTuple):
    """Result of a compatibility computation.

    `overall` is the honest quality score over the signals that could actually
    be measured. `ranking_score` is `overall` shrunk toward NEUTRAL_PRIOR by
    `confidence` and is what results should be sorted by. All score fields are
    percentages in [0, 100]; `confidence` is a fraction in [0, 1].
    """

    overall: float
    breadth: float
    intensity: float
    affinity: float
    correlation: float
    correlation_pairs: int
    confidence: float
    ranking_score: float


def _film_intensity(
    user_rating: Optional[float],
    user_liked: Optional[bool],
    is_favorite: bool,
    unrated_baseline: float = DEFAULT_UNRATED_BASELINE,
) -> float:
    """Compute per-film intensity score in [0, 1].

    Combines rating signal, like signal, and favorite signal.

    `unrated_baseline` stands in for films the member watched but never rated.
    Callers pass this member's own average rating where one is known, so a
    heavy watcher who rarely rates is measured against their own habits rather
    than a constant.
    """
    # Base from rating (if available)
    if user_rating is not None and user_rating > 0:
        base = min(user_rating / 5.0, 1.0)
    else:
        base = unrated_baseline

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
) -> ScoreBreakdown:
    """Compute weighted compatibility score with tier-weighted breadth and rating correlation.

    Args:
        film_signals: Scoring signals for each shared film interaction.
        total_target_films: Total number of target films in the fingerprint.
        all_target_tiers: Tiers of ALL target films (for weighted breadth denominator).
                          If None, falls back to flat breadth.

    Returns: a ScoreBreakdown. Signals with no data behind them are excluded
    from the weighted average rather than imputed, so `overall` answers "of what
    we could measure, how well do these two match".
    """
    if total_target_films <= 0 or not film_signals:
        return ScoreBreakdown(0.0, 0.0, 0.0, 0.0, 0.0, 0, 0.0, 0.0)

    shared_count = len(film_signals)

    # --- Breadth (tier-weighted coverage, with a bounded rarity bonus) ---
    if all_target_tiers:
        weighted_shared = sum(
            TIER_WEIGHTS.get(fs.film_tier, 1.0) for fs in film_signals
        )
        weighted_total = sum(
            TIER_WEIGHTS.get(t, 1.0)
            for t in all_target_tiers
        )
        breadth = weighted_shared / weighted_total if weighted_total > 0 else 0.0
    else:
        # Flat breadth (legacy fallback)
        breadth = shared_count / total_target_films

    # Rarity applies to the whole ratio rather than inflating the numerator
    # against a rarity-free denominator. Averaged over the shared films and
    # capped, so niche overlap is a real edge without saturating breadth.
    rarities = [_film_rarity_weight(fs.member_count) for fs in film_signals]
    avg_rarity = sum(rarities) / len(rarities) if rarities else 1.0
    breadth *= 1.0 + RARITY_BONUS_MAX * (avg_rarity - 1.0) / 2.0

    # Clamp breadth to [0, 1] — the rarity bonus can push it above 1.0
    breadth = min(breadth, 1.0)

    # --- Intensity (average per-film intensity) ---
    # Unrated films fall back to this member's own average rating where we have
    # one, instead of a flat constant that reads as a lukewarm 3 stars.
    own_ratings = [
        fs.user_rating for fs in film_signals
        if fs.user_rating is not None and fs.user_rating > 0
    ]
    unrated_baseline = (
        min(sum(own_ratings) / len(own_ratings) / 5.0, 1.0)
        if own_ratings
        else DEFAULT_UNRATED_BASELINE
    )
    intensities = [
        _film_intensity(fs.user_rating, fs.user_liked, fs.is_favorite, unrated_baseline)
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

    correlation_pairs = len(source_ratings)
    has_correlation = correlation_pairs >= MIN_CORRELATION_PAIRS
    if has_correlation:
        raw_corr = _pearson_correlation(source_ratings, candidate_ratings)
        # Map [-1, 1] → [0, 1] for scoring: -1→0, 0→0.5, 1→1.0
        correlation = (raw_corr + 1.0) / 2.0
    else:
        # Not measurable — reported as the neutral prior for display, but left
        # out of the weighted average below so it neither helps nor caps.
        correlation = NEUTRAL_PRIOR

    # --- Weighted composite over the measurable signals only ---
    parts = [
        (W_BREADTH, breadth),
        (W_INTENSITY, intensity),
        (W_AFFINITY, affinity),
    ]
    if has_correlation:
        parts.append((W_CORRELATION, correlation))

    total_weight = sum(w for w, _ in parts)
    raw = sum(w * v for w, v in parts) / total_weight if total_weight > 0 else 0.0

    # --- Confidence and shrunk ranking score ---
    # Renormalising lifts thin matches, so rank on a score pulled back toward
    # the neutral prior until there is enough evidence to justify it.
    evidence = shared_count + 0.5 * correlation_pairs
    confidence = min(1.0, evidence / CONFIDENCE_FULL_EVIDENCE)
    ranking = NEUTRAL_PRIOR + (raw - NEUTRAL_PRIOR) * confidence

    return ScoreBreakdown(
        overall=round(min(raw * 100, 100.0), 1),
        breadth=round(breadth * 100, 1),
        intensity=round(intensity * 100, 1),
        affinity=round(affinity * 100, 1),
        correlation=round(correlation * 100, 1),
        correlation_pairs=correlation_pairs,
        confidence=round(confidence, 3),
        ranking_score=round(min(ranking * 100, 100.0), 1),
    )
