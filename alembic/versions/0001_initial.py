"""initial schema (all Phase 2 tables)

Revision ID: 0001
Revises:
"""
from alembic import op

from app import models  # noqa: F401
from app.db import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Baseline: creates the tables exactly as defined in app/models.py at this point in time.
    # Every later change must be a NEW migration:  alembic revision --autogenerate -m "describe change"
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
