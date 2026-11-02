from urllib.parse import urlencode

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.deps import get_current_user, get_or_404
from app.errors import AppError
from app.meta import service
from app.meta.client import MetaClient, get_meta_client
from app.models import ApplicationUser, ConnectedAccount
from app.schemas import PageOut

router = APIRouter(prefix="/api", tags=["meta"], dependencies=[Depends(get_current_user)])
public_router = APIRouter(prefix="/api/meta", tags=["meta"])


class ImportIn(BaseModel):
    fb_page_ids: list[str] = Field(min_length=1, max_length=100)


@router.get("/meta/status")
def meta_status(client: MetaClient = Depends(get_meta_client)):
    s = get_settings()
    return {"mode": s.meta_mode, "app_configured": client.configured, "scopes": s.meta_scope_list,
            "redirect_uri": s.meta_redirect_uri, "api_version": s.meta_api_version}


@router.post("/accounts/{account_id}/meta/connect")
def connect(account_id: int, db: Session = Depends(get_db), client: MetaClient = Depends(get_meta_client),
            user: ApplicationUser = Depends(get_current_user)):
    account = get_or_404(db, ConnectedAccount, account_id, "Account")
    return {"login_url": service.start_connect(client, user.id, account), "mode": get_settings().meta_mode}


@router.get("/accounts/{account_id}/meta/pages")
def discover_pages(account_id: int, db: Session = Depends(get_db), client: MetaClient = Depends(get_meta_client)):
    account = get_or_404(db, ConnectedAccount, account_id, "Account")
    return {"pages": service.discover(db, client, account)}


@router.post("/accounts/{account_id}/meta/import")
def import_pages(account_id: int, body: ImportIn, db: Session = Depends(get_db), client: MetaClient = Depends(get_meta_client)):
    account = get_or_404(db, ConnectedAccount, account_id, "Account")
    r = service.import_pages(db, client, account, body.fb_page_ids)
    return {"imported": [PageOut.model_validate(p) for p in r["imported"]], "skipped": r["skipped"], "not_found": r["not_found"]}


@router.post("/accounts/{account_id}/meta/sync")
def sync(account_id: int, db: Session = Depends(get_db), client: MetaClient = Depends(get_meta_client)):
    account = get_or_404(db, ConnectedAccount, account_id, "Account")
    return service.sync_account(db, client, account)


@public_router.get("/callback", include_in_schema=False)
def callback(code: str | None = None, state: str | None = None, error: str | None = None,
             db: Session = Depends(get_db), client: MetaClient = Depends(get_meta_client)):
    """Facebook sends the browser here. Public by necessity, so everything is validated through the signed `state`."""
    base = get_settings().frontend_url.rstrip("/") + "/accounts"

    def back(**q) -> RedirectResponse:
        return RedirectResponse(f"{base}?{urlencode(q)}", status_code=303)

    if error or not code or not state:
        return back(meta="denied" if error else "error")
    try:
        account, outcome = service.complete_connection(db, client, code, state)
    except AppError:
        return back(meta="error")
    if outcome == "missing_permissions":
        return back(meta="error", reason="missing_permissions", account=account.id)
    return back(meta="connected", account=account.id)
