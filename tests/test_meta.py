from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest

from app.core.config import get_settings
from app.core.security import decrypt_secret
from app.errors import AppError
from app.meta.client import LiveMetaClient
from app.meta.errors import MetaError
from app.models import ConnectedAccount, ErrorLog, FacebookPage, MetaAuthorization


def new_account(client, auth, name="Meta Account"):
    return client.post("/api/accounts", json={"name": name, "email": "m@example.com"}, headers=auth).json()


def connect(client, auth, account_id, follow=False):
    """Runs the whole browser round trip against the mock and returns the redirect Location."""
    url = client.post(f"/api/accounts/{account_id}/meta/connect", headers=auth).json()["login_url"]
    q = parse_qs(urlparse(url).query)
    r = client.get("/api/meta/callback", params={"code": q["code"][0], "state": q["state"][0]}, follow_redirects=False)
    assert r.status_code == 303
    return r.headers["location"]


def test_full_connect_discover_import_flow(client, auth, meta, db_session):
    acc = new_account(client, auth)
    assert acc["status"] == "needs_reauth"
    loc = connect(client, auth, acc["id"])
    assert "meta=connected" in loc and loc.startswith(get_settings().frontend_url)
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).json()["status"] == "connected"

    row = db_session.query(MetaAuthorization).one()
    assert row.status == "active" and "mocktoken" not in row.access_token_encrypted
    assert decrypt_secret(row.access_token_encrypted).startswith("mocktoken-")

    found = client.get(f"/api/accounts/{acc['id']}/meta/pages", headers=auth).json()["pages"]
    assert [p["can_publish"] for p in found] == [True, True, False]
    assert not any(p["already_imported"] for p in found)
    assert "access_token" not in str(found) and "mockpagetoken" not in str(found)

    ids = [p["fb_page_id"] for p in found]
    r = client.post(f"/api/accounts/{acc['id']}/meta/import", json={"fb_page_ids": ids + ["does-not-exist"]}, headers=auth).json()
    assert len(r["imported"]) == 3 and r["not_found"] == ["does-not-exist"]
    assert all(p["automation_enabled"] is False for p in r["imported"])  # imported pages start paused
    assert [p["status"] for p in r["imported"]] == ["connected", "connected", "needs_attention"]
    assert "mockpagetoken" not in str(r)
    stored = db_session.query(FacebookPage).first().page_token_encrypted
    assert stored and "mockpagetoken" not in stored

    again = client.post(f"/api/accounts/{acc['id']}/meta/import", json={"fb_page_ids": ids}, headers=auth).json()
    assert again["imported"] == [] and db_session.query(FacebookPage).count() == 3  # idempotent
    assert all(p["already_imported"] for p in client.get(f"/api/accounts/{acc['id']}/meta/pages", headers=auth).json()["pages"])


def test_bad_expired_and_denied_logins_change_nothing(client, auth, meta):
    acc = new_account(client, auth)
    r = client.get("/api/meta/callback", params={"code": "mock-1", "state": "garbage"}, follow_redirects=False)
    assert "meta=error" in r.headers["location"]
    expired = jwt.encode({"purpose": "meta_oauth", "sub": "1", "acc": acc["id"], "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
                         get_settings().secret_key, algorithm="HS256")
    assert "meta=error" in client.get("/api/meta/callback", params={"code": "mock-1", "state": expired}, follow_redirects=False).headers["location"]
    wrong_purpose = jwt.encode({"purpose": "other", "sub": "1", "acc": acc["id"], "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                               get_settings().secret_key, algorithm="HS256")
    assert "meta=error" in client.get("/api/meta/callback", params={"code": "mock-1", "state": wrong_purpose}, follow_redirects=False).headers["location"]
    assert "meta=denied" in client.get("/api/meta/callback", params={"error": "access_denied"}, follow_redirects=False).headers["location"]
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).json()["status"] == "needs_reauth"


def test_missing_permissions_keeps_account_unconnected(client, auth, meta):
    meta.granted_scopes = ["pages_show_list"]  # user unticked publishing permission
    acc = new_account(client, auth)
    loc = connect(client, auth, acc["id"])
    assert "reason=missing_permissions" in loc
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).json()["status"] == "needs_reauth"
    r = client.get(f"/api/accounts/{acc['id']}/meta/pages", headers=auth)
    assert r.status_code == 409 and r.json()["error"]["code"] == "ACCOUNT_NEEDS_REAUTH"


def test_revoked_access_marks_account_and_pages_then_reconnect_restores(client, auth, meta, db_session):
    acc = new_account(client, auth)
    connect(client, auth, acc["id"])
    ids = [p["fb_page_id"] for p in client.get(f"/api/accounts/{acc['id']}/meta/pages", headers=auth).json()["pages"]][:2]
    client.post(f"/api/accounts/{acc['id']}/meta/import", json={"fb_page_ids": ids}, headers=auth)
    page = db_session.query(FacebookPage).first()
    client.post(f"/api/pages/{page.id}/resume", headers=auth)
    assert client.get(f"/api/pages/{page.id}", headers=auth).json()["automation_enabled"] is True

    meta.errors["list_pages"] = MetaError("Error validating access token", code=190, subcode=460, http_status=400)
    r = client.post(f"/api/accounts/{acc['id']}/meta/sync", headers=auth)
    assert r.status_code == 409 and r.json()["error"]["code"] == "ACCOUNT_NEEDS_REAUTH"
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).json()["status"] == "needs_reauth"
    pages = client.get("/api/pages", headers=auth).json()["items"]
    assert {p["status"] for p in pages} == {"needs_reauth"} and not any(p["automation_enabled"] for p in pages)
    assert client.post(f"/api/pages/{page.id}/resume", headers=auth).status_code == 409
    log = db_session.query(ErrorLog).filter_by(code="META_AUTH_EXPIRED").one()
    assert "mocktoken" not in log.message

    meta.errors.clear()
    connect(client, auth, acc["id"])
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).json()["status"] == "connected"
    assert {p["status"] for p in client.get("/api/pages", headers=auth).json()["items"]} == {"connected"}
    assert not any(p["automation_enabled"] for p in client.get("/api/pages", headers=auth).json()["items"])  # still paused


