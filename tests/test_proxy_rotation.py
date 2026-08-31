"""Hermetic tests for Webshare-aware proxy session management."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import movie_match.scraper.client as client_module
from movie_match.scraper.client import AntiBotHttpClient


class FakeSession:
    def __init__(self, statuses, **kwargs):
        self.statuses = statuses
        self.kwargs = kwargs
        self.close = AsyncMock()

    async def get(self, *_args, **_kwargs):
        return SimpleNamespace(status_code=self.statuses.pop(0), text="")


@pytest.mark.asyncio
async def test_block_rotates_tunnel_and_retries_on_another_session(monkeypatch):
    statuses = [403, 200]
    sessions = []

    def session_factory(**kwargs):
        session = FakeSession(statuses, **kwargs)
        sessions.append(session)
        return session

    monkeypatch.setattr(client_module, "AsyncSession", session_factory)
    monkeypatch.setattr(client_module.asyncio, "sleep", AsyncMock())
    client = AntiBotHttpClient(
        proxy_url="http://user-rotate:password@p.webshare.io:80",
        concurrency=2,
        session_pool_size=2,
        max_retries=2,
        base_delay=0,
    )

    response = await client.get("https://letterboxd.com/film/alien/")

    assert response is not None and response.status_code == 200
    assert client.session_rotations == 1
    assert client.proxy_blocks == 1
    assert client.metrics_snapshot()["adaptive_concurrency"] == 1
    assert len(sessions) == 3  # two initial tunnels plus one replacement
    await client.close()


@pytest.mark.asyncio
async def test_final_blocked_attempt_does_not_sleep(monkeypatch):
    statuses = [403]
    sleep = AsyncMock()
    monkeypatch.setattr(
        client_module,
        "AsyncSession",
        lambda **kwargs: FakeSession(statuses, **kwargs),
    )
    monkeypatch.setattr(client_module.asyncio, "sleep", sleep)
    client = AntiBotHttpClient(
        proxy_url="http://user-rotate:password@p.webshare.io:80",
        session_pool_size=1,
        max_retries=1,
        base_delay=0,
    )

    assert await client.get("https://letterboxd.com/film/alien/") is None
    assert sleep.await_count == 0
    await client.close()


def test_multiple_exported_webshare_endpoints_are_supported(monkeypatch):
    monkeypatch.setenv(
        "WEBSHARE_PROXY_URLS",
        "http://first-rotate:secret@p.webshare.io:80,"
        "http://second-us-rotate:secret@p.webshare.io:80",
    )
    client = AntiBotHttpClient(session_pool_size=4)

    assert len(client.proxy_urls) == 2
    assert client._proxy_for_slot(0) == client.proxy_urls[0]
    assert client._proxy_for_slot(1) == client.proxy_urls[1]
    assert client._proxy_for_slot(2) == client.proxy_urls[0]


def test_pool_scales_when_any_proxy_is_configured(monkeypatch):
    """The pool is not derived from URL count.

    A Webshare rotating endpoint is one URL behind many exit IPs, so sizing the
    pool by list length would pin a rotating setup to a single session.
    """
    monkeypatch.delenv("WEBSHARE_SESSION_POOL_SIZE", raising=False)
    monkeypatch.setenv("PROXY_URL", "http://user-rotate:secret@p.webshare.io:80")
    monkeypatch.delenv("WEBSHARE_PROXY_URLS", raising=False)
    monkeypatch.delenv("PROXY_URLS", raising=False)
    client = AntiBotHttpClient()

    assert len(client.proxy_urls) == 1
    assert client.session_pool_size == 24  # PROXY_SESSION_POOL_CEILING default
    # Capacity must not throttle the sessions we just provisioned.
    assert client.concurrency >= client.session_pool_size


def test_pool_same_for_a_static_list(monkeypatch):
    monkeypatch.delenv("WEBSHARE_SESSION_POOL_SIZE", raising=False)
    monkeypatch.setenv(
        "WEBSHARE_PROXY_URLS",
        ",".join(f"http://user{i}:secret@p.webshare.io:80" for i in range(40)),
    )
    assert AntiBotHttpClient().session_pool_size == 24


def test_pool_stays_small_without_proxies(monkeypatch):
    """Extra sessions on one exit address buy blocks, not throughput."""
    monkeypatch.delenv("WEBSHARE_SESSION_POOL_SIZE", raising=False)
    monkeypatch.delenv("WEBSHARE_PROXY_URLS", raising=False)
    monkeypatch.delenv("PROXY_URLS", raising=False)
    monkeypatch.delenv("PROXY_URL", raising=False)
    monkeypatch.delenv("HTTP_PROXY", raising=False)
    client = AntiBotHttpClient()

    assert client.session_pool_size == 5


def test_pool_is_capped_by_the_ceiling(monkeypatch):
    monkeypatch.delenv("WEBSHARE_SESSION_POOL_SIZE", raising=False)
    monkeypatch.setenv("PROXY_SESSION_POOL_CEILING", "8")
    monkeypatch.setenv(
        "WEBSHARE_PROXY_URLS",
        ",".join(f"http://user{i}:secret@p.webshare.io:80" for i in range(100)),
    )
    assert AntiBotHttpClient().session_pool_size == 8


def test_explicit_pool_size_overrides_derivation(monkeypatch):
    monkeypatch.setenv("WEBSHARE_SESSION_POOL_SIZE", "12")
    monkeypatch.setenv(
        "WEBSHARE_PROXY_URLS",
        ",".join(f"http://user{i}:secret@p.webshare.io:80" for i in range(100)),
    )
    assert AntiBotHttpClient().session_pool_size == 12


def test_adaptive_limit_recovers_proportionally_for_large_pools():
    """A flat +1 per streak leaves a big pool crippled for the whole search."""
    client = AntiBotHttpClient(session_pool_size=24, concurrency=24)
    client._adaptive_limit = 12
    client._success_streak = 20

    import asyncio
    asyncio.run(client._record_success())

    assert client._adaptive_limit == 15  # +24//8, not +1
