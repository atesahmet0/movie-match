"""End-to-end comprehensive test suite validating all website user flows, APIs, and rendering."""

import pytest
import unicodedata
from fastapi.testclient import TestClient
from movie_match.web.app import app

client = TestClient(app)


def test_html_home_page_compliance():
    """Verify HTML loads properly, has zero emojis, zero gradients, and correct library imports."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text

    # 1. Check title and brand
    assert "Letterboxd Movie Matcher" in html
    assert "Letterboxd Taste Scout" in html

    # 2. Check libraries loaded
    assert "alpinejs" in html
    assert "lucide" in html
    assert 'name="referrer" content="no-referrer"' in html

    # 3. Check tabs exist
    assert "My Profile & Films" in html
    assert "Taste Soulmates" in html
    assert "Scout Any Film" in html
    assert "Previous Searches" in html

    # 4. Strictly assert NO emojis in the entire HTML
    for line_no, line in enumerate(html.splitlines(), 1):
        for char in line:
            cat = unicodedata.category(char)
            # Check for emoji ranges
            if ord(char) > 0x1F000 or (0x2600 <= ord(char) <= 0x27BF):
                pytest.fail(f"Found emoji '{char}' (U+{ord(char):04X}) at line {line_no}")

    # 5. Strictly assert NO gradients
    assert "bg-gradient-" not in html
    assert "bg-clip-text" not in html
    assert "text-transparent" not in html


def test_user_profile_flow():
    """Test user profile lookup and favorite films poster resolution."""
    # Test valid user
    response = client.get("/api/user/karsten")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    profile = data["profile"]
    assert profile["username"] == "karsten"
    assert "display_name" in profile
    assert isinstance(profile["stats"], dict)
    assert len(profile["favorite_films"]) > 0

    # Ensure favorite films have resolved posters
    for f in profile["favorite_films"]:
        assert f["slug"] is not None
        assert f["title"] is not None
        if f["poster_url"]:
            assert "empty-poster" not in f["poster_url"]
            assert f["poster_url"].startswith("http")


def test_user_films_categories_flow():
    """Test fetching watched, top-rated, and liked films for a user."""
    # Watched films
    resp_films = client.get("/api/user/karsten/films?category=films&page=1")
    assert resp_films.status_code == 200
    data_films = resp_films.json()
    assert data_films["status"] == "success"
    assert isinstance(data_films["films"], list)
    assert len(data_films["films"]) > 0

    # Top rated films
    resp_top = client.get("/api/user/karsten/films?category=top_rated&page=1")
    assert resp_top.status_code == 200
    data_top = resp_top.json()
    assert data_top["status"] == "success"
    assert isinstance(data_top["films"], list)

    # Liked films
    resp_likes = client.get("/api/user/karsten/films?category=likes&page=1")
    assert resp_likes.status_code == 200
    data_likes = resp_likes.json()
    assert data_likes["status"] == "success"


def test_single_film_search_flow():
    """Test scouting fans of a single film by location."""
    response = client.get(
        "/api/search?film=alien&location=Turkey&sentiment=liked&max_pages=1&limit=5&include_bio=true"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "matches" in data
    assert isinstance(data["matches"], list)
    assert "stats" in data
    assert data["stats"]["total_pages_scanned"] > 0


def test_taste_match_soulmates_flow():
    """Test multi-film taste soulmate matching with compatibility scoring."""
    payload = {
        "films": ["alien", "interstellar"],
        "location_query": "Turkey",
        "min_shared_films": 1,
        "max_pages_per_film": 1,
        "limit_matches": 5,
    }
    response = client.post("/api/taste-match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "matches" in data
    assert len(data["matches"]) > 0

    first_match = data["matches"][0]
    assert "username" in first_match
    assert "compatibility_score" in first_match
    assert first_match["compatibility_score"] > 0
    assert "shared_films" in first_match
    assert len(first_match["shared_films"]) >= 1


def test_history_lifecycle_flow():
    """Test search history recording, retrieval, item inspection, and clearing."""
    # 1. Perform a search to record history
    client.get("/api/search?film=sunshine-2007&location=Turkey&sentiment=liked&max_pages=1&limit=2")

    # 2. Get history list
    hist_resp = client.get("/api/history?limit=10")
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert hist_data["status"] == "success"
    assert len(hist_data["history"]) > 0

    first_item = hist_data["history"][0]
    item_id = first_item["id"]

    # 3. Inspect specific history item
    item_resp = client.get(f"/api/history/{item_id}")
    assert item_resp.status_code == 200
    item_data = item_resp.json()
    assert item_data["status"] == "success"
    assert item_data["item"]["id"] == item_id
    assert "results" in item_data["item"]

    # 4. Clear history
    del_resp = client.delete("/api/history")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"

    # Verify cleared
    empty_resp = client.get("/api/history?limit=10")
    assert len(empty_resp.json()["history"]) == 0


def test_api_input_validations():
    """Test boundary conditions and error handling."""
    # Empty username
    assert client.get("/api/user/%20").status_code == 400

    # Missing films in taste-match
    assert client.post("/api/taste-match", json={"films": [], "location_query": "Turkey"}).status_code == 400

    # Nonexistent film info
    resp = client.get("/api/film-info?film=nonexistent-random-film-slug-xyz123")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "nonexistent-random-film-slug-xyz123"
