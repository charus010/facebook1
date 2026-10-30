import os

from cryptography.fernet import Fernet

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-use-32b")
os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["APP_MODE"] = "demo"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import Base, get_db, make_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ApplicationUser  # noqa: E402
from app.storage import get_storage  # noqa: E402


class FakeStorage:
    def __init__(self):
        self.objects: dict[str, int] = {}

    def presign_put(self, key, content_type, expires=900):
        return f"https://storage.invalid/{key}"

    def head_size(self, key):
        return self.objects.get(key)

    def delete(self, key):
        self.objects.pop(key, None)


@pytest.fixture()
def db_session():
    engine = make_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    s = Session()
    yield s
    s.close()


@pytest.fixture()
def storage():
    return FakeStorage()


@pytest.fixture()
def client(db_session, storage):
    def _db():
        try:
            yield db_session
        except Exception:
            db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_storage] = lambda: storage
    db_session.add(ApplicationUser(email="admin@example.com", password_hash=hash_password("correct-horse-battery")))
    db_session.commit()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def auth(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
