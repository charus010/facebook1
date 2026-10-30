from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import PageParams, get_current_user, paginate
from app.models import ErrorLog
from app.schemas import ErrorOut, Paginated

router = APIRouter(prefix="/api/errors", tags=["errors"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Paginated[ErrorOut])
def list_errors(severity: str | None = None, page_id: int | None = None, p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(ErrorLog).order_by(ErrorLog.created_at.desc())
    if severity:
        stmt = stmt.where(ErrorLog.severity == severity)
    if page_id:
        stmt = stmt.where(ErrorLog.page_id == page_id)
    return paginate(db, stmt, p, ErrorOut)
