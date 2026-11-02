"""media_type on videos (video|image) + media_mode/image_percent on facebook_pages

Idempotent: on a brand-new database 0001 already created these columns from the current models, so nothing happens here.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _cols(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    pg = op.get_bind().dialect.name != "sqlite"
    if "media_type" not in _cols("videos"):
        op.add_column("videos", sa.Column("media_type", sa.String(10), nullable=False, server_default="video"))
        op.create_index("ix_videos_media_type", "videos", ["media_type"])
    page_cols = _cols("facebook_pages")
    if "media_mode" not in page_cols:
        op.add_column("facebook_pages", sa.Column("media_mode", sa.String(10), nullable=False, server_default="video"))
    if "image_percent" not in page_cols:
        op.add_column("facebook_pages", sa.Column("image_percent", sa.Integer(), nullable=False, server_default="30"))
        if pg:
            op.create_check_constraint("ck_page_image_percent", "facebook_pages", "image_percent BETWEEN 0 AND 100")


def downgrade() -> None:
    op.drop_column("facebook_pages", "image_percent")
    op.drop_column("facebook_pages", "media_mode")
    op.drop_index("ix_videos_media_type", table_name="videos")
    op.drop_column("videos", "media_type")
