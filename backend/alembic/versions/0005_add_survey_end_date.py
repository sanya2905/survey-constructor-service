"""add end_date to surveys

Revision ID: 0005_add_survey_end_date
Revises: 0004_conducting_fields
Create Date: 2026-05-11 00:00:00.000001
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_add_survey_end_date'
down_revision = '0004_conducting_fields'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = sa.inspect(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade():
    conn = op.get_bind()
    if not _column_exists(conn, "surveys", "end_date"):
        op.add_column(
            "surveys",
            sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade():
    conn = op.get_bind()
    if _column_exists(conn, "surveys", "end_date"):
        op.drop_column("surveys", "end_date")
