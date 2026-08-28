"""Anti-bot HTTP client using curl_cffi for modern TLS/HTTP2 browser impersonation."""

import asyncio
import os
import random
from typing import Dict, List, Optional
from curl_cffi.requests import AsyncSession, Response

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


BROWSER_IMPERSONATIONS = ["chrome124", "chrome120", "safari17_0", "edge101"]

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
    "DNT": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
}


class AntiBotHttpClient:
    """High-performance HTTP client resilient against bot detection, proxies, and rate limits."""

    def __init__(
        self,
        impersonate: str = "chrome124",
        concurrency: int = 15,
        max_retries: int = 3,
        timeout: int = 15,
        base_delay: float = 0.05,
        proxy_url: Optional[str] = None,
    ):
        self.impersonate = impersonate
        self.semaphore = asyncio.Semaphore(concurrency)
        self.max_retries = max_retries
        self.timeout = timeout
        self.base_delay = base_delay
        self.proxy_url = proxy_url or os.getenv("PROXY_URL") or os.getenv("HTTP_PROXY")
        self._session: Optional[AsyncSession] = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self):
        if not self._session:
            proxies = (
                {"http": self.proxy_url, "https": self.proxy_url}
                if self.proxy_url
                else None
            )
            self._session = AsyncSession(
                impersonate=self.impersonate,
                headers=DEFAULT_HEADERS,
                proxies=proxies,
            )

    async def close(self):
        if self._session:
            await self._session.close()
            self._session = None

    async def get(
        self,
        url: str,
        params: Optional[Dict[str, str]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Optional[Response]:
        """Perform an HTTP GET request with retries, jitter, and concurrency control."""
        if not self._session:
            await self.start()

        for attempt in range(1, self.max_retries + 1):
            async with self.semaphore:
                try:
                    if self.base_delay > 0:
                        await asyncio.sleep(self.base_delay + random.uniform(0.01, 0.05))

                    response = await self._session.get(
                        url,
                        params=params,
                        headers=headers,
                        timeout=self.timeout,
                    )

                    # Successful response
                    if response.status_code == 200:
                        return response

                    # Page not found
                    if response.status_code == 404:
                        return response

                    # Rate limited or server error -> backoff & retry
                    if response.status_code in [429, 500, 502, 503, 504]:
                        backoff = (2 ** attempt) + random.uniform(0.5, 1.5)
                        await asyncio.sleep(backoff)
                        continue

                    return response

                except Exception as e:
                    if attempt == self.max_retries:
                        return None
                    backoff = (2 ** attempt) + random.uniform(0.2, 0.8)
                    await asyncio.sleep(backoff)

        return None
