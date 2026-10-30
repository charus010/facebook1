from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import PageParams, audit, get_current_user, get_or_404, paginate, require_demo_for_status_change
from app.models import ApplicationUser, ConnectedAccount
from app.schemas import AccountCreate, AccountOut, AccountUpdate, Paginated

router = APIRouter(prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Paginated[AccountOut])
def list_accounts(status: str | None = None, q: str | None = None, p: PageParams = Depends(), db: Session = Depends(get_db)):
    stmt = select(ConnectedAccount).order_by(ConnectedAccount.id)
    if status:
        stmt = stmt.where(ConnectedAccount.status == status)
    if q:
        stmt = stmt.where(ConnectedAccount.name.ilike(f"%{q}%"))
    return paginate(db, stmt, p, AccountOut)


@router.post("", response_model=AccountOut, status_code=201)
def create_account(body: AccountCreate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    acc = ConnectedAccount(name=body.name, email=body.email, status="needs_reauth")  # becomes "connected" only via Meta OAuth (Phase 3)
    db.add(acc)
    db.flush()
    audit(db, user, "create", "account", acc.id)
    db.commit()
    return acc


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, ConnectedAccount, account_id, "Account")


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(account_id: int, body: AccountUpdate, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    acc = get_or_404(db, ConnectedAccount, account_id, "Account")
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        require_demo_for_status_change()
    for k, v in data.items():
        setattr(acc, k, v)
    audit(db, user, "update", "account", acc.id)
    db.commit()
    return acc


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db), user: ApplicationUser = Depends(get_current_user)):
    acc = get_or_404(db, ConnectedAccount, account_id, "Account")
    db.delete(acc)
    audit(db, user, "delete", "account", account_id)
    db.commit()
