"""Anti-bot HTTP client with Webshare-aware proxy session rotation."""

import asyncio
import os
import random
import re
import time
from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional
from urllib.parse import urlsplit

from curl_cffi.requests import AsyncSession, Response

from movie_match.logging import debug_tracker, get_logger

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

logger = get_logger("http")

BROWSER_IMPERSONATIONS = ["chrome124", "chrome120", "safari17_0", "edge101"]
BLOCK_STATUSES = {403, 429}

# Session pool size when no proxy list is configured — every session would share
# the one exit address, so extra parallelism buys blocks, not throughput.
DEFAULT_POOL_SIZE = 5

# Webshare's backbone endpoint. Per their docs, appending "-rotate" to the proxy
# username yields a new exit IP on every request, and cannot be combined with a
# session ID; a trailing numeric segment instead pins a sticky session to one IP.
# See https://apidocs.webshare.io/proxy-connection
WEBSHARE_BACKBONE_HOST = "p.webshare.io"


def _proxy_rotation_mode(url: str) -> str:
    """Classify how a proxy URL assigns exit addresses.

    Only the backbone endpoint is classifiable — a direct proxy is one fixed
    address by definition. Returns "rotating", "sticky", "backbone", or "direct".
    """
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        username = parts.username or ""
    except ValueError:
        return "direct"
    if host != WEBSHARE_BACKBONE_HOST:
        return "direct"
    if username.endswith("-rotate"):
        return "rotating"
    if re.search(r"-\d+$", username):
        return "sticky"
    return "backbone"
RETRYABLE_SERVER_STATUSES = {500, 502, 503, 504}

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
    "DNT": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
}


@dataclass
class ProxySessionSlot:
    session: AsyncSession
    proxy_url: Optional[str]
    impersonation: str
    generation: int = 1


