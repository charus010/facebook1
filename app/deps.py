from typing import Any

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db import get_db
from app.errors import AppError
from app.models import ApplicationUser, AuditLog

_bearer = HTTPBearer(auto_error=False)


def get_current_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)) -> ApplicationUser:
    uid = decode_access_token(cred.credentials) if cred else None
    user = db.get(ApplicationUser, uid) if uid else None
    if not user or not user.is_active:
        raise AppError(401, "NOT_AUTHENTICATED", "Please log in.")
    return user


class PageParams:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
        self.page = page
        self.page_size = page_size


def paginate(db: Session, stmt, p: PageParams, schema) -> dict[str, Any]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.limit(p.page_size).offset((p.page - 1) * p.page_size)).all()
    return {"items": [schema.model_validate(r) for r in rows], "total": total, "page": p.page, "page_size": p.page_size}


def get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise AppError(404, "NOT_FOUND", f"{label} not found.")
    return obj


def audit(db: Session, user: ApplicationUser, action: str, entity: str, entity_id: Any = None) -> None:
    db.add(AuditLog(user_id=user.id, action=action, entity=entity, entity_id=str(entity_id) if entity_id is not None else None))


def require_demo_for_status_change() -> None:
    """Connection status must come from Meta checks in production, never from a manual edit."""
    if get_settings().app_mode != "demo":
        raise AppError(403, "STATUS_READ_ONLY", "Status is set by the system in production mode.")
