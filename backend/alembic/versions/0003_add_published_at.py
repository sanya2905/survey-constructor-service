"""add published_at to surveys

Revision ID: 0003_add_published_at
Revises: 0002_add_users
Create Date: 2026-04-29 00:00:00.000001
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_add_published_at'
down_revision = '0002_add_users'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    inspector = sa.inspect(conn)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def upgrade():
    conn = op.get_bind()
    if not _column_exists(conn, 'surveys', 'published_at'):
        op.add_column('surveys', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    conn = op.get_bind()
    if _column_exists(conn, 'surveys', 'published_at'):
        op.drop_column('surveys', 'published_at')
