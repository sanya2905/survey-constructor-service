#!/usr/bin/env bash
# Run FastAPI on :8001 for Vite dev proxy (npm run dev).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}:${PYTHONPATH:-}"

if [[ ! -f .env ]]; then
  echo "Создайте backend/.env: cp .env.example .env"
  exit 1
fi

PYTHON="python3"
if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
  PYTHON="python"
fi

"$PYTHON" -m pip install -q -r requirements.txt

echo "API: http://127.0.0.1:8001  (healthz: http://127.0.0.1:8001/healthz)"
echo "Нужен PostgreSQL (например: docker compose up -d survey-db)"
exec "$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
