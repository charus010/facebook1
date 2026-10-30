from datetime import datetime, timezone

from sqlalchemy import (JSON, BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ts(**kw):
    return mapped_column(DateTime(timezone=True), **kw)


class ApplicationUser(Base):
    __tablename__ = "application_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = _ts(default=utcnow)


class ConnectedAccount(Base):
    __tablename__ = "connected_accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="needs_reauth", index=True)
    last_sync_at: Mapped[datetime | None] = _ts(nullable=True)
    created_at: Mapped[datetime] = _ts(default=utcnow)


class MetaAuthorization(Base):
    """Phase 3 fills this in. The token is stored ENCRYPTED and is never returned by any API schema."""
    __tablename__ = "meta_authorizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("connected_accounts.id", ondelete="CASCADE"), unique=True)
    meta_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime | None] = _ts(nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = _ts(default=utcnow)


class FacebookPage(Base):
    __tablename__ = "facebook_pages"
    __table_args__ = (CheckConstraint("daily_limit BETWEEN 1 AND 50", name="ck_page_daily_limit"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("connected_accounts.id", ondelete="CASCADE"), index=True)
    fb_page_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="needs_attention", index=True)
    automation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_limit: Mapped[int] = mapped_column(Integer, default=3)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    last_success_at: Mapped[datetime | None] = _ts(nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = _ts(default=utcnow)


class Video(Base):
    __tablename__ = "videos"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), index=True)
    object_key: Mapped[str] = mapped_column(String(512), unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="uploading", index=True)
    category: Mapped[str] = mapped_column(String(50), default="General", index=True)
    created_at: Mapped[datetime] = _ts(default=utcnow)


class Caption(Base):
    __tablename__ = "captions"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    title_key: Mapped[str] = mapped_column(String(200), unique=True)  # lowercase title: blocks duplicates
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), default="General", index=True)
    created_at: Mapped[datetime] = _ts(default=utcnow)


class PostingSchedule(Base):
    __tablename__ = "posting_schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("facebook_pages.id", ondelete="CASCADE"), unique=True)
    days_of_week: Mapped[list] = mapped_column(JSON)  # 0=Monday … 6=Sunday
    times: Mapped[list] = mapped_column(JSON)  # "HH:MM" in the page's timezone
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class PostingJob(Base):
    __tablename__ = "posting_jobs"
    __table_args__ = (Index("ix_jobs_status_time", "status", "scheduled_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("facebook_pages.id", ondelete="CASCADE"), index=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"))
    caption_id: Mapped[int | None] = mapped_column(ForeignKey("captions.id", ondelete="SET NULL"), nullable=True)
    scheduled_at: Mapped[datetime] = _ts()
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = _ts(default=utcnow)


class PublishedPost(Base):
    __tablename__ = "published_posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("posting_jobs.id", ondelete="CASCADE"), unique=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("facebook_pages.id", ondelete="CASCADE"), index=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), index=True)
    fb_post_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime] = _ts(default=utcnow, index=True)


class AnalyticsSnapshot(Base):
    """NULL metric = unavailable from Meta. 0 = Meta reported zero. Never mix the two."""
    __tablename__ = "analytics_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("published_posts.id", ondelete="CASCADE"), index=True)
    captured_at: Mapped[datetime] = _ts(default=utcnow, index=True)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reactions: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ErrorLog(Base):
    __tablename__ = "error_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int | None] = mapped_column(ForeignKey("facebook_pages.id", ondelete="SET NULL"), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(String(500))
    severity: Mapped[str] = mapped_column(String(10), default="error", index=True)
    created_at: Mapped[datetime] = _ts(default=utcnow, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("application_users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(50))
    entity: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = _ts(default=utcnow, index=True)


class ApplicationSetting(Base):
    __tablename__ = "application_settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