class AntiBotHttpClient:
    """Concurrent HTTP client with rotating tunnels and adaptive rate control."""

    def __init__(
        self,
        impersonate: str = "chrome124",
        concurrency: int = 15,
        max_retries: int = 3,
        timeout: int = 15,
        base_delay: float = 0.05,
        proxy_url: Optional[str] = None,
        session_pool_size: Optional[int] = None,
    ):
        self.impersonate = impersonate
        self.concurrency = max(1, concurrency)
        self.max_retries = max(1, max_retries)
        self.timeout = timeout
        self.base_delay = base_delay

        configured_urls = os.getenv("WEBSHARE_PROXY_URLS") or os.getenv("PROXY_URLS") or ""
        proxy_urls = [
            item.strip()
            for item in configured_urls.replace("\n", ",").split(",")
            if item.strip()
        ]
        if proxy_url:
            proxy_urls = [proxy_url]
        elif not proxy_urls:
            fallback = os.getenv("PROXY_URL") or os.getenv("HTTP_PROXY")
            if fallback:
                proxy_urls = [fallback]

        self.proxy_urls = proxy_urls
        self.proxy_url = proxy_urls[0] if proxy_urls else None

        # Pool size is really "how many requests do we keep in flight", and the
        # safe ceiling is set by how many exit IPs sit behind the configuration —
        # which is NOT the length of this list. A Webshare rotating endpoint is a
        # single URL that hands out a different address per connection, so URL
        # count would badly understate the available diversity. Any proxy at all
        # therefore gets the full pool; tune it with PROXY_SESSION_POOL_CEILING,
        # and lower that below the IP count if you switch to a static list.
        #
        # With no proxy the pool stays small: every session would leave from the
        # server's own address, where extra parallelism buys blocks, not speed.
        pool_ceiling = max(1, int(os.getenv("PROXY_SESSION_POOL_CEILING", "24")))
        derived_pool_size = pool_ceiling if proxy_urls else DEFAULT_POOL_SIZE
        configured_pool_size = (
            session_pool_size
            or int(os.getenv("WEBSHARE_SESSION_POOL_SIZE", "0"))
            or derived_pool_size
        )
        self.session_pool_size = max(1, configured_pool_size)
        # Capacity gates in-flight requests, so it must not throttle the pool
        # below the number of sessions we just provisioned.
        self.concurrency = max(self.concurrency, self.session_pool_size)

        # Compatibility alias for code/tests that used the former single session.
        self._session: Optional[AsyncSession] = None
        self._slots: List[ProxySessionSlot] = []
        self._available_slots: asyncio.Queue[int] = asyncio.Queue()
        self._start_lock = asyncio.Lock()
        self._limit_condition = asyncio.Condition()
        self._active_requests = 0
        self._adaptive_limit = self.session_pool_size
        self._success_streak = 0
        self._cooldown_tasks: set[asyncio.Task] = set()

        self._block_events: deque[float] = deque()
        self._circuit_open_until = 0.0
        self._block_window = float(os.getenv("PROXY_BLOCK_WINDOW_SECONDS", "30"))
        self._block_threshold = max(2, int(os.getenv("PROXY_BLOCK_THRESHOLD", "5")))
        self._circuit_pause = float(os.getenv("PROXY_CIRCUIT_PAUSE_SECONDS", "10"))

        self.session_rotations = 0
        self.proxy_blocks = 0
        self.circuit_trips = 0

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _proxy_for_slot(self, index: int) -> Optional[str]:
        if not self.proxy_urls:
            return None
        return self.proxy_urls[index % len(self.proxy_urls)]

    def _impersonation_for(self, index: int, generation: int) -> str:
        if generation == 1 and index == 0:
            return self.impersonate
        return BROWSER_IMPERSONATIONS[(index + generation - 1) % len(BROWSER_IMPERSONATIONS)]

    def _create_session(self, index: int, generation: int = 1) -> ProxySessionSlot:
        proxy = self._proxy_for_slot(index)
        impersonation = self._impersonation_for(index, generation)
        proxies = {"http": proxy, "https": proxy} if proxy else None
        session = AsyncSession(impersonate=impersonation, headers=DEFAULT_HEADERS, proxies=proxies)
        return ProxySessionSlot(session, proxy, impersonation, generation)

    async def start(self):
        if self._slots:
            return
        async with self._start_lock:
            if self._slots:
                return
            self._slots = [self._create_session(index) for index in range(self.session_pool_size)]
            self._available_slots = asyncio.Queue()
            for index in range(len(self._slots)):
                self._available_slots.put_nowait(index)
            self._session = self._slots[0].session
            modes = sorted({_proxy_rotation_mode(u) for u in self.proxy_urls})
            logger.debug(
                "HTTP session pool initialized "
                f"(sessions={len(self._slots)}, proxy={'yes' if self.proxy_urls else 'no'}, "
                f"endpoints={len(self.proxy_urls)}, modes={modes or ['none']})"
            )
            # A sticky backbone session pins every slot to one exit address, so a
            # pool sized for rotation would pile all of it onto that address.
            if modes == ["sticky"] and self.session_pool_size > DEFAULT_POOL_SIZE:
                logger.warning(
                    f"Proxy is a sticky Webshare session but the pool holds "
                    f"{self.session_pool_size} sessions — they all share one exit IP. "
                    "Use a '-rotate' username or lower PROXY_SESSION_POOL_CEILING."
                )

    async def close(self):
        for task in list(self._cooldown_tasks):
            task.cancel()
        if self._cooldown_tasks:
            await asyncio.gather(*self._cooldown_tasks, return_exceptions=True)
        self._cooldown_tasks.clear()
        sessions = [slot.session for slot in self._slots]
        if not sessions and self._session is not None:
            sessions = [self._session]
        if sessions:
            await asyncio.gather(*(session.close() for session in sessions), return_exceptions=True)
        self._slots = []
        self._session = None
        self._available_slots = asyncio.Queue()
        logger.debug("HTTP session pool closed")

    async def _acquire_capacity(self) -> None:
        async with self._limit_condition:
            await self._limit_condition.wait_for(lambda: self._active_requests < self._adaptive_limit)
            self._active_requests += 1

    async def _release_capacity(self) -> None:
        async with self._limit_condition:
            self._active_requests = max(0, self._active_requests - 1)
            self._limit_condition.notify_all()

    async def _acquire_slot(self) -> int:
        await self._acquire_capacity()
        try:
            return await self._available_slots.get()
        except BaseException:
            await self._release_capacity()
            raise

    async def _requeue_after(self, index: int, delay: float) -> None:
        if delay > 0:
            await asyncio.sleep(delay)
        if self._slots:
            self._available_slots.put_nowait(index)

    async def _release_slot(self, index: int, cooldown: float = 0.0) -> None:
        await self._release_capacity()
        if cooldown <= 0:
            self._available_slots.put_nowait(index)
            return
        task = asyncio.create_task(self._requeue_after(index, cooldown))
        self._cooldown_tasks.add(task)
        task.add_done_callback(self._cooldown_tasks.discard)

    async def _rotate_slot(self, index: int) -> None:
        old_slot = self._slots[index]
        await old_slot.session.close()
        replacement = self._create_session(index, old_slot.generation + 1)
        self._slots[index] = replacement
        if index == 0:
            self._session = replacement.session
        self.session_rotations += 1
        logger.debug(
            f"Proxy session {index + 1} rotated to generation {replacement.generation} "
            f"(impersonate={replacement.impersonation})"
        )

    async def _record_block(self) -> None:
        now = time.monotonic()
        self.proxy_blocks += 1
        self._success_streak = 0
        self._adaptive_limit = max(1, self._adaptive_limit // 2)
        self._block_events.append(now)
        while self._block_events and now - self._block_events[0] > self._block_window:
            self._block_events.popleft()
        if len(self._block_events) >= self._block_threshold:
            if now >= self._circuit_open_until:
                self._circuit_open_until = now + self._circuit_pause
                self.circuit_trips += 1
                logger.warning(
                    f"Proxy circuit opened for {self._circuit_pause:.1f}s after "
                    f"{len(self._block_events)} recent blocks"
                )

    async def _record_success(self) -> None:
        self._success_streak += 1
        if self._success_streak >= 20 and self._adaptive_limit < self.session_pool_size:
            # Recover proportionally. A block halves the limit, so a flat +1 per
            # 20 successes takes a large pool minutes to climb back — longer than
            # the search that is waiting on it. Unchanged for small pools.
            step = max(1, self.session_pool_size // 8)
            self._adaptive_limit = min(self.session_pool_size, self._adaptive_limit + step)
            self._success_streak = 0
            async with self._limit_condition:
                self._limit_condition.notify_all()

    async def _respect_circuit(self) -> None:
        delay = self._circuit_open_until - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)

    def metrics_snapshot(self) -> Dict[str, object]:
        return {
            "configured": bool(self.proxy_urls),
            "endpoints": len(self.proxy_urls),
            "rotation_modes": sorted({_proxy_rotation_mode(u) for u in self.proxy_urls}),
            "session_pool_size": len(self._slots) or self.session_pool_size,
            "active_requests": self._active_requests,
            "adaptive_concurrency": self._adaptive_limit,
            "session_rotations": self.session_rotations,
            "blocked_responses": self.proxy_blocks,
            "circuit_trips": self.circuit_trips,
            "circuit_open": self._circuit_open_until > time.monotonic(),
            "session_generations": [slot.generation for slot in self._slots],
        }

    async def _legacy_get(
        self,
        url: str,
        params: Optional[Dict[str, str]],
        headers: Optional[Dict[str, str]],
    ) -> Optional[Response]:
        req_start = time.time()
        response = await self._session.get(url, params=params, headers=headers, timeout=self.timeout)
        debug_tracker.record_http_request(time.time() - req_start, response.status_code)
        return response

    async def get(
        self,
        url: str,
        params: Optional[Dict[str, str]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Optional[Response]:
        """GET with fresh-tunnel rotation, adaptive concurrency, and bounded retry."""
        if not self._slots:
            await self.start()
        if not self._slots and self._session is not None:
            return await self._legacy_get(url, params, headers)

        for attempt in range(1, self.max_retries + 1):
            await self._respect_circuit()
            index = await self._acquire_slot()
            released = False
            req_start = time.time()
            try:
                if self.base_delay > 0:
                    await asyncio.sleep(self.base_delay + random.uniform(0.01, 0.05))
                slot = self._slots[index]
                logger.debug(
                    f"HTTP GET {url} (attempt {attempt}/{self.max_retries}, "
                    f"session={index + 1}, generation={slot.generation})"
                )
                response = await slot.session.get(
                    url, params=params, headers=headers, timeout=self.timeout
                )
                elapsed_sec = time.time() - req_start
                elapsed_ms = elapsed_sec * 1000

                if response.status_code == 200:
                    debug_tracker.record_http_request(elapsed_sec, 200, retry=(attempt > 1))
                    await self._record_success()
                    await self._release_slot(index)
                    released = True
                    return response

                if response.status_code == 404:
                    debug_tracker.record_http_request(elapsed_sec, 404, retry=(attempt > 1))
                    await self._release_slot(index)
                    released = True
                    return response

                if response.status_code in BLOCK_STATUSES:
                    will_retry = attempt < self.max_retries
                    debug_tracker.record_http_request(elapsed_sec, response.status_code, retry=will_retry)
                    await self._record_block()
                    await self._rotate_slot(index)
                    backoff = min(3.0, 0.45 * (2 ** (attempt - 1)) + random.uniform(0.05, 0.25))
                    await self._release_slot(index, cooldown=backoff if will_retry else 0.0)
                    released = True
                    if not will_retry:
                        logger.error(
                            f"HTTP {response.status_code} remained blocked after "
                            f"{self.max_retries} attempts: {url} ({elapsed_ms:.0f}ms final attempt)"
                        )
                        return None
                    logger.warning(
                        f"HTTP {response.status_code} on {url}; proxy tunnel rotated, "
                        f"retrying in {backoff:.2f}s (attempt {attempt}/{self.max_retries})"
                    )
                    await asyncio.sleep(backoff)
                    continue

                if response.status_code in RETRYABLE_SERVER_STATUSES:
                    will_retry = attempt < self.max_retries
                    debug_tracker.record_http_request(elapsed_sec, response.status_code, retry=will_retry)
                    await self._release_slot(index)
                    released = True
                    if not will_retry:
                        return None
                    backoff = min(5.0, 0.75 * (2 ** (attempt - 1)) + random.uniform(0.1, 0.4))
                    await asyncio.sleep(backoff)
                    continue

                debug_tracker.record_http_request(
                    elapsed_sec, response.status_code, retry=(attempt > 1)
                )
                await self._release_slot(index)
                released = True
                return response

            except asyncio.CancelledError:
                if not released:
                    await self._release_slot(index)
                    released = True
                raise
            except Exception as exc:
                elapsed_sec = time.time() - req_start
                will_retry = attempt < self.max_retries
                debug_tracker.record_http_request(elapsed_sec, None, retry=will_retry)
                try:
                    await self._rotate_slot(index)
                except Exception:
                    logger.debug("Failed to rotate errored proxy session", exc_info=True)
                await self._release_slot(index, cooldown=0.5 if will_retry else 0.0)
                released = True
                if not will_retry:
                    logger.error(
                        f"Request failed permanently ({type(exc).__name__}: {exc}) on {url}"
                    )
                    return None
                backoff = min(3.0, 0.5 * (2 ** (attempt - 1)) + random.uniform(0.1, 0.3))
                logger.warning(
                    f"Request error ({type(exc).__name__}) on {url}; "
                    f"session rotated, retrying in {backoff:.2f}s"
                )
                await asyncio.sleep(backoff)
            finally:
                if not released:
                    await self._release_slot(index)

        return None
