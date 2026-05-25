import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import create_engine
from alembic import context

# Allow `alembic upgrade head` from backend/ without PYTHONPATH=/app (Docker sets that).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.db import Base
from app.utils.migration_db_url import get_sync_migration_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_sync_url():
    original = settings.DATABASE_URL
    url = get_sync_migration_url()
    if "survey-db" in original and "localhost" in url and original != url:
        print(
            f"[alembic] survey-db is not reachable here; using {url.split('@')[-1]}",
            file=sys.stderr,
        )
    return url


def run_migrations_offline():
    url = _get_sync_url()
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    url = _get_sync_url()
    connectable = create_engine(url)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
