import os
import re
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.deps import PageParams, audit, get_current_user, get_or_404, paginate
from app.errors import AppError
from app.models import ApplicationUser, PostingJob, Video
from app.schemas import Paginated, VideoOut, VideoUpdate, VideoUploadIn, VideoUploadOut
from app.storage import get_storage

router = APIRouter(prefix="/api/videos", tags=["videos"], dependencies=[Depends(get_current_user)])
ALLOWED_EXT = {".mp4", ".mov", ".m4v"}


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(name))[:150] or "video"


@router.get("", response_model=Paginated[VideoOut])
def list_videos(q: str | None = None, status: str | None = None, category: str | None = None,
                p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(Video).order_by(Video.id.desc())
    if q:
        stmt = stmt.where(Video.filename.ilike(f"%{q}%"))
    if status:
        stmt = stmt.where(Video.status == status)
    if category:
        stmt = stmt.where(Video.category == category)
    return paginate(db, stmt, p, VideoOut)


@router.post("/upload-url", response_model=VideoUploadOut, status_code=201)
def request_upload(body: VideoUploadIn, db: Session = Depends(get_db), storage=Depends(get_storage),
                   user: ApplicationUser = Depends(get_current_user)):
    """Step 1: create the record and get a short-lived presigned URL. The browser uploads straight to object storage."""
    name = _safe_name(body.filename)
    if os.path.splitext(name)[1].lower() not in ALLOWED_EXT or not body.content_type.startswith("video/"):
        raise AppError(422, "UNSUPPORTED_MEDIA", "Only .mp4, .mov and .m4v video files are accepted.")
    if body.size_bytes > get_settings().max_upload_bytes:
        raise AppError(413, "FILE_TOO_LARGE", "File exceeds the maximum upload size.")
    key = f"videos/{uuid.uuid4().hex}/{name}"
    video = Video(filename=name, object_key=key, size_bytes=body.size_bytes, content_type=body.content_type,
                  status="uploading", category=body.category)
    db.add(video)
    db.flush()
    audit(db, user, "create", "video", video.id)
    db.commit()
    return VideoUploadOut(video=video, upload_url=storage.presign_put(key, body.content_type), headers={"Content-Type": body.content_type})


@router.post("/{video_id}/complete", response_model=VideoOut)
def complete_upload(video_id: int, db: Session = Depends(get_db), storage=Depends(get_storage)):
    """Step 2: confirm the object really exists in storage. Deeper media validation/processing is added in Phase 4."""
    video = get_or_404(db, Video, video_id, "Video")
    size = storage.head_size(video.object_key)
    if size is None:
        video.status = "failed"
        db.commit()
        raise AppError(409, "UPLOAD_NOT_FOUND", "The file was not found in storage. Upload it again.")
    video.size_bytes = size
    video.status = "ready"
    db.commit()
    return video


@router.get("/{video_id}", response_model=VideoOut)
def get_video(video_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Video, video_id, "Video")


@router.patch("/{video_id}", response_model=VideoOut)
def update_video(video_id: int, body: VideoUpdate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    video = get_or_404(db, Video, video_id, "Video")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(video, k, _safe_name(v) if k == "filename" else v)
    audit(db, user, "update", "video", video.id)
    db.commit()
    return video


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: int, db: Session = Depends(get_db), storage=Depends(get_storage), user: ApplicationUser = Depends(get_current_user)):
    video = get_or_404(db, Video, video_id, "Video")
    if db.scalar(select(func.count()).select_from(PostingJob).where(PostingJob.video_id == video_id)):
        raise AppError(409, "VIDEO_IN_USE", "This video is used by posting jobs and cannot be deleted.")
    key = video.object_key
    db.delete(video)
    audit(db, user, "delete", "video", video_id)
    db.commit()
    try:
        storage.delete(key)
    except Exception:  # DB row is already gone; an orphaned object is cleaned up by a storage lifecycle rule
        pass
