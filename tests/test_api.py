from datetime import datetime, timezone

from app.core.security import decrypt_secret, encrypt_secret
from app.models import AnalyticsSnapshot, MetaAuthorization, PostingJob, PublishedPost


def make_account(client, auth, name="Account One"):
    r = client.post("/api/accounts", json={"name": name, "email": "a@example.com"}, headers=auth)
    assert r.status_code == 201
    return r.json()


def make_page(client, auth, account_id, fb="111"):
    r = client.post("/api/pages", json={"account_id": account_id, "fb_page_id": fb, "name": "Page A", "timezone": "Asia/Karachi"}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def make_video(client, auth, storage):
    r = client.post("/api/videos/upload-url", json={"filename": "clip.mp4", "size_bytes": 1000, "content_type": "video/mp4"}, headers=auth)
    assert r.status_code == 201
    vid = r.json()["video"]
    return vid


def test_accounts_crud_pagination_and_validation(client, auth):
    for i in range(3):
        make_account(client, auth, f"Account {i}")
    r = client.get("/api/accounts?page=1&page_size=2", headers=auth).json()
    assert r["total"] == 3 and len(r["items"]) == 2
    assert client.post("/api/accounts", json={"name": "x", "email": "bad"}, headers=auth).status_code == 422
    acc = r["items"][0]
    assert client.patch(f"/api/accounts/{acc['id']}", json={"name": "Renamed"}, headers=auth).json()["name"] == "Renamed"
    assert client.delete(f"/api/accounts/{acc['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).status_code == 404


def test_new_pages_start_paused_and_cannot_resume_until_connected(client, auth):
    acc = make_account(client, auth)
    page = make_page(client, auth, acc["id"])
    assert page["automation_enabled"] is False and page["status"] == "needs_attention"
    assert client.post(f"/api/pages/{page['id']}/resume", headers=auth).status_code == 409
    client.patch(f"/api/pages/{page['id']}", json={"status": "connected"}, headers=auth)  # allowed in demo mode only
    assert client.post(f"/api/pages/{page['id']}/resume", headers=auth).json()["automation_enabled"] is True
    assert client.post(f"/api/pages/{page['id']}/pause", headers=auth).json()["automation_enabled"] is False


def test_page_validation_and_duplicates(client, auth):
    acc = make_account(client, auth)
    bad = {"account_id": acc["id"], "fb_page_id": "1", "name": "P", "daily_limit": 99}
    assert client.post("/api/pages", json=bad, headers=auth).status_code == 422
    bad_tz = {"account_id": acc["id"], "fb_page_id": "2", "name": "P", "timezone": "Mars/Base"}
    assert client.post("/api/pages", json=bad_tz, headers=auth).status_code == 422
    make_page(client, auth, acc["id"], fb="777")
    dup = {"account_id": acc["id"], "fb_page_id": "777", "name": "Again"}
    assert client.post("/api/pages", json=dup, headers=auth).status_code == 409


def test_production_mode_blocks_manual_status_changes(client, auth, monkeypatch):
    from app.core.config import get_settings
    acc = make_account(client, auth)
    monkeypatch.setattr(get_settings(), "app_mode", "production")
    r = client.patch(f"/api/accounts/{acc['id']}", json={"status": "connected"}, headers=auth)
    assert r.status_code == 403


def test_video_upload_flow_and_validation(client, auth, storage):
    bad = client.post("/api/videos/upload-url", json={"filename": "x.exe", "size_bytes": 10, "content_type": "video/mp4"}, headers=auth)
    assert bad.status_code == 422
    r = client.post("/api/videos/upload-url", json={"filename": "../../evil name.mp4", "size_bytes": 1000, "content_type": "video/mp4"}, headers=auth).json()
    video = r["video"]
    assert ".." not in video["filename"] and "/" not in video["filename"]
    assert r["upload_url"].startswith("https://storage.invalid/videos/")
    assert client.post(f"/api/videos/{video['id']}/complete", headers=auth).status_code == 409  # not uploaded yet
    key = r["upload_url"].replace("https://storage.invalid/", "")
    storage.objects[key] = 1234  # simulate the browser finishing the direct upload
    done = client.post(f"/api/videos/{video['id']}/complete", headers=auth)
    assert done.status_code == 200 and done.json()["status"] == "ready" and done.json()["size_bytes"] == 1234


def test_caption_duplicate_blocking_and_csv_import(client, auth):
    assert client.post("/api/captions", json={"title": "Hello", "description": "d"}, headers=auth).status_code == 201
    assert client.post("/api/captions", json={"title": "hello", "description": "d2"}, headers=auth).status_code == 409
    csv_data = b"title,description,category\nNew one,Desc,Travel\nHELLO,dup,Food\n,missing title,Food\nNew one,again,Food\n"
    files = {"file": ("c.csv", csv_data, "text/csv")}
    dry = client.post("/api/captions/import?dry_run=true", files=files, headers=auth).json()
    assert dry["valid"] == 1 and dry["duplicates"] == 2 and len(dry["invalid"]) == 1 and dry["imported"] == 0
    assert client.get("/api/captions", headers=auth).json()["total"] == 1
    real = client.post("/api/captions/import?dry_run=false", files={"file": ("c.csv", csv_data, "text/csv")}, headers=auth).json()
    assert real["imported"] == 1
    assert client.get("/api/captions", headers=auth).json()["total"] == 2
    bad = client.post("/api/captions/import", files={"file": ("c.txt", b"x", "text/plain")}, headers=auth)
    assert bad.status_code == 422


def test_schedule_validation_and_one_per_page(client, auth):
    acc = make_account(client, auth)
    page = make_page(client, auth, acc["id"])
    body = {"page_id": page["id"], "days_of_week": [0, 2, 2, 4], "times": ["18:30", "09:00"]}
    r = client.post("/api/schedules", json=body, headers=auth)
    assert r.status_code == 201 and r.json()["days_of_week"] == [0, 2, 4] and r.json()["times"] == ["09:00", "18:30"]
    assert client.post("/api/schedules", json=body, headers=auth).status_code == 409
    assert client.post("/api/schedules", json={**body, "page_id": 999}, headers=auth).status_code == 404
    assert client.patch(f"/api/schedules/{r.json()['id']}", json={"times": ["25:99"]}, headers=auth).status_code == 422


def test_queue_duplicate_prevention_cancel_and_retry(client, auth, storage, db_session):
    acc = make_account(client, auth)
    page = make_page(client, auth, acc["id"])
    video = make_video(client, auth, storage)
    when = "2030-01-01T09:00:00+00:00"
    job_body = {"page_id": page["id"], "video_id": video["id"], "scheduled_at": when}
    assert client.post("/api/queue", json=job_body, headers=auth).status_code == 409  # video still uploading
    from app.models import Video
    db_session.get(Video, video["id"]).status = "ready"
    db_session.commit()
    assert client.post("/api/queue", json={**job_body, "scheduled_at": "2030-01-01T09:00:00"}, headers=auth).status_code == 422  # naive time
    job = client.post("/api/queue", json=job_body, headers=auth)
    assert job.status_code == 201
    assert client.post("/api/queue", json=job_body, headers=auth).status_code == 409  # duplicate
    jid = job.json()["id"]
    assert client.post(f"/api/queue/{jid}/retry", headers=auth).status_code == 409  # not failed
    assert client.post(f"/api/queue/{jid}/cancel", headers=auth).json()["status"] == "cancelled"
    assert client.post(f"/api/queue/{jid}/cancel", headers=auth).status_code == 409
    row = db_session.get(PostingJob, jid)
    row.status = "failed"
    db_session.commit()
    assert client.post(f"/api/queue/{jid}/retry", headers=auth).json()["status"] == "scheduled"
    assert client.delete(f"/api/videos/{video['id']}", headers=auth).status_code == 409  # in use


def test_settings_validation(client, auth):
    assert client.get("/api/settings", headers=auth).json()["caption_selection_mode"] == "category"
    assert client.put("/api/settings/caption_no_repeat_days", json={"value": "30"}, headers=auth).status_code == 200
    assert client.put("/api/settings/caption_no_repeat_days", json={"value": "-1"}, headers=auth).status_code == 422
    assert client.put("/api/settings/nope", json={"value": "x"}, headers=auth).status_code == 404
    assert client.get("/api/settings", headers=auth).json()["caption_no_repeat_days"] == "30"


def test_analytics_distinguishes_unavailable_from_zero(client, auth, storage, db_session):
    acc = make_account(client, auth)
    page = make_page(client, auth, acc["id"])
    video = make_video(client, auth, storage)
    job = PostingJob(page_id=page["id"], video_id=video["id"], scheduled_at=datetime.now(timezone.utc), status="published", idempotency_key="k1")
    db_session.add(job)
    db_session.flush()
    post = PublishedPost(job_id=job.id, page_id=page["id"], video_id=video["id"], fb_post_id="sample", published_at=datetime.now(timezone.utc))
    db_session.add(post)
    db_session.flush()
    db_session.add(AnalyticsSnapshot(post_id=post.id, views=None, comments=0, reactions=5, captured_at=datetime.now(timezone.utc)))
    db_session.commit()
    data = client.get("/api/analytics/summary?days=7", headers=auth).json()
    assert data["total"]["views"] is None      # unavailable, NOT 0
    assert data["total"]["comments"] == 0      # real zero
    assert data["total"]["reactions"] == 5
    assert data["last_refreshed_at"] is not None


def test_meta_token_is_encrypted_and_never_returned(client, auth, db_session):
    acc = make_account(client, auth)
    secret = "EAAB-super-secret-token"
    db_session.add(MetaAuthorization(account_id=acc["id"], access_token_encrypted=encrypt_secret(secret)))
    db_session.commit()
    stored = db_session.query(MetaAuthorization).one().access_token_encrypted
    assert secret not in stored and decrypt_secret(stored) == secret
    for path in (f"/api/accounts/{acc['id']}", "/api/accounts", "/api/pages"):
        assert secret not in client.get(path, headers=auth).text
        assert "token" not in client.get(path, headers=auth).text.lower()
