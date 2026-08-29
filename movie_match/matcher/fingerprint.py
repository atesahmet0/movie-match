"""Taste fingerprint builder — assembles a rich film pool from a user's Letterboxd activity.

Expands the matching universe from pinned favorites (≤4) to a tiered set of 15-30 films,
each tagged with an importance tier for weighted scoring.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set

from movie_match.models import UserFilmItem, UserProfileDetail


class FilmTier(str, Enum):
    """Importance tier for a film in the taste fingerprint."""
    FAVORITE = "favorite"       # Pinned favorites — strongest signal
    TOP_RATED = "top_rated"     # ★4.5-5 rated — very strong
    LIKED = "liked"             # ❤️ hearted — strong
    RECENT = "recent"           # Recently watched — moderate
    UNKNOWN = "unknown"         # Discovered via scraping, no tier info


# Weights for each tier when computing breadth score
TIER_WEIGHTS: Dict[str, float] = {
    FilmTier.FAVORITE: 3.0,
    FilmTier.TOP_RATED: 2.0,
    FilmTier.LIKED: 1.5,
    FilmTier.RECENT: 1.0,
    FilmTier.UNKNOWN: 1.0,
}

# Max films to pull from each tier
TIER_LIMITS: Dict[str, int] = {
    FilmTier.FAVORITE: 4,       # All pinned favorites
    FilmTier.TOP_RATED: 8,      # Top 8 highest-rated
    FilmTier.LIKED: 6,          # Top 6 liked
    FilmTier.RECENT: 4,         # Last 4 recent watches
}


@dataclass
class FingerprintFilm:
    """A film in the taste fingerprint with tier and optional rating."""
    slug: str
    title: str = ""
    tier: str = FilmTier.UNKNOWN
    user_rating: Optional[float] = None
    user_liked: bool = False


@dataclass
class TasteFingerprint:
    """Rich taste profile derived from a user's Letterboxd activity."""
    username: str
    films: List[FingerprintFilm] = field(default_factory=list)
    avg_rating: float = 0.0
    total_films_watched: int = 0

    @property
    def film_slugs(self) -> List[str]:
        """All film slugs in the fingerprint."""
        return [f.slug for f in self.films]

    @property
    def core_slugs(self) -> Set[str]:
        """High-signal films only (favorites + top rated)."""
        return {f.slug for f in self.films if f.tier in (FilmTier.FAVORITE, FilmTier.TOP_RATED)}

    def get_tier(self, slug: str) -> str:
        """Get the tier for a film slug."""
        for f in self.films:
            if f.slug == slug:
                return f.tier
        return FilmTier.UNKNOWN

    def get_source_rating(self, slug: str) -> Optional[float]:
        """Get the source user's rating for a film, if known."""
        for f in self.films:
            if f.slug == slug:
                return f.user_rating
        return None


def build_fingerprint(
    username: str,
    profile_detail: Optional[UserProfileDetail] = None,
    favorite_films: Optional[List[UserFilmItem]] = None,
    explicit_slugs: Optional[List[str]] = None,
) -> TasteFingerprint:
    """Build a TasteFingerprint from available user data.

    Priority order for film inclusion:
    1. Pinned favorites (highest weight)
    2. Top-rated films (★4.5+)
    3. Liked films (❤️)
    4. Recent watches
    5. Explicit slugs (from the API query, if no profile available)

    Deduplicates by slug, keeping the highest-tier occurrence.
    """
    seen_slugs: Set[str] = set()
    films: List[FingerprintFilm] = []

    def _add_films(items: List[UserFilmItem], tier: str, limit: int) -> None:
        """Add films from a list, respecting dedup and limit."""
        added = 0
        for item in items:
            if added >= limit:
                break
            if item.slug and item.slug not in seen_slugs:
                seen_slugs.add(item.slug)
                films.append(FingerprintFilm(
                    slug=item.slug,
                    title=item.title or item.slug.replace("-", " ").title(),
                    tier=tier,
                    user_rating=item.user_rating,
                    user_liked=item.user_liked,
                ))
                added += 1

    # 1. Pinned favorites
    fav_source = (
        profile_detail.favorite_films if profile_detail and profile_detail.favorite_films
        else favorite_films or []
    )
    _add_films(fav_source, FilmTier.FAVORITE, TIER_LIMITS[FilmTier.FAVORITE])

    if profile_detail:
        # 2. Top-rated films (★4.5+)
        top_rated = [
            f for f in (profile_detail.top_rated_films or [])
            if f.user_rating is not None and f.user_rating >= 4.5
        ]
        # Sort by rating descending
        top_rated.sort(key=lambda f: f.user_rating or 0, reverse=True)
        _add_films(top_rated, FilmTier.TOP_RATED, TIER_LIMITS[FilmTier.TOP_RATED])

        # 3. Liked films
        _add_films(
            profile_detail.liked_films or [],
            FilmTier.LIKED,
            TIER_LIMITS[FilmTier.LIKED],
        )

        # 4. Recent watches
        _add_films(
            profile_detail.recent_films or [],
            FilmTier.RECENT,
            TIER_LIMITS[FilmTier.RECENT],
        )

    # 5. Fallback: explicit slugs from the API query
    if explicit_slugs:
        for slug in explicit_slugs:
            if slug and slug not in seen_slugs:
                seen_slugs.add(slug)
                films.append(FingerprintFilm(
                    slug=slug,
                    title=slug.replace("-", " ").title(),
                    tier=FilmTier.UNKNOWN,
                ))

    # Compute average rating from films that have ratings
    rated_films = [f for f in films if f.user_rating is not None and f.user_rating > 0]
    avg_rating = sum(f.user_rating for f in rated_films) / len(rated_films) if rated_films else 0.0

    # Total watched count from profile stats
    total_watched = 0
    if profile_detail and profile_detail.stats:
        raw = profile_detail.stats.get("films", 0)
        if isinstance(raw, str):
            total_watched = int(raw.replace(",", "").replace(".", "")) if raw.replace(",", "").replace(".", "").isdigit() else 0
        else:
            total_watched = int(raw) if raw else 0

    return TasteFingerprint(
        username=username,
        films=films,
        avg_rating=avg_rating,
        total_films_watched=total_watched,
    )
