#!/usr/bin/env bash
# Remove obsolete migration files that create a second Alembic head.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STALE=(
  "alembic/versions/0003_add_survey_end_date.py"
  "alembic/versions/0004_add_survey_start_date.py"
  "alembic/versions/0007_add_survey_versions.py"
)

removed=0
for f in "${STALE[@]}"; do
  if [[ -f "$f" ]]; then
    echo "Removing: $f"
    rm -f "$f"
    removed=1
  fi
done

find alembic/versions -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true

export PYTHONPATH="${ROOT}:${PYTHONPATH:-}"

if command -v python3 >/dev/null; then
  python3 scripts/fix_alembic_version.py || true
fi

echo "Current heads:"
python3 -m alembic heads

if [[ "$removed" -eq 0 ]]; then
  echo "No stale files found. If multiple heads remain, run: python3 -m alembic heads"
fi
