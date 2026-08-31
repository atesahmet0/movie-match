"""Centralized backend PostHog analytics and telemetry module for MovieMatch."""

import atexit
import os
import socket
import sys
import time
import traceback
from typing import Any, Dict, List, Optional
import posthog

from movie_match.logging import get_logger

logger = get_logger("analytics")

_POSTHOG_CLIENT: Optional[posthog.Posthog] = None
_INITIALIZED = False
_DISABLED = False

DEFAULT_HOST = "https://eu.i.posthog.com"
SERVER_HOSTNAME = socket.gethostname()


def get_posthog_key() -> Optional[str]:
    """Retrieve PostHog API key from environment variables."""
    return (
        os.getenv("POSTHOG_API_KEY")
        or os.getenv("POSTHOG_PROJECT_KEY")
        or os.getenv("NEXT_PUBLIC_POSTHOG_KEY")
    )


def get_posthog_host() -> str:
    """Retrieve PostHog host endpoint from environment variables."""
    return (
        os.getenv("POSTHOG_HOST")
        or os.getenv("NEXT_PUBLIC_POSTHOG_HOST")
        or DEFAULT_HOST
    )


def init_analytics(
    api_key: Optional[str] = None,
    host: Optional[str] = None,
    disabled: Optional[bool] = None,
) -> Optional[posthog.Posthog]:
    """
    Initialize the backend PostHog analytics client with non-blocking async batching.
    """
    global _POSTHOG_CLIENT, _INITIALIZED, _DISABLED

    if disabled is not None:
        _DISABLED = disabled

    if _DISABLED or os.getenv("POSTHOG_DISABLED", "false").lower() in ("1", "true", "yes"):
        _DISABLED = True
        logger.info("ℹ️ PostHog backend analytics explicitly disabled.")
        return None

    key = api_key or get_posthog_key()
    posthog_host = host or get_posthog_host()

    if not key:
        logger.info("ℹ️ PostHog key not configured for backend. Running in no-op mode.")
        return None

    try:
        # Create Posthog client instance with bounded background thread queue
        client = posthog.Posthog(
            project_api_key=key,
            host=posthog_host,
            max_queue_size=1000,
            flush_at=20,
            flush_interval=0.5,
            sync_mode=False,
            disable_geoip=False,
        )
        _POSTHOG_CLIENT = client
        _INITIALIZED = True
        logger.info(f"🚀 PostHog backend analytics initialized (host={posthog_host})")
        return client
    except Exception as exc:
        logger.warning(f"Failed to initialize PostHog backend client: {exc}")
        return None


def get_client() -> Optional[posthog.Posthog]:
    """Get or lazily initialize the PostHog client."""
    global _INITIALIZED
    if not _INITIALIZED and not _DISABLED:
        init_analytics()
    return _POSTHOG_CLIENT


def flush_analytics() -> None:
    """Flush pending analytics events."""
    if _POSTHOG_CLIENT:
        try:
            _POSTHOG_CLIENT.flush()
        except Exception as exc:
            logger.debug(f"PostHog flush error: {exc}")


def shutdown_analytics() -> None:
    """Flush and shut down PostHog background workers."""
    global _POSTHOG_CLIENT, _INITIALIZED
    if _POSTHOG_CLIENT:
        try:
            _POSTHOG_CLIENT.flush()
            _POSTHOG_CLIENT.shutdown()
        except Exception as exc:
            logger.debug(f"PostHog shutdown error: {exc}")
        finally:
            _POSTHOG_CLIENT = None
            _INITIALIZED = False


# Register shutdown hook
atexit.register(shutdown_analytics)


def capture_event(
    event_name: str,
    properties: Optional[Dict[str, Any]] = None,
    distinct_id: Optional[str] = None,
) -> None:
    """
    Safely capture a custom telemetry event without throwing errors or blocking.
    """
    client = get_client()
    if not client:
        return

    ident = distinct_id or f"backend-srv-{SERVER_HOSTNAME}"
    props = properties.copy() if properties else {}
    props.setdefault("source", "python_backend")
    props.setdefault("server_hostname", SERVER_HOSTNAME)
    props.setdefault("timestamp_unix", time.time())

    try:
        client.capture(
            distinct_id=ident,
            event=event_name,
            properties=props,
        )
    except Exception as exc:
        logger.debug(f"PostHog capture_event failed for {event_name}: {exc}")


