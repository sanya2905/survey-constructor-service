"""Sync PostgreSQL URL for Alembic and maintenance scripts (psycopg2)."""

from __future__ import annotations

import os
import socket
from urllib.parse import urlparse, urlunparse

from app.core.config import settings


def _host_resolves(hostname: str) -> bool:
    try:
        socket.getaddrinfo(hostname, None)
        return True
    except OSError:
        return False


def _running_in_container() -> bool:
    return os.path.exists("/.dockerenv") or os.getenv("RUNNING_IN_DOCKER") == "1"


def rewrite_db_host_for_container(url: str) -> str:
    """Host .env often uses localhost:5433; inside compose that must be survey-db:5432."""
    if not _running_in_container():
        return url
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host not in ("localhost", "127.0.0.1"):
        return url
    port = parsed.port or 5432
    if port not in (5432, 5433):
        return url
    userinfo = parsed.netloc.split("@")[0] + "@" if "@" in parsed.netloc else ""
    netloc = f"{userinfo}survey-db:5432"
    return urlunparse(parsed._replace(netloc=netloc))


def rewrite_db_host_for_local(url: str) -> str:
    """survey-db resolves only on the compose network (not in Codespace shell)."""
    if os.getenv("ALEMBIC_SKIP_HOST_REWRITE") == "1":
        return url
    if _running_in_container():
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

    local_port = 5433 if port == 5432 else port
    netloc = parsed.netloc.replace(f"survey-db:{port}", f"localhost:{local_port}")
    if netloc == parsed.netloc:
        netloc = parsed.netloc.replace("survey-db", f"localhost:{local_port}")

    return urlunparse(parsed._replace(netloc=netloc))


def get_sync_migration_url() -> str:
    url = settings.DATABASE_URL
    url = rewrite_db_host_for_container(url)
    url = rewrite_db_host_for_local(url)
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "+psycopg2")
    return url
