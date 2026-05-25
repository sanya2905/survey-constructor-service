import os
import socket
import sys
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from sqlalchemy import create_engine
from alembic import context

# Allow `alembic upgrade head` from backend/ without PYTHONPATH=/app (Docker sets that).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.db import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here for 'autogenerate' support
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata


def _host_resolves(hostname: str) -> bool:
    try:
        socket.getaddrinfo(hostname, None)
        return True
    except OSError:
        return False


def _rewrite_db_host_for_local_alembic(url: str) -> str:
    """survey-db resolves only on the compose network (not in Codespace shell)."""
    if os.getenv("ALEMBIC_SKIP_HOST_REWRITE") == "1":
        return url
    if "survey-db" not in url:
        return url
    if _host_resolves("survey-db"):
        return url

    parsed = urlparse(url)
    host = parsed.hostname or ""
    port = parsed.port or 5432
    if host != "survey-db":
        return url

    # docker-compose maps postgres 5432 -> host 5433
    local_port = 5433 if port == 5432 else port
    netloc = parsed.netloc.replace(f"survey-db:{port}", f"localhost:{local_port}")
    if netloc == parsed.netloc:
        netloc = parsed.netloc.replace("survey-db", f"localhost:{local_port}")

    rewritten = urlunparse(parsed._replace(netloc=netloc))
    print(
        f"[alembic] survey-db is not reachable here; using {rewritten.split('@')[-1]}",
        file=sys.stderr,
    )
    return rewritten


def _get_sync_url():
    url = settings.DATABASE_URL
    url = _rewrite_db_host_for_local_alembic(url)
    # If using asyncpg dialect in SQLAlchemy URL, switch to psycopg2 for Alembic
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "+psycopg2")
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
