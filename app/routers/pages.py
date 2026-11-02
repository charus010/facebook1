from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import PageParams, audit, get_current_user, get_or_404, paginate, require_demo_for_status_change
from app.errors import AppError
from app.models import ApplicationUser, ConnectedAccount, FacebookPage
from app.schemas import Paginated, PageCreate, PageOut, PageUpdate

def _apply_limits(page: FacebookPage) -> None:
    """daily_limit and media_mode are derived from the per-type daily counts."""
    v, i = page.daily_video_limit, page.daily_image_limit
    page.daily_limit = v + i
    page.media_mode = "both" if v and i else "video" if v else "image"


router = APIRouter(prefix="/api/pages", tags=["pages"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Paginated[PageOut])
def list_pages(account_id: int | None = None, status: str | None = None, enabled: bool | None = None, q: str | None = None,
               p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(FacebookPage).order_by(FacebookPage.id)
    if account_id:
        stmt = stmt.where(FacebookPage.account_id == account_id)
    if status:
        stmt = stmt.where(FacebookPage.status == status)
    if enabled is not None:
        stmt = stmt.where(FacebookPage.automation_enabled == enabled)
    if q:
        stmt = stmt.where(FacebookPage.name.ilike(f"%{q}%"))
    return paginate(db, stmt, p, PageOut)


@router.post("", response_model=PageOut, status_code=201)
def create_page(body: PageCreate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    get_or_404(db, ConnectedAccount, body.account_id, "Account")
    # New pages start PAUSED and "needs_attention" until Phase 3 verifies publish permission with Meta.
    page = FacebookPage(**body.model_dump(), status="needs_attention", automation_enabled=False)
    _apply_limits(page)
    db.add(page)
    db.flush()
    audit(db, user, "create", "page", page.id)
    db.commit()
    return page


@router.get("/{page_id}", response_model=PageOut)
def get_page(page_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, FacebookPage, page_id, "Page")


@router.patch("/{page_id}", response_model=PageOut)
def update_page(page_id: int, body: PageUpdate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    page = get_or_404(db, FacebookPage, page_id, "Page")
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        require_demo_for_status_change()
    for k, v in data.items():
        setattr(page, k, v)
    if "daily_video_limit" in data or "daily_image_limit" in data:
        if not 1 <= page.daily_video_limit + page.daily_image_limit <= 50:
            db.rollback()
            raise AppError(422, "INVALID_DAILY_LIMITS", "Videos + images per day must total 1 to 50.")
        _apply_limits(page)
    if page.status != "connected":
        page.automation_enabled = False
    audit(db, user, "update", "page", page.id)
    db.commit()
    return page


@router.post("/{page_id}/pause", response_model=PageOut)
def pause_page(page_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    page = get_or_404(db, FacebookPage, page_id, "Page")
    page.automation_enabled = False
    audit(db, user, "pause", "page", page.id)
    db.commit()
    return page


@router.post("/{page_id}/resume", response_model=PageOut)
def resume_page(page_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    page = get_or_404(db, FacebookPage, page_id, "Page")
    if page.status != "connected":
        raise AppError(409, "PAGE_NOT_CONNECTED", "Only pages with verified, valid authorization can be resumed.")
    page.automation_enabled = True
    audit(db, user, "resume", "page", page.id)
    db.commit()
    return page


@router.delete("/{page_id}", status_code=204)
def delete_page(page_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    page = get_or_404(db, FacebookPage, page_id, "Page")
    db.delete(page)
    audit(db, user, "delete", "page", page_id)
    db.commit()
