"""facebook_pages.page_token_encrypted (Fernet-encrypted Page access token)

Idempotent: a brand-new database already has the column from 0001.

Revision ID: 0004
Revises: 0003
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("facebook_pages")}
    if "page_token_encrypted" not in cols:
        op.add_column("facebook_pages", sa.Column("page_token_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("facebook_pages", "page_token_encrypted")
