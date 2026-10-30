from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import AnalyticsSnapshot, PublishedPost

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])


def _sum(values: list[int | None]) -> int | None:
    """None (unavailable) is NOT zero: if no post reported the metric, the total is None."""
    known = [v for v in values if v is not None]
    return sum(known) if known else None


@router.get("/summary")
def summary(days: int = Query(7, ge=1, le=365), page_id: int | None = None, db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    latest = (select(AnalyticsSnapshot.post_id, func.max(AnalyticsSnapshot.captured_at).label("m"))
              .group_by(AnalyticsSnapshot.post_id).subquery())
    stmt = (select(PublishedPost.page_id, AnalyticsSnapshot)
            .join(AnalyticsSnapshot, AnalyticsSnapshot.post_id == PublishedPost.id)
            .join(latest, (latest.c.post_id == AnalyticsSnapshot.post_id) & (latest.c.m == AnalyticsSnapshot.captured_at))
            .where(PublishedPost.published_at >= since))
    if page_id:
        stmt = stmt.where(PublishedPost.page_id == page_id)
    rows = db.execute(stmt).all()
    by_page: dict[int, list[AnalyticsSnapshot]] = {}
    for pid, snap in rows:
        by_page.setdefault(pid, []).append(snap)

    def pack(snaps: list[AnalyticsSnapshot]) -> dict:
        return {"posts": len(snaps), **{m: _sum([getattr(s, m) for s in snaps]) for m in ("views", "comments", "reactions")}}

    refreshed = max((s.captured_at for _, s in rows), default=None)
    return {
        "days": days,
        "last_refreshed_at": refreshed,
        "note": "null means the metric was not available from Meta; it is not zero. Data may be delayed.",
        "total": pack([s for _, s in rows]),
        "by_page": {str(pid): pack(s) for pid, s in by_page.items()},
    }
