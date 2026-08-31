"""Data models for movie-match using Pydantic v2."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class SentimentType(str, Enum):
    LIKED = "liked"
    DISLIKED = "disliked"
    ALL = "all"
    CUSTOM = "custom"


class UserProfile(BaseModel):
    username: str
    display_name: str = ""
    location: str = ""
    bio: str = ""
    avatar_url: str = ""
    profile_url: str = ""
    is_pro: bool = False
    is_patron: bool = False
    favorite_films: List["UserFilmItem"] = Field(default_factory=list)
    fetched_at: Optional[float] = None


class FilmMetadata(BaseModel):
    title: str = ""
    slug: str
    year: Optional[int] = None
    director: Optional[str] = None
    rating: Optional[float] = None
    poster_url: Optional[str] = None
    url: str = ""
    member_count: Optional[int] = None


class UserMatch(BaseModel):
    username: str
    display_name: str = ""
    location: str = ""
    bio: str = ""
    avatar_url: str = ""
    profile_url: str = ""
    matched_location: str = ""
    matched_fields: List[str] = Field(default_factory=list)
    sentiment_type: SentimentType = SentimentType.LIKED
    user_rating: Optional[float] = None
    user_rating_stars: str = ""
    user_liked: Optional[bool] = None
    user_review: Optional[str] = None
    found_via: str = ""


class SearchQuery(BaseModel):
    film_input: str
    location_query: str = "Anywhere"
    sentiment: SentimentType = SentimentType.LIKED
    rating_range: Optional[str] = None
    include_bio: bool = False
    max_pages: int = 2
    limit_matches: int = 10
    concurrency: int = 15
    source_username: Optional[str] = None


class WaitlistRequest(BaseModel):
    email: str
    feature: Optional[str] = "extended_tier"


class UserFilmItem(BaseModel):
    slug: str
    title: str = ""
    year: Optional[int] = None
    poster_url: Optional[str] = None
    user_rating: Optional[float] = None
    user_rating_stars: str = ""
    user_liked: bool = False
    film_url: str = ""


class UserProfileDetail(UserProfile):
    stats: Dict[str, Any] = Field(default_factory=dict)
    favorite_films: List[UserFilmItem] = Field(default_factory=list)
    recent_films: List[UserFilmItem] = Field(default_factory=list)
    top_rated_films: List[UserFilmItem] = Field(default_factory=list)
    liked_films: List[UserFilmItem] = Field(default_factory=list)


class FilmInteraction(BaseModel):
    film_slug: str
    film_title: str = ""
    user_rating: Optional[float] = None
    user_rating_stars: str = ""
    user_liked: Optional[bool] = None
    user_review: Optional[str] = None
    found_via: str = ""
    is_favorite: bool = False
    film_tier: str = "unknown"  # "favorite" | "top_rated" | "liked" | "recent" | "unknown"


class TasteMatchResult(BaseModel):
    username: str
    display_name: str = ""
    location: str = ""
    bio: str = ""
    avatar_url: str = ""
    profile_url: str = ""
    matched_location: str = ""
    matched_fields: List[str] = Field(default_factory=list)
    shared_films: List[FilmInteraction] = Field(default_factory=list)
    shared_films_count: int = 0
    compatibility_score: float = 0.0
    intensity_score: float = 0.0
    affinity_score: float = 0.0
    correlation_score: float = 0.0
    # Number of films both members rated. Below MIN_CORRELATION_PAIRS the
    # correlation score is a neutral placeholder, not a measurement.
    correlation_pairs: int = 0
    confidence: float = 0.0
    ranking_score: float = 0.0
    total_target_films: int = 0


class MultiFilmMatchQuery(BaseModel):
    films: List[str] = Field(..., max_length=50)
    location_query: str = "Anywhere"
    min_shared_films: int = Field(1, ge=1, le=50)
    sentiment: SentimentType = SentimentType.LIKED
    rating_range: Optional[str] = None
    include_bio: bool = False
    # Depth is what converts the time budget into actual work. With the scan
    # hunting for one strong match under a 180s budget, 2 pages per film runs
    # dry long before the budget does.
    max_pages_per_film: int = Field(6, ge=1, le=20)
    limit_matches: int = Field(10, ge=1, le=500)
    concurrency: int = Field(15, ge=1, le=50)
    source_username: Optional[str] = None

    @model_validator(mode="after")
    def validate_match_request(self) -> "MultiFilmMatchQuery":
        if not self.films:
            return self
        if any(not film.strip() or len(film.strip()) > 200 for film in self.films):
            raise ValueError("Each film must be between 1 and 200 characters")
        if self.min_shared_films > len(self.films):
            raise ValueError("min_shared_films cannot exceed the number of films")
        return self


class ScanStats(BaseModel):
    film_title: str = ""
    film_slug: str = ""
    total_pages_scanned: int = 0
    total_users_discovered: int = 0
    profiles_fetched: int = 0
    cache_hits: int = 0
    matches_count: int = 0
    elapsed_seconds: float = 0.0
    time_to_first_result: Optional[float] = None
    metadata_seconds: float = 0.0
    cache_lookup_seconds: float = 0.0
    parse_seconds: float = 0.0
    upstream_requests: int = 0
    cache_status: str = "miss"
    partial: bool = False
    stop_reason: Optional[str] = None
