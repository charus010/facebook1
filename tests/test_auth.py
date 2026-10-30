import pytest

from app.routers import auth as auth_router


@pytest.fixture(autouse=True)
def _reset_limiter():
    auth_router._FAILS.clear()


def test_login_success_and_me(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "admin@example.com"
    assert "password" not in me.text


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "nope"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_is_rate_limited_after_repeated_failures(client):
    for _ in range(5):
        client.post("/api/auth/login", json={"email": "admin@example.com", "password": "bad"})
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 429


@pytest.mark.parametrize("path", ["/api/accounts", "/api/pages", "/api/videos", "/api/captions", "/api/schedules",
                                  "/api/queue", "/api/history", "/api/analytics/summary", "/api/errors", "/api/settings"])
def test_private_endpoints_require_token(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_health_is_public_and_publishing_is_off(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["publishing_enabled"] is False
