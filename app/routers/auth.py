import time

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.db import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import ApplicationUser
from app.schemas import LoginIn, TokenOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple brute-force guard (per process). Use a shared store (Redis) if you run several API workers.
_FAILS: dict[str, list[float]] = {}
_MAX_FAILS, _WINDOW = 5, 15 * 60


def _recent(email: str) -> list[float]:
    now = time.time()
    _FAILS[email] = [t for t in _FAILS.get(email, []) if now - t < _WINDOW]
    return _FAILS[email]


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    key = body.email.lower()
    if len(_recent(key)) >= _MAX_FAILS:
        raise AppError(429, "TOO_MANY_ATTEMPTS", "Too many failed logins. Try again later.")
    user = db.scalar(select(ApplicationUser).where(ApplicationUser.email == key))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        _FAILS.setdefault(key, []).append(time.time())
        raise AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password.")
    _FAILS.pop(key, None)
    return TokenOut(access_token=create_access_token(user.id), expires_in_minutes=get_settings().access_token_minutes)


@router.get("/me", response_model=UserOut)
def me(user: ApplicationUser = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(_: ApplicationUser = Depends(get_current_user)):
    """Tokens are short-lived and stateless: the client discards its token. Server-side revocation can be added with Redis."""
    return None
