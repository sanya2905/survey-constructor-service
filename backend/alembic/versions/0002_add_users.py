"""add users table

Revision ID: 0002_add_users
Revises: 0001_initial
Create Date: 2026-04-18 00:00:00.000001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002_add_users'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def _table_exists(conn, name: str) -> bool:
    inspector = sa.inspect(conn)
    return name in inspector.get_table_names()


def upgrade():
    conn = op.get_bind()
    if not _table_exists(conn, 'users'):
        op.create_table(
            'users',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('username', sa.String(length=100), nullable=False),
            sa.Column('email', sa.String(length=200), nullable=True),
            sa.Column('hashed_password', sa.String(length=255), nullable=False),
            sa.Column('role', sa.String(length=50), nullable=False, server_default=sa.text("'user'")),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )


def downgrade():
    conn = op.get_bind()
    if _table_exists(conn, 'users'):
        op.drop_table('users')
