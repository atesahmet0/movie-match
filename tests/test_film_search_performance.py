"""Regression tests for film autocomplete request reuse."""

import asyncio

import pytest

from movie_match.scraper.letterboxd import LetterboxdScraper


@pytest.mark.asyncio
async def test_film_search_coalesces_requests_and_reuses_cache(monkeypatch):
    scraper = LetterboxdScraper(client=object(), cache=object())
    calls = 0
    results = [
        {"slug": f"alien-{index}", "title": f"Alien {index}"}
        for index in range(6)
    ]

    async def fake_fetch(query: str):
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        assert query.casefold() == "alien"
        return results

    monkeypatch.setattr(scraper, "_fetch_film_search", fake_fetch)

    first, second = await asyncio.gather(
        scraper.search_films("  Alien  ", limit=5),
        scraper.search_films("alien", limit=2),
    )
    cached = await scraper.search_films("ALIEN", limit=3)

    assert calls == 1
    assert first == results[:5]
    assert second == results[:2]
    assert cached == results[:3]


@pytest.mark.asyncio
async def test_film_search_does_not_cache_failures(monkeypatch):
    scraper = LetterboxdScraper(client=object(), cache=object())
    calls = 0

    async def flaky_fetch(_query: str):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("temporary failure")
        return [{"slug": "alien", "title": "Alien"}]

    monkeypatch.setattr(scraper, "_fetch_film_search", flaky_fetch)

    with pytest.raises(RuntimeError, match="temporary failure"):
        await scraper.search_films("alien")

    assert await scraper.search_films("alien") == [
        {"slug": "alien", "title": "Alien"}
    ]
    assert calls == 2
