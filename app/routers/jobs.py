from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import PageParams, audit, get_current_user, get_or_404, paginate
from app.errors import AppError
from app.models import ApplicationUser, Caption, FacebookPage, PostingJob, Video
from app.schemas import JobCreate, JobOut, Paginated

router = APIRouter(prefix="/api/queue", tags=["queue"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Paginated[JobOut])
def list_jobs(status: str | None = None, page_id: int | None = None, p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(PostingJob).order_by(PostingJob.scheduled_at)
    if status:
        stmt = stmt.where(PostingJob.status == status)
    if page_id:
        stmt = stmt.where(PostingJob.page_id == page_id)
    return paginate(db, stmt, p, JobOut)


@router.post("", response_model=JobOut, status_code=201)
def create_job(body: JobCreate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    """Queues a record only. Nothing is published to Facebook in Phase 2 (no worker, no Meta calls)."""
    get_or_404(db, FacebookPage, body.page_id, "Page")
    video = get_or_404(db, Video, body.video_id, "Video")
    if video.status != "ready":
        raise AppError(409, "VIDEO_NOT_READY", "The video has not finished uploading.")
    if body.caption_id:
        get_or_404(db, Caption, body.caption_id, "Caption")
    when = body.scheduled_at.astimezone(timezone.utc)
    # One job per page per scheduled minute-slot: prevents accidental duplicates.
    key = f"{body.page_id}:{when.strftime('%Y%m%dT%H%MZ')}"
    if db.scalar(select(PostingJob.id).where(PostingJob.idempotency_key == key)):
        raise AppError(409, "DUPLICATE_JOB", "A job for this page at this time already exists.")
    job = PostingJob(page_id=body.page_id, video_id=body.video_id, caption_id=body.caption_id, scheduled_at=when,
                     status="scheduled", idempotency_key=key)
    db.add(job)
    db.flush()
    audit(db, user, "create", "job", job.id)
    db.commit()
    return job


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    job = get_or_404(db, PostingJob, job_id, "Job")
    if job.status != "scheduled":
        raise AppError(409, "JOB_NOT_CANCELLABLE", "Only scheduled jobs can be cancelled.")
    job.status = "cancelled"
    audit(db, user, "cancel", "job", job.id)
    db.commit()
    return job


@router.post("/{job_id}/retry", response_model=JobOut)
def retry_job(job_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    job = get_or_404(db, PostingJob, job_id, "Job")
    if job.status != "failed":
        raise AppError(409, "JOB_NOT_RETRYABLE", "Only failed jobs can be retried.")
    job.status, job.error = "scheduled", None
    audit(db, user, "retry", "job", job.id)
    db.commit()
    return job
