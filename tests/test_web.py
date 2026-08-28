"""Unit tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from movie_match.web.app import app


client = TestClient(app)


def test_home_page():
    response = client.get("/")
    assert response.status_code == 200
    assert "Letterboxd Movie Matcher" in response.text
    assert "Letterboxd Taste Scout" in response.text
    assert "My Profile & Films" in response.text


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


def test_user_endpoints_validation():
    # Invalid user request
    response = client.get("/api/user/%20")
    assert response.status_code == 400

    # Films invalid user
    response_films = client.get("/api/user/%20/films")
    assert response_films.status_code == 400


def test_taste_match_validation():
    # Empty films list
    response = client.post("/api/taste-match", json={"films": [], "location_query": "Turkey"})
    assert response.status_code == 400


def test_films_search_endpoint():
    response = client.get("/api/films/search?q=alien&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) > 0
    assert "slug" in data["results"][0]
    assert "title" in data["results"][0]


