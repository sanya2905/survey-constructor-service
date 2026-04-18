"""initial

Revision ID: 0001_initial
Revises: 
Create Date: 2026-04-18 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def _table_exists(conn, name: str) -> bool:
    inspector = sa.inspect(conn)
    return name in inspector.get_table_names()

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    if not _table_exists(conn, 'surveys'):
        op.create_table(
            'surveys',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('title', sa.String(length=200), nullable=False, server_default=sa.text("'Новая анкета'")),
            sa.Column('description', sa.String(length=500), nullable=True),
            sa.Column('survey_json', postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )

    if not _table_exists(conn, 'survey_sessions'):
        op.create_table(
            'survey_sessions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('survey_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('surveys.id', ondelete='CASCADE'), nullable=False),
            sa.Column('respondent_id', sa.String(length=100), nullable=True),
            sa.Column('answers_json', postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column('is_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )


def downgrade():
    op.drop_table('survey_sessions')
    op.drop_table('surveys')
