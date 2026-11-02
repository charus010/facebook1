"""Business rules for connecting accounts and discovering/importing/syncing Pages. Tokens stay inside this module
(encrypted at rest); only names, ids and statuses leave it."""
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decrypt_secret, encrypt_secret
from app.errors import AppError
from app.meta.client import MetaClient, MetaPage
from app.meta.errors import MetaError
from app.models import AuditLog, ConnectedAccount, ErrorLog, FacebookPage, MetaAuthorization, utcnow

log = logging.getLogger("app.meta")
STATE_MINUTES = 10


# ---------- OAuth state (CSRF protection) ----------
def make_state(user_id: int, account_id: int) -> str:
    payload = {"purpose": "meta_oauth", "sub": str(user_id), "acc": account_id, "nonce": secrets.token_urlsafe(8),
               "exp": datetime.now(timezone.utc) + timedelta(minutes=STATE_MINUTES)}
    return jwt.encode(payload, get_settings().secret_key, algorithm="HS256")


def read_state(state: str) -> tuple[int, int]:
    try:
        d = jwt.decode(state, get_settings().secret_key, algorithms=["HS256"])
        if d.get("purpose") != "meta_oauth":
            raise ValueError("wrong purpose")
        return int(d["sub"]), int(d["acc"])
    except (jwt.PyJWTError, KeyError, ValueError) as e:
        raise AppError(400, "INVALID_STATE", "Login session expired or invalid. Start again.") from e


# ---------- helpers ----------
def _log_error(db: Session, code: str, message: str, page_id: int | None = None, severity: str = "error") -> None:
    db.add(ErrorLog(page_id=page_id, code=code, message=message[:500], severity=severity))


def _status_for(page: MetaPage) -> tuple[str, str | None]:
    if page.can_publish:
        return "connected", None
    return "needs_attention", "No permission to publish on this Page (missing CREATE_CONTENT task)."


def _authorization(db: Session, account_id: int) -> MetaAuthorization | None:
    return db.scalar(select(MetaAuthorization).where(MetaAuthorization.account_id == account_id))


def mark_needs_reauth(db: Session, account: ConnectedAccount, reason: str) -> None:
    account.status = "needs_reauth"
    auth = _authorization(db, account.id)
    if auth:
        auth.status = "revoked"
    for p in db.scalars(select(FacebookPage).where(FacebookPage.account_id == account.id)):
        p.status, p.automation_enabled, p.last_error = "needs_reauth", False, reason
    _log_error(db, "META_AUTH_EXPIRED", reason)
    db.commit()


def raise_for_meta(db: Session, account: ConnectedAccount, e: MetaError) -> None:
    """Translate a Meta failure into a safe API error (never includes tokens or Meta's raw message)."""
    log.warning("meta error account=%s kind=%s code=%s subcode=%s", account.id, e.kind, e.code, e.subcode)
    if e.kind == "auth":
        mark_needs_reauth(db, account, "Facebook access expired or was revoked. Reconnect this account.")
        raise AppError(409, "ACCOUNT_NEEDS_REAUTH", "Facebook access expired or was revoked. Reconnect the account.") from e
    if e.kind == "rate_limit":
        raise AppError(429, "META_RATE_LIMITED", "Meta is rate limiting requests. Wait a few minutes and try again.") from e
    if e.kind == "permission":
        raise AppError(403, "META_PERMISSION_DENIED", "Meta denied this request. Check the app's permissions.") from e
    if e.kind == "transient":
        raise AppError(503, "META_UNAVAILABLE", "Could not reach Meta right now. Try again shortly.") from e
    raise AppError(502, "META_ERROR", f"Meta returned an error (code {e.code}).") from e


def _user_token(db: Session, account: ConnectedAccount) -> str:
    auth = _authorization(db, account.id)
    if not auth or not auth.access_token_encrypted or auth.status != "active":
        raise AppError(409, "ACCOUNT_NEEDS_REAUTH", "This account is not connected to Facebook. Connect it first.")
    return decrypt_secret(auth.access_token_encrypted)


# ---------- flows ----------
def start_connect(client: MetaClient, user_id: int, account: ConnectedAccount) -> str:
    if not client.configured:
        raise AppError(503, "META_NOT_CONFIGURED", "Meta App ID/Secret are not set on the server.")
    return client.login_url(make_state(user_id, account.id), hint=str(account.id))


