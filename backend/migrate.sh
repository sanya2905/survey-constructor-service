#!/usr/bin/env bash
# Run Alembic with project dependencies. Prefer project venv; fall back to current Python.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}:${PYTHONPATH:-}"

# Устаревшие миграции (дублировали 0003/0004 до rename) — дают два head в Alembic.
STALE_MIGRATIONS=(
  "alembic/versions/0003_add_survey_end_date.py"
  "alembic/versions/0004_add_survey_start_date.py"
)
for stale in "${STALE_MIGRATIONS[@]}"; do
  if [[ -f "$stale" ]]; then
    echo "Удаляю устаревшую миграцию: $stale"
    rm -f "$stale"
  fi
done
# Скомпилированные копии тоже могут мешать
find alembic/versions -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true

PYTHON="python3"

if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
  PYTHON="python"
elif [[ ! -d .venv ]]; then
  if python3 -m venv .venv 2>/dev/null; then
    # shellcheck source=/dev/null
    source .venv/bin/activate
    PYTHON="python"
    echo "Using virtualenv: backend/.venv"
  else
    rm -rf .venv 2>/dev/null || true
    echo "venv not available; using system Python (pip install --user)."
    PYTHON="python3"
  fi
fi

"$PYTHON" -m pip install -q -r requirements.txt

if [[ -f .env ]] && grep -q 'survey-db' .env 2>/dev/null; then
  echo "Подсказка: survey-db в .env — Alembic подставит localhost:5433, если survey-db недоступен."
fi
echo "Убедитесь, что PostgreSQL запущен: docker compose up -d survey-db"

echo "Running: $PYTHON -m alembic upgrade head"
exec "$PYTHON" -m alembic upgrade head "$@"
