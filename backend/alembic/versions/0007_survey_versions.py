"""add survey_versions table

Revision ID: 0007_survey_versions
Revises: 0006_add_survey_start_date
Create Date: 2026-05-25 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_survey_versions"
down_revision = "0006_add_survey_start_date"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    inspector = sa.inspect(conn)
    return table in inspector.get_table_names()


def upgrade():
    conn = op.get_bind()
    if _table_exists(conn, "survey_versions"):
        return

    op.create_table(
        "survey_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "survey_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("surveys.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("edited_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("edited_by_name", sa.String(length=200), nullable=True),
        sa.Column("change_summary", sa.String(length=500), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("survey_json_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_survey_versions_survey_id", "survey_versions", ["survey_id"])


def downgrade():
    conn = op.get_bind()
    if not _table_exists(conn, "survey_versions"):
        return
    op.drop_index("ix_survey_versions_survey_id", table_name="survey_versions")
    op.drop_table("survey_versions")
