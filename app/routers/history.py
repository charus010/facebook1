from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import PageParams, get_current_user, paginate
from app.models import PublishedPost
from app.schemas import Paginated, PostOut

router = APIRouter(prefix="/api/history", tags=["history"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Paginated[PostOut])
def list_history(page_id: int | None = None, video_id: int | None = None, p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(PublishedPost).order_by(PublishedPost.published_at.desc())
    if page_id:
        stmt = stmt.where(PublishedPost.page_id == page_id)
    if video_id:
        stmt = stmt.where(PublishedPost.video_id == video_id)
    return paginate(db, stmt, p, PostOut)
