"""Sentiment mapping and rating extraction for Letterboxd films."""

import re
from typing import List, Optional, Tuple
from movie_match.models import SentimentType


class SentimentPlan:
    """Defines endpoint strategy and rating criteria based on sentiment or rating filter."""

    def __init__(
        self,
        sentiment: SentimentType = SentimentType.LIKED,
        custom_rating: Optional[str] = None
    ):
        self.sentiment = sentiment
        self.custom_rating = custom_rating

    def get_film_endpoints(self, film_slug: str) -> List[Tuple[str, str]]:
        """
        Returns list of (endpoint_url_suffix, description) to scan.
        """
        clean_slug = film_slug.strip("/").split("/")[-1]

        if self.custom_rating:
            # Custom rating range (e.g. 5, 4.5, 4-5, 0.5-2)
            r = self.custom_rating.strip()
            return [
                (f"film/{clean_slug}/ratings/rated/{r}/", f"Rated {r} stars"),
                (f"film/{clean_slug}/reviews/rated/{r}/", f"Reviews rated {r} stars"),
            ]

        if self.sentiment == SentimentType.LIKED:
            return [
                (f"film/{clean_slug}/likes/", "Movie Likes (Hearts)"),
                (f"film/{clean_slug}/ratings/rated/4-5/", "Rated 4.0 - 5.0 Stars"),
                (f"film/{clean_slug}/fans/", "Top 4 Favorite Fans"),
                (f"film/{clean_slug}/reviews/by/rating/", "Highest Rated Reviews"),
            ]

        elif self.sentiment == SentimentType.DISLIKED:
            return [
                (f"film/{clean_slug}/ratings/rated/0.5-2/", "Rated 0.5 - 2.0 Stars (Disliked)"),
                (f"film/{clean_slug}/reviews/by/rating-lowest/", "Lowest Rated Reviews"),
            ]

        elif self.sentiment == SentimentType.ALL:
            return [
                (f"film/{clean_slug}/members/", "All Members (Watched)"),
                (f"film/{clean_slug}/ratings/", "All Member Ratings"),
            ]

        return [(f"film/{clean_slug}/ratings/rated/4-5/", "Rated 4.0 - 5.0 Stars")]


def parse_star_rating_from_class(classes: List[str]) -> Optional[float]:
    """Parse rating (e.g. 0.5 - 5.0) from CSS classes like 'rated-10' or 'rated-9'."""
    for c in classes:
        m = re.search(r"rated-(\d+)", c)
        if m:
            val = int(m.group(1))
            return val / 2.0
    return None


def rating_to_stars_text(rating: Optional[float]) -> str:
    """Convert float rating to visual stars string (e.g. 4.5 -> ★★★★½)."""
    if rating is None:
        return ""
    full_stars = int(rating)
    half_star = (rating - full_stars) >= 0.5
    stars = "★" * full_stars
    if half_star:
        stars += "½"
    return stars
