import os
import pytest
from httpx import ASGITransport, AsyncClient
from movie_match.cache.db import SqliteCacheBackend
from movie_match.web.app import app


@pytest.mark.asyncio
async def test_sqlite_waitlist_lead_persistence(tmp_path):
    db_file = tmp_path / "test_waitlist.db"
    backend = SqliteCacheBackend(db_path=db_file)
    await backend.init()

    # Save a lead
    lead_id = await backend.save_waitlist_lead("cinephile@example.com", feature="extended_scan_depth")
    assert lead_id > 0

    # Retrieve leads
    leads = await backend.get_waitlist_leads()
    assert len(leads) == 1
    assert leads[0]["email"] == "cinephile@example.com"
    assert leads[0]["feature"] == "extended_scan_depth"
    assert leads[0]["created_at"] > 0

    # Save another lead
    lead_id_2 = await backend.save_waitlist_lead("matcher@film.io", feature="matches_limit_100")
    assert lead_id_2 > lead_id

    leads_all = await backend.get_waitlist_leads()
    assert len(leads_all) == 2
    assert leads_all[0]["email"] == "matcher@film.io"

    await backend.close()


@pytest.mark.asyncio
async def test_waitlist_api_endpoint(tmp_path, monkeypatch):
    test_db = tmp_path / "api_waitlist.db"
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.setattr("movie_match.cache.db.DEFAULT_DB_PATH", test_db)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid email
        res_invalid = await client.post("/api/waitlist", json={"email": "invalid-email", "feature": "tier_extended"})
        assert res_invalid.status_code == 400

        # Valid email
        res_valid = await client.post(
            "/api/waitlist",
            json={"email": "tester@moviematch.com", "feature": "extended_depth"}
        )
        assert res_valid.status_code == 200
        data = res_valid.json()
        assert data["status"] == "success"
        assert "lead_id" in data

        # Get list
        res_list = await client.get("/api/waitlist")
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert list_data["count"] >= 1
        assert any(l["email"] == "tester@moviematch.com" for l in list_data["leads"])
