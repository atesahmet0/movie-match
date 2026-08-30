"""Tests for progressive search delivery without external services."""

from fastapi.testclient import TestClient

from movie_match.models import ScanStats, UserMatch
from movie_match.web import app as web_app


def test_streaming_search_emits_progress_result_and_completion(monkeypatch):
    async def fake_search(
        query,
        *,
        result_callback=None,
        progress_callback=None,
        cancel_event=None,
    ):
        match = UserMatch(username="ripley", display_name="Ellen Ripley")
        progress_callback("Checking profiles", 1, 4, 0)
        result_callback(match)
        stats = ScanStats(
            film_slug="alien",
            film_title="Alien",
            matches_count=1,
            elapsed_seconds=0.1,
        )
        return {
            "status": "success",
            "film": {"slug": "alien", "title": "Alien"},
            "stats": stats.model_dump(mode="json"),
            "matches_count": 1,
            "matches": [match.model_dump(mode="json")],
        }

    monkeypatch.setattr(web_app, "_run_single_search", fake_search)
    response = TestClient(web_app.app).get(
        "/api/search/stream?films=alien&location=Anywhere&limit=5"
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: progress" in response.text
    assert "event: result" in response.text
    assert '"username": "ripley"' in response.text
    assert "event: complete" in response.text


def test_metrics_endpoint_has_search_health_fields():
    response = TestClient(web_app.app).get("/api/metrics")
    assert response.status_code == 200
    metrics = response.json()["metrics"]
    assert "search_cache_hit_ratio" in metrics
    assert "average_time_to_first_result_seconds" in metrics
    assert "http_requests_total" in metrics
