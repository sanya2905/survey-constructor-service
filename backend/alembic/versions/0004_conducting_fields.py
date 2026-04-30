"""add conducting fields to surveys and sessions

Revision ID: 0004_conducting_fields
Revises: 0003_add_published_at
Create Date: 2026-04-30 00:00:00.000001
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_conducting_fields'
down_revision = '0003_add_published_at'
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    inspector = sa.inspect(conn)
    return column in [c["name"] for c in inspector.get_columns(table)]


def upgrade():
    conn = op.get_bind()

    # surveys: conducting settings (ТР-2, ТР-5, ТР-6)
    for col, coltype in [
        ("starts_at",       sa.DateTime(timezone=True)),
        ("ends_at",         sa.DateTime(timezone=True)),
        ("max_responses",   sa.Integer()),
        ("allow_anonymous", sa.Boolean()),
    ]:
        if not _col_exists(conn, "surveys", col):
            nullable = col != "allow_anonymous"
            kw = {"nullable": nullable}
            if col == "allow_anonymous":
                kw["server_default"] = sa.text("true")
            op.add_column("surveys", sa.Column(col, coltype, **kw))

    # survey_sessions: progress tracking (ТР-3, ТР-8)
    for col, coltype, server_default in [
        ("current_page",  sa.Integer(),  sa.text("0")),
        ("progress_pct",  sa.Float(),    sa.text("0.0")),
        ("last_saved_at", sa.DateTime(timezone=True), None),
    ]:
        if not _col_exists(conn, "survey_sessions", col):
            kw: dict = {"nullable": True}
            if server_default is not None:
                kw["server_default"] = server_default
                kw["nullable"] = False
            op.add_column("survey_sessions", sa.Column(col, coltype, **kw))


def downgrade():
    conn = op.get_bind()
    for col in ["starts_at", "ends_at", "max_responses", "allow_anonymous"]:
        if _col_exists(conn, "surveys", col):
            op.drop_column("surveys", col)
    for col in ["current_page", "progress_pct", "last_saved_at"]:
        if _col_exists(conn, "survey_sessions", col):
            op.drop_column("survey_sessions", col)
