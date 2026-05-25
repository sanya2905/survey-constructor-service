#!/usr/bin/env bash
# Start PostgreSQL + API for local frontend dev (Vite proxies /api → :8001).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cp -n backend/.env.example backend/.env 2>/dev/null || true

if ! docker info >/dev/null 2>&1; then
  echo "Docker не запущен."
  echo ""
  echo "  Codespace: в палитре команд — «Rebuild Container» с включённым Docker,"
  echo "  или запустите демон Docker вручную."
  echo ""
  echo "  Без Docker: поднимите Postgres на localhost:5433 и выполните:"
  echo "    cd backend && ./migrate.sh && ./run_api.sh"
  exit 1
fi

echo "Starting survey-db and survey-api..."
docker compose up -d --build survey-db survey-api

echo "Waiting for http://127.0.0.1:8001/healthz ..."
for _ in $(seq 1 45); do
  if curl -sf http://127.0.0.1:8001/healthz >/dev/null; then
    echo "OK — API ready. Now run: cd frontend && npm run dev"
    exit 0
  fi
  sleep 1
done

echo "API did not become ready in time. Logs:"
docker compose logs --tail=40 survey-api
exit 1