def complete_connection(db: Session, client: MetaClient, code: str, state: str) -> tuple[ConnectedAccount, str]:
    """Returns (account, outcome) where outcome is 'connected' or 'missing_permissions'."""
    user_id, account_id = read_state(state)
    account = db.get(ConnectedAccount, account_id)
    if account is None:
        raise AppError(404, "NOT_FOUND", "Account not found.")
    try:
        short = client.exchange_code(code)
        long = client.extend_token(short.access_token)
        inspection = client.inspect_token(long.access_token)
        me = client.me(long.access_token)
    except MetaError as e:
        log.warning("connect failed account=%s kind=%s code=%s", account.id, e.kind, e.code)
        raise AppError(502, "META_CONNECT_FAILED", "Facebook login could not be completed.") from e

    required = set(get_settings().meta_scope_list)
    granted = set(inspection.scopes)
    auth = _authorization(db, account.id) or MetaAuthorization(account_id=account.id)
    auth.meta_user_id = str(me.get("id") or inspection.user_id or "")
    auth.access_token_encrypted = encrypt_secret(long.access_token)
    auth.scopes, auth.expires_at = sorted(granted), long.expires_at or inspection.expires_at
    ok = inspection.is_valid and required <= granted
    auth.status = "active" if ok else "missing_permissions"
    db.add(auth)
    account.status = "connected" if ok else "needs_reauth"
    account.last_sync_at = utcnow()
    db.add(AuditLog(user_id=user_id, action="connect", entity="account", entity_id=str(account.id)))
    db.commit()
    if not ok:
        _log_error(db, "META_MISSING_PERMISSIONS", "Facebook login finished but not all required permissions were granted.", severity="warning")
        db.commit()
        return account, "missing_permissions"
    try:
        sync_account(db, client, account)  # restores pages of a reconnected account
    except AppError:
        pass
    return account, "connected"


def discover(db: Session, client: MetaClient, account: ConnectedAccount) -> list[dict]:
    try:
        pages = client.list_pages(_user_token(db, account))
    except MetaError as e:
        raise_for_meta(db, account, e)
    existing = {p.fb_page_id: p for p in db.scalars(select(FacebookPage))}
    return [{"fb_page_id": p.id, "name": p.name, "can_publish": p.can_publish,
             "already_imported": p.id in existing and existing[p.id].account_id == account.id,
             "imported_by_other_account": p.id in existing and existing[p.id].account_id != account.id} for p in pages]


def import_pages(db: Session, client: MetaClient, account: ConnectedAccount, fb_page_ids: list[str]) -> dict:
    try:
        visible = {p.id: p for p in client.list_pages(_user_token(db, account))}
    except MetaError as e:
        raise_for_meta(db, account, e)
    imported: list[FacebookPage] = []
    skipped: list[str] = []
    not_found: list[str] = []
    for fid in dict.fromkeys(fb_page_ids):
        mp = visible.get(fid)
        if mp is None:
            not_found.append(fid)
            continue
        row = db.scalar(select(FacebookPage).where(FacebookPage.fb_page_id == fid))
        status, err = _status_for(mp)
        if row is not None and row.account_id != account.id:
            skipped.append(fid)  # already managed through another account
            continue
        if row is None:
            row = FacebookPage(account_id=account.id, fb_page_id=fid, name=mp.name, automation_enabled=False)  # starts PAUSED
            db.add(row)
            imported.append(row)
        row.name, row.status, row.last_error = mp.name, status, err
        row.page_token_encrypted = encrypt_secret(mp.access_token)
    db.add(AuditLog(action="import_pages", entity="account", entity_id=str(account.id)))
    db.commit()
    return {"imported": imported, "skipped": skipped, "not_found": not_found}


def sync_account(db: Session, client: MetaClient, account: ConnectedAccount) -> dict:
    try:
        visible = {p.id: p for p in client.list_pages(_user_token(db, account))}
    except MetaError as e:
        raise_for_meta(db, account, e)
    mine = list(db.scalars(select(FacebookPage).where(FacebookPage.account_id == account.id)))
    updated = lost = 0
    for row in mine:
        mp = visible.get(row.fb_page_id)
        if mp is None:
            row.status, row.automation_enabled = "needs_attention", False
            row.last_error = "This Page is no longer visible to the connected Facebook account."
            lost += 1
            continue
        row.name = mp.name
        row.status, row.last_error = _status_for(mp)
        if row.status != "connected":
            row.automation_enabled = False
        row.page_token_encrypted = encrypt_secret(mp.access_token)  # keep the stored Page token fresh
        updated += 1
    account.status, account.last_sync_at = "connected", utcnow()
    known = {r.fb_page_id for r in mine}
    auth = _authorization(db, account.id)
    expires_soon = bool(auth and auth.expires_at and auth.expires_at.replace(tzinfo=auth.expires_at.tzinfo or timezone.utc) < datetime.now(timezone.utc) + timedelta(days=7))
    db.commit()
    return {"updated": updated, "lost": lost, "new_pages_available": len([i for i in visible if i not in known]),
            "token_expires_soon": expires_soon}
