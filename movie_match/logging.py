"""Centralized logging and debug diagnostics module for movie-match."""

import logging
import os
import sys
import time
from typing import Dict, Optional
from rich.console import Console
from rich.logging import RichHandler
from rich.panel import Panel
from rich.table import Table

_LOGGING_INITIALIZED = False
_DEBUG_ACTIVE = False
_CONSOLE = Console(stderr=True)


class DebugTracker:
    """Tracks performance and diagnostic metrics during search and scraping runs."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.start_time: float = time.time()
        self.http_requests_total: int = 0
        self.http_requests_success: int = 0
        self.http_requests_failed: int = 0
        self.http_retries: int = 0
        self.http_rate_limits: int = 0  # 429 / 403
        self.http_total_duration_sec: float = 0.0
        self.cache_hits: int = 0
        self.cache_misses: int = 0
        self.cache_writes: int = 0
        self.profiles_evaluated: int = 0
        self.location_matches: int = 0

    def record_http_request(self, duration_sec: float, status_code: Optional[int], retry: bool = False):
        self.http_requests_total += 1
        self.http_total_duration_sec += duration_sec
        if retry:
            self.http_retries += 1
        if status_code == 200:
            self.http_requests_success += 1
        elif status_code in (429, 403):
            self.http_rate_limits += 1
            self.http_requests_failed += 1
        elif status_code is None or status_code >= 400:
            self.http_requests_failed += 1

    def record_cache_hit(self, count: int = 1):
        self.cache_hits += count

    def record_cache_miss(self, count: int = 1):
        self.cache_misses += count

    def record_cache_write(self, count: int = 1):
        self.cache_writes += count

    def record_profile_eval(self, is_match: bool = False):
        self.profiles_evaluated += 1
        if is_match:
            self.location_matches += 1

    def generate_summary_table(self) -> Table:
        """Create a Rich Table summarizing debug and performance stats."""
        total_time = max(time.time() - self.start_time, 0.001)
        avg_http = (
            (self.http_total_duration_sec / self.http_requests_total * 1000)
            if self.http_requests_total > 0
            else 0.0
        )
        total_cache_lookups = self.cache_hits + self.cache_misses
        hit_ratio = (
            (self.cache_hits / total_cache_lookups * 100)
            if total_cache_lookups > 0
            else 0.0
        )

        table = Table(title="🔍 Debug Diagnostics & Performance Summary", show_header=True, header_style="bold cyan")
        table.add_column("Metric", style="bold white", width=32)
        table.add_column("Value", style="bold yellow", justify="right")
        table.add_column("Notes", style="dim", width=30)

        table.add_row("Total Wall Time", f"{total_time:.2f}s", "Overall execution time")
        table.add_row("HTTP Requests", f"{self.http_requests_total}", f"Avg {avg_http:.1f}ms per request")
        table.add_row("HTTP Success (200)", f"{self.http_requests_success}", "Successful network calls")
        table.add_row("HTTP Rate Limits (429/403)", f"{self.http_rate_limits}", "Bot / rate limit blocks encountered")
        table.add_row("HTTP Retries / Backoffs", f"{self.http_retries}", "Retried requests")
        table.add_row("Cache Hits", f"{self.cache_hits}", f"{hit_ratio:.1f}% hit ratio")
        table.add_row("Cache Misses", f"{self.cache_misses}", "Lookups requiring network fetch")
        table.add_row("Profiles Evaluated", f"{self.profiles_evaluated}", "Candidate users processed")
        table.add_row("Location Matches", f"{self.location_matches}", "Passed location filter")

        return table


# Global tracker instance
debug_tracker = DebugTracker()


def is_env_debug_enabled() -> bool:
    """Check if debug is enabled via environment variables."""
    env_val = os.getenv("DEBUG", "") or os.getenv("MOVIE_MATCH_DEBUG", "") or os.getenv("LOG_LEVEL", "")
    return env_val.strip().lower() in ("1", "true", "yes", "debug", "verbose")


def is_debug_enabled() -> bool:
    """Check if debug mode is enabled via runtime flag or environment variable."""
    return _DEBUG_ACTIVE or is_env_debug_enabled()


def setup_logging(
    debug: bool = False,
    verbose: bool = False,
    log_level: Optional[str] = None,
    force_reconfigure: bool = False,
) -> logging.Logger:
    """
    Configure structured, high-visibility logging for movie-match.

    Args:
        debug: If True, sets log level to DEBUG.
        verbose: If True, sets log level to INFO with detailed formatting.
        log_level: Explicit logging level name (e.g. 'DEBUG', 'INFO', 'WARNING').
        force_reconfigure: Force reconfiguring handlers if already initialized.
    """
    global _LOGGING_INITIALIZED, _DEBUG_ACTIVE

    env_debug = is_env_debug_enabled()
    is_debug = debug or env_debug
    _DEBUG_ACTIVE = is_debug

    if log_level:
        target_level = getattr(logging, log_level.upper(), logging.INFO)
    elif is_debug:
        target_level = logging.DEBUG
    elif verbose:
        target_level = logging.INFO
    else:
        target_level = logging.WARNING

    if _LOGGING_INITIALIZED and not force_reconfigure:
        # Update level of existing root movie_match logger
        logging.getLogger("movie_match").setLevel(target_level)
        return logging.getLogger("movie_match")

    root_logger = logging.getLogger("movie_match")
    root_logger.setLevel(target_level)

    # Remove any existing handlers from movie_match logger to prevent duplicate messages
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # Use RichHandler for colorful, timestamped, component-tagged output
    rich_handler = RichHandler(
        console=_CONSOLE,
        show_time=True,
        show_level=True,
        show_path=False,
        rich_tracebacks=True,
        tracebacks_show_locals=is_debug,
        markup=True,
    )
    rich_handler.setLevel(target_level)

    formatter = logging.Formatter(
        fmt="%(message)s",
        datefmt="[%X]",
    )
    rich_handler.setFormatter(formatter)
    root_logger.addHandler(rich_handler)
    root_logger.propagate = False

    _LOGGING_INITIALIZED = True
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a namespaced logger under 'movie_match'."""
    if not _LOGGING_INITIALIZED:
        setup_logging(debug=is_debug_enabled())
    if not name.startswith("movie_match"):
        name = f"movie_match.{name}"
    return logging.getLogger(name)