def capture_backend_exception(
    exc: BaseException,
    distinct_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Safely capture backend exceptions with contextual debugging attributes.
    """
    client = get_client()
    if not client:
        return

    ident = distinct_id or f"backend-srv-{SERVER_HOSTNAME}"
    props = {
        "source": "python_backend",
        "server_hostname": SERVER_HOSTNAME,
        "exception_type": type(exc).__name__,
        "exception_message": str(exc),
        "traceback": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
        "timestamp_unix": time.time(),
    }
    if context:
        props.update(context)

    try:
        client.capture(
            distinct_id=ident,
            event="$exception",
            properties=props,
        )
    except Exception as err:
        logger.debug(f"PostHog capture_backend_exception failed: {err}")


# -----------------------------------------------------------------------------
# Domain-Specific Tracing Helpers
# -----------------------------------------------------------------------------

def track_http_request(
    url: str,
    status_code: Optional[int],
    duration_sec: float,
    *,
    method: str = "GET",
    retry_attempt: int = 1,
    max_retries: int = 3,
    response_bytes: int = 0,
    proxy_mode: str = "direct",
    proxy_used: bool = False,
    session_generation: int = 1,
    error: Optional[str] = None,
) -> None:
    """Track outbound proxy/scraping HTTP request telemetry."""
    clean_url = url
    try:
        if "@" in url:
            parts = url.split("@", 1)
            clean_url = "http://" + parts[1]
    except Exception:
        pass

    duration_ms = round(duration_sec * 1000, 2)
    props = {
        "url": clean_url,
        "method": method,
        "status_code": status_code,
        "is_success": status_code == 200,
        "is_block": status_code in (403, 429),
        "duration_ms": duration_ms,
        "duration_sec": round(duration_sec, 4),
        "response_bytes": response_bytes,
        "retry_attempt": retry_attempt,
        "is_retry": retry_attempt > 1,
        "max_retries": max_retries,
        "proxy_mode": proxy_mode,
        "proxy_used": proxy_used,
        "session_generation": session_generation,
    }
    if error:
        props["error"] = error

    capture_event("backend_http_request", props)


def track_proxy_block(
    url: str,
    status_code: int,
    backoff_sec: float,
    attempt: int,
    max_retries: int,
    session_generation: int,
) -> None:
    """Track anti-bot rate-limit or forbidden response blocks."""
    capture_event(
        "backend_proxy_blocked",
        {
            "url": url,
            "status_code": status_code,
            "backoff_sec": round(backoff_sec, 3),
            "attempt": attempt,
            "max_retries": max_retries,
            "session_generation": session_generation,
        },
    )


def track_circuit_breaker(
    event: str,
    pause_sec: float,
    recent_blocks: int,
) -> None:
    """Track proxy circuit breaker open/close transitions."""
    capture_event(
        "backend_circuit_breaker",
        {
            "action": event,
            "pause_sec": round(pause_sec, 2),
            "recent_blocks_count": recent_blocks,
        },
    )


def track_search_started(
    search_type: str,
    params: Dict[str, Any],
    distinct_id: Optional[str] = None,
) -> None:
    """Track the beginning of a search operation."""
    props = {
        "search_type": search_type,
        **params,
    }
    capture_event("backend_search_started", props, distinct_id=distinct_id)


def track_search_completed(
    search_type: str,
    duration_sec: float,
    matches_count: int,
    *,
    location: Optional[str] = None,
    films_count: int = 0,
    upstream_requests: int = 0,
    cache_status: str = "miss",
    stop_reason: Optional[str] = None,
    matched_usernames: Optional[List[str]] = None,
    distinct_id: Optional[str] = None,
) -> None:
    """Track successful completion of a search run."""
    duration_ms = round(duration_sec * 1000, 2)
    props = {
        "search_type": search_type,
        "duration_sec": round(duration_sec, 3),
        "duration_ms": duration_ms,
        "matches_count": matches_count,
        "location": location,
        "films_count": films_count,
        "upstream_requests": upstream_requests,
        "cache_status": cache_status,
        "stop_reason": stop_reason or "completed",
        "matched_usernames": (matched_usernames or [])[:50],
        "matched_usernames_count": len(matched_usernames or []),
    }
    capture_event("backend_search_completed", props, distinct_id=distinct_id)


def track_search_failed(
    search_type: str,
    error: str,
    duration_sec: float,
    *,
    status_code: Optional[int] = None,
    distinct_id: Optional[str] = None,
) -> None:
    """Track failed search executions."""
    props = {
        "search_type": search_type,
        "error": error,
        "duration_sec": round(duration_sec, 3),
        "status_code": status_code,
    }
    capture_event("backend_search_failed", props, distinct_id=distinct_id)


def track_search_cancelled(
    search_type: str,
    duration_sec: float,
    distinct_id: Optional[str] = None,
) -> None:
    """Track client-cancelled search operations."""
    props = {
        "search_type": search_type,
        "duration_sec": round(duration_sec, 3),
    }
    capture_event("backend_search_cancelled", props, distinct_id=distinct_id)


def track_api_request(
    path: str,
    method: str,
    status_code: int,
    duration_ms: float,
    request_size_bytes: int = 0,
    response_size_bytes: int = 0,
    client_ip_hash: Optional[str] = None,
) -> None:
    """Track FastAPI endpoint request/response latency and payload size."""
    capture_event(
        "backend_api_request",
        {
            "path": path,
            "method": method,
            "status_code": status_code,
            "is_error": status_code >= 400,
            "duration_ms": round(duration_ms, 2),
            "request_size_bytes": request_size_bytes,
            "response_size_bytes": response_size_bytes,
            "client_ip_hash": client_ip_hash,
        },
    )
