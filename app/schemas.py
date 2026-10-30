import re
from datetime import datetime
from typing import Generic, Literal, TypeVar
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

T = TypeVar("T")
AccountStatus = Literal["connected", "needs_reauth", "disconnected"]
PageStatus = Literal["connected", "needs_reauth", "needs_attention"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def check_tz(v: str) -> str:
    try:
        ZoneInfo(v)
    except Exception as e:  # unknown key / bad format
        raise ValueError("Unknown timezone (use names like Asia/Karachi).") from e
    return v


# ---- auth
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class UserOut(ORM):
    id: int
    email: str


# ---- accounts
class AccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr


class AccountUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None
    status: AccountStatus | None = None


class AccountOut(ORM):
    id: int
    name: str
    email: str
    status: str
    last_sync_at: datetime | None
    created_at: datetime


# ---- pages
class PageCreate(BaseModel):
    account_id: int
    fb_page_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    name: str = Field(min_length=1, max_length=200)
    daily_limit: int = Field(3, ge=1, le=50)
    timezone: str = "UTC"

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, v: str) -> str:
        return check_tz(v)


class PageUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    daily_limit: int | None = Field(None, ge=1, le=50)
    timezone: str | None = None
    status: PageStatus | None = None

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, v: str | None) -> str | None:
        return v if v is None else check_tz(v)


class PageOut(ORM):
    id: int
    account_id: int
    fb_page_id: str
    name: str
    status: str
    automation_enabled: bool
    daily_limit: int
    timezone: str
    last_success_at: datetime | None
    last_error: str | None
    created_at: datetime


# ---- videos
class VideoUploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(gt=0)
    content_type: str = Field(max_length=100)
    category: str = Field("General", max_length=50)


class VideoUpdate(BaseModel):
    filename: str | None = Field(None, min_length=1, max_length=200)
    category: str | None = Field(None, max_length=50)


class VideoOut(ORM):
    id: int
    filename: str
    size_bytes: int
    content_type: str
    status: str
    category: str
    created_at: datetime


class VideoUploadOut(BaseModel):
    video: VideoOut
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]


# ---- captions
class CaptionIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    category: str = Field("General", max_length=50)


class CaptionUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, min_length=1, max_length=5000)
    category: str | None = Field(None, max_length=50)


class CaptionOut(ORM):
    id: int
    title: str
    description: str
    category: str


class ImportResult(BaseModel):
    dry_run: bool
    valid: int
    imported: int
    duplicates: int
    invalid: list[str]


# ---- schedules
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def check_days(v: list[int]) -> list[int]:
    if any(d < 0 or d > 6 for d in v):
        raise ValueError("Days must be 0 (Mon) to 6 (Sun).")
    return sorted(set(v))


def check_times(v: list[str]) -> list[str]:
    if any(not _HHMM.match(t) for t in v):
        raise ValueError("Times must look like 09:30.")
    return sorted(set(v))


class ScheduleIn(BaseModel):
    page_id: int
    days_of_week: list[int] = Field(min_length=1, max_length=7)
    times: list[str] = Field(min_length=1, max_length=24)
    enabled: bool = True

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return check_days(v)

    @field_validator("times")
    @classmethod
    def _times(cls, v: list[str]) -> list[str]:
        return check_times(v)


class ScheduleUpdate(BaseModel):
    days_of_week: list[int] | None = Field(None, min_length=1, max_length=7)
    times: list[str] | None = Field(None, min_length=1, max_length=24)
    enabled: bool | None = None

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int] | None) -> list[int] | None:
        return v if v is None else check_days(v)

    @field_validator("times")
    @classmethod
    def _times(cls, v: list[str] | None) -> list[str] | None:
        return v if v is None else check_times(v)


class ScheduleOut(ORM):
    id: int
    page_id: int
    days_of_week: list[int]
    times: list[str]
    enabled: bool


# ---- jobs / history / errors
class JobCreate(BaseModel):
    page_id: int
    video_id: int
    caption_id: int | None = None
    scheduled_at: datetime

    @field_validator("scheduled_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("scheduled_at must include a timezone offset (e.g. 2026-11-01T09:00:00Z).")
        return v


class JobOut(ORM):
    id: int
    page_id: int
    video_id: int
    caption_id: int | None
    scheduled_at: datetime
    status: str
    attempts: int
    error: str | None


class PostOut(ORM):
    id: int
    job_id: int
    page_id: int
    video_id: int
    fb_post_id: str | None
    url: str | None
    published_at: datetime


class ErrorOut(ORM):
    id: int
    page_id: int | None
    code: str
    message: str
    severity: str
    created_at: datetime


class SettingIn(BaseModel):
    value: str = Field(max_length=255)
