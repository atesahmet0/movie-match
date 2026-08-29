"""
Movie Match: Find Letterboxd users from specific locations who liked or disliked movies.
"""

from movie_match.logging import get_logger, is_debug_enabled, setup_logging, debug_tracker

__version__ = "0.2.0"
__all__ = ["get_logger", "setup_logging", "is_debug_enabled", "debug_tracker", "__version__"]
