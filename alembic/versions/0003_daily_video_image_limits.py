"""per-page daily video/image counts (replaces image_percent)

Idempotent. Old settings are converted: image_percent of daily_limit becomes images, the rest videos.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _cols() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns("facebook_pages")}


def upgrade() -> None:
    pg = op.get_bind().dialect.name != "sqlite"
    cols = _cols()
    if "daily_video_limit" not in cols:
        op.add_column("facebook_pages", sa.Column("daily_video_limit", sa.Integer(), nullable=False, server_default="3"))
        op.add_column("facebook_pages", sa.Column("daily_image_limit", sa.Integer(), nullable=False, server_default="0"))
        if "image_percent" in cols and "media_mode" in cols:
            op.execute(
                "UPDATE facebook_pages SET "
                "daily_video_limit = CASE WHEN media_mode='image' THEN 0 WHEN media_mode='both' THEN daily_limit - (daily_limit*image_percent)/100 ELSE daily_limit END, "
                "daily_image_limit = CASE WHEN media_mode='image' THEN daily_limit WHEN media_mode='both' THEN (daily_limit*image_percent)/100 ELSE 0 END")
        if pg:
            op.create_check_constraint("ck_page_daily_video_limit", "facebook_pages", "daily_video_limit BETWEEN 0 AND 50")
            op.create_check_constraint("ck_page_daily_image_limit", "facebook_pages", "daily_image_limit BETWEEN 0 AND 50")
    if "image_percent" in cols and pg:
        op.drop_column("facebook_pages", "image_percent")  # PostgreSQL also drops its check constraint


def downgrade() -> None:
    op.drop_column("facebook_pages", "daily_image_limit")
    op.drop_column("facebook_pages", "daily_video_limit")
