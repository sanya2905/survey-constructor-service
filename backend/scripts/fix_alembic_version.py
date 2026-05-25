#!/usr/bin/env python3
"""Fix alembic_version after removing duplicate migration 0007_add_survey_versions."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic.env import _get_sync_url  # noqa: E402

STALE_REVISION = "0007_add_survey_versions"
TARGET_REVISION = "0007_survey_versions"
FALLBACK_REVISION = "0006_add_survey_start_date"


def main() -> int:
    engine = create_engine(_get_sync_url())
    with engine.begin() as conn:
        current = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if current is None:
            print("alembic_version is empty — run: python -m alembic upgrade head")
            return 0
        if current != STALE_REVISION:
            print(f"alembic_version = {current!r} (fix not needed)")
            return 0

        if "survey_versions" in inspect(engine).get_table_names():
            new_rev = TARGET_REVISION
            print("Table survey_versions exists — mapping to", new_rev)
        else:
            new_rev = FALLBACK_REVISION
            print("Table survey_versions missing — reset to", new_rev, "then run upgrade head")

        conn.execute(
            text("UPDATE alembic_version SET version_num = :rev"),
            {"rev": new_rev},
        )
        print(f"Fixed: {STALE_REVISION} -> {new_rev}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