def test_sync_flags_lost_pages_and_reports_new_ones(client, auth, meta):
    acc = new_account(client, auth)
    connect(client, auth, acc["id"])
    found = client.get(f"/api/accounts/{acc['id']}/meta/pages", headers=auth).json()["pages"]
    client.post(f"/api/accounts/{acc['id']}/meta/import", json={"fb_page_ids": [found[0]["fb_page_id"], found[1]["fb_page_id"]]}, headers=auth)
    meta.lost_page_ids = {found[0]["fb_page_id"]}
    s = client.post(f"/api/accounts/{acc['id']}/meta/sync", headers=auth).json()
    assert s["lost"] == 1 and s["updated"] == 1 and s["new_pages_available"] == 1
    lost = [p for p in client.get("/api/pages", headers=auth).json()["items"] if p["fb_page_id"] == found[0]["fb_page_id"]][0]
    assert lost["status"] == "needs_attention" and "no longer visible" in lost["last_error"]


def test_page_managed_by_another_account_is_skipped(client, auth, meta):
    a = new_account(client, auth, "A")
    connect(client, auth, a["id"])
    pid = client.get(f"/api/accounts/{a['id']}/meta/pages", headers=auth).json()["pages"][0]["fb_page_id"]
    client.post(f"/api/accounts/{a['id']}/meta/import", json={"fb_page_ids": [pid]}, headers=auth)
    b = new_account(client, auth, "B")
    connect(client, auth, b["id"])
    # mock pages are per-account, so fake the clash by importing a's page id through b's session
    meta.lost_page_ids = set()
    from app.meta import client as mc
    orig = meta.list_pages
    meta.list_pages = lambda tok: [mc.MetaPage(pid, "Same page", "t", ["CREATE_CONTENT"])]
    r = client.post(f"/api/accounts/{b['id']}/meta/import", json={"fb_page_ids": [pid]}, headers=auth).json()
    meta.list_pages = orig
    assert r["imported"] == [] and r["skipped"] == [pid]


@pytest.mark.parametrize("code,http,expected", [(4, 400, 429), (613, 400, 429), (10, 403, 403), (1, 500, 503), (999, 400, 502)])
def test_meta_errors_map_to_safe_api_errors(client, auth, meta, code, http, expected):
    acc = new_account(client, auth)
    connect(client, auth, acc["id"])
    meta.errors["list_pages"] = MetaError("raw secret-ish text", code=code, http_status=http)
    r = client.get(f"/api/accounts/{acc['id']}/meta/pages", headers=auth)
    assert r.status_code == expected and "raw secret-ish" not in r.text
    assert client.get(f"/api/accounts/{acc['id']}", headers=auth).json()["status"] == "connected"  # only auth errors disconnect


def test_connect_requires_login_and_known_account(client, auth, meta):
    assert client.post("/api/accounts/1/meta/connect").status_code == 401
    assert client.post("/api/accounts/999/meta/connect", headers=auth).status_code == 404


