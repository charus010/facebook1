from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import audit, get_current_user
from app.errors import AppError
from app.models import ApplicationSetting, ApplicationUser
from app.schemas import SettingIn

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(get_current_user)])

DEFAULTS = {"scheduler_paused": "false", "caption_selection_mode": "category", "caption_no_repeat_days": "14"}


def _validate(key: str, value: str) -> None:
    if key == "scheduler_paused" and value in ("true", "false"):
        return
    if key == "caption_selection_mode" and value in ("random", "category"):
        return
    if key == "caption_no_repeat_days" and value.isdigit() and 0 <= int(value) <= 365:
        return
    raise AppError(422, "INVALID_SETTING", f"Invalid value for {key}.")


@router.get("")
def get_settings_all(db: Session = Depends(get_db)):
    stored = {s.key: s.value for s in db.query(ApplicationSetting).all()}
    return {k: stored.get(k, d) for k, d in DEFAULTS.items()}


@router.put("/{key}")
def put_setting(key: str, body: SettingIn, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    if key not in DEFAULTS:
        raise AppError(404, "UNKNOWN_SETTING", "Unknown setting.")
    _validate(key, body.value)
    row = db.get(ApplicationSetting, key)
    if row:
        row.value = body.value
    else:
        db.add(ApplicationSetting(key=key, value=body.value))
    audit(db, user, "update", "setting", key)
    db.commit()
    return {key: body.value}
