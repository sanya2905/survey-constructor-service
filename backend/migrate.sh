#!/usr/bin/env bash
# Run Alembic with project dependencies. Prefer project venv; fall back to current Python.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}:${PYTHONPATH:-}"

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
