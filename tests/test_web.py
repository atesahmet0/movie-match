"""Unit tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from movie_match.web.app import app


client = TestClient(app)


def test_home_page():
    response = client.get("/")
    assert response.status_code == 200
    assert "Letterboxd Movie Matcher" in response.text
    assert "Letterboxd Geo Scout" in response.text
    assert "Previous Searches" in response.text


def test_film_info_endpoint():
    response = client.get("/api/film-info?film=vampire-hunter-d-bloodlust")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "vampire-hunter-d-bloodlust"
    assert "Vampire Hunter D" in data["title"]


def test_history_endpoints():
    # Test get history
    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert isinstance(data["history"], list)

    # Test delete history
    del_response = client.delete("/api/history")
    assert del_response.status_code == 200
    assert del_response.json()["status"] == "success"
