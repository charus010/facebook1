from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import PageParams, audit, get_current_user, get_or_404, paginate
from app.errors import AppError
from app.models import ApplicationUser, FacebookPage, PostingSchedule
from app.schemas import Paginated, ScheduleIn, ScheduleOut, ScheduleUpdate

router = APIRouter(prefix="/api/schedules", tags=["schedules"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Paginated[ScheduleOut])
def list_schedules(page_id: int | None = None, p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(PostingSchedule).order_by(PostingSchedule.id)
    if page_id:
        stmt = stmt.where(PostingSchedule.page_id == page_id)
    return paginate(db, stmt, p, ScheduleOut)


@router.post("", response_model=ScheduleOut, status_code=201)
def create_schedule(body: ScheduleIn, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    get_or_404(db, FacebookPage, body.page_id, "Page")
    if db.scalar(select(PostingSchedule.id).where(PostingSchedule.page_id == body.page_id)):
        raise AppError(409, "SCHEDULE_EXISTS", "This page already has a schedule. Update it instead.")
    s = PostingSchedule(**body.model_dump())
    db.add(s)
    db.flush()
    audit(db, user, "create", "schedule", s.id)
    db.commit()
    return s


@router.patch("/{schedule_id}", response_model=ScheduleOut)
def update_schedule(schedule_id: int, body: ScheduleUpdate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    s = get_or_404(db, PostingSchedule, schedule_id, "Schedule")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    audit(db, user, "update", "schedule", s.id)
    db.commit()
    return s


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    s = get_or_404(db, PostingSchedule, schedule_id, "Schedule")
    db.delete(s)
    audit(db, user, "delete", "schedule", schedule_id)
    db.commit()
