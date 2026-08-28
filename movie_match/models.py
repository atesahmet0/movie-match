"""Data models for movie-match using Pydantic v2."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, HttpUrl


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
    fetched_at: Optional[float] = None


class FilmMetadata(BaseModel):
    title: str = ""
    slug: str
    year: Optional[int] = None
    director: Optional[str] = None
    rating: Optional[float] = None
    poster_url: Optional[str] = None
    url: str = ""


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
    include_bio: bool = True
    max_pages: int = 5
    limit_matches: int = 50
    concurrency: int = 15


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
    total_target_films: int = 0


class MultiFilmMatchQuery(BaseModel):
    films: List[str]
    location_query: str = "Anywhere"
    min_shared_films: int = 1
    sentiment: SentimentType = SentimentType.LIKED
    rating_range: Optional[str] = None
    include_bio: bool = True
    max_pages_per_film: int = 3
    limit_matches: int = 50
    concurrency: int = 15


class ScanStats(BaseModel):
    film_title: str = ""
    film_slug: str = ""
    total_pages_scanned: int = 0
    total_users_discovered: int = 0
    profiles_fetched: int = 0
    cache_hits: int = 0
    matches_count: int = 0
    elapsed_seconds: float = 0.0