def test_live_mode_without_credentials_is_refused(client, auth):
    from app.meta.client import get_meta_client
    from app.main import app
    app.dependency_overrides[get_meta_client] = lambda: LiveMetaClient(app_id="", app_secret="")
    acc = new_account(client, auth)
    r = client.post(f"/api/accounts/{acc['id']}/meta/connect", headers=auth)
    assert r.status_code == 503 and r.json()["error"]["code"] == "META_NOT_CONFIGURED"


def test_production_refuses_mock_and_live_needs_credentials(monkeypatch):
    from app.main import assert_safe_config
    s = get_settings()
    monkeypatch.setattr(s, "app_mode", "production")
    monkeypatch.setattr(s, "meta_mode", "mock")
    with pytest.raises(RuntimeError):
        assert_safe_config()
    monkeypatch.setattr(s, "meta_mode", "live")
    monkeypatch.setattr(s, "meta_app_id", "")
    with pytest.raises(RuntimeError):
        assert_safe_config()


# ---- LiveMetaClient against a fake Meta (no network) ----
def make_live(handler):
    return LiveMetaClient(transport=httpx.MockTransport(handler), app_id="123", app_secret="shh")


def test_live_login_url_and_token_exchange():
    seen = {}

    def handler(req: httpx.Request):
        seen[req.url.path] = dict(req.url.params)
        if req.url.path.endswith("/oauth/access_token"):
            return httpx.Response(200, json={"access_token": "TOKEN", "token_type": "bearer", "expires_in": 5183944})
        return httpx.Response(404, json={})

    c = make_live(handler)
    q = parse_qs(urlparse(c.login_url("STATE")).query)
    assert q["client_id"] == ["123"] and q["state"] == ["STATE"] and q["response_type"] == ["code"]
    assert q["scope"] == [",".join(get_settings().meta_scope_list)]
    assert f"/{get_settings().meta_api_version}/dialog/oauth" in c.login_url("S")
    t = c.exchange_code("CODE")
    assert t.access_token == "TOKEN" and t.expires_at > datetime.now(timezone.utc) + timedelta(days=59)
    params = seen[f"/{get_settings().meta_api_version}/oauth/access_token"]
    assert params["code"] == "CODE" and params["client_secret"] == "shh" and params["redirect_uri"] == get_settings().meta_redirect_uri
    c.extend_token("SHORT")
    assert seen[f"/{get_settings().meta_api_version}/oauth/access_token"]["grant_type"] == "fb_exchange_token"


def test_live_list_pages_paginates_and_skips_pages_without_token():
    def handler(req: httpx.Request):
        if req.url.params.get("after") == "C1":
            return httpx.Response(200, json={"data": [{"id": "3", "name": "Third", "access_token": "T3", "tasks": ["CREATE_CONTENT"]}]})
        return httpx.Response(200, json={"data": [{"id": "1", "name": "One", "access_token": "T1", "tasks": ["CREATE_CONTENT", "MANAGE"]},
                                                   {"id": "2", "name": "NoToken", "tasks": ["ANALYZE"]}],
                                         "paging": {"cursors": {"after": "C1"}, "next": "https://graph.facebook.com/next"}})

    pages = make_live(handler).list_pages("USER")
    assert [p.id for p in pages] == ["1", "3"] and pages[0].can_publish


def test_live_inspect_token_parses_debug_token():
    def handler(req: httpx.Request):
        assert req.url.params["access_token"] == "123|shh"
        return httpx.Response(200, json={"data": {"is_valid": True, "scopes": ["pages_show_list"], "expires_at": 0, "user_id": "9"}})

    i = make_live(handler).inspect_token("T")
    assert i.is_valid and i.scopes == ["pages_show_list"] and i.expires_at is None and i.user_id == "9"


@pytest.mark.parametrize("status,body,kind", [
    (400, {"error": {"message": "x", "code": 190, "error_subcode": 463}}, "auth"),
    (400, {"error": {"message": "x", "code": 4}}, "rate_limit"),
    (429, {}, "rate_limit"),
    (403, {"error": {"message": "x", "code": 200}}, "permission"),
    (500, {}, "transient"),
    (400, {"error": {"message": "x", "code": 100}}, "other"),
])
def test_live_error_classification(status, body, kind):
    c = make_live(lambda req: httpx.Response(status, json=body, headers={"Retry-After": "30"}))
    with pytest.raises(MetaError) as e:
        c.me("T")
    assert e.value.kind == kind


def test_live_network_failure_is_transient():
    def boom(req):
        raise httpx.ConnectError("down")

    with pytest.raises(MetaError) as e:
        make_live(boom).me("T")
    assert e.value.kind == "transient"
