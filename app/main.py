import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.security import hash_password
from app.db import SessionLocal
from app.errors import install_handlers
from app.models import ApplicationUser
from app.routers import accounts, analytics, auth, captions, errors_log, history, jobs, pages, schedules, settings, videos

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("app")


def bootstrap_admin() -> None:
    """Creates the first login from ADMIN_EMAIL / ADMIN_PASSWORD when no user exists. There is no public sign-up."""
    s = get_settings()
    if not (s.admin_email and s.admin_password):
        return
    with SessionLocal() as db:
        if db.scalar(select(ApplicationUser.id).limit(1)) is None:
            db.add(ApplicationUser(email=s.admin_email.lower(), password_hash=hash_password(s.admin_password)))
            db.commit()
            log.info("initial admin user created")


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap_admin()
    yield


app = FastAPI(title="FB Video Automation API", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_list, allow_methods=["*"], allow_headers=["*"])
install_handlers(app)


@app.middleware("http")
async def request_log(request: Request, call_next):
    rid, t0 = uuid.uuid4().hex[:8], time.perf_counter()
    response = await call_next(request)
    log.info("req=%s %s %s -> %s (%.0f ms)", rid, request.method, request.url.path, response.status_code, (time.perf_counter() - t0) * 1000)
    response.headers["X-Request-ID"] = rid
    return response


for r in (auth, accounts, pages, videos, captions, schedules, jobs, history, analytics, errors_log, settings):
    app.include_router(r.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "mode": get_settings().app_mode, "publishing_enabled": False}


@app.get("/health/ready", tags=["health"])
def ready():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}
