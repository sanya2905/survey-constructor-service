# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

This is a **survey constructor service** with three components orchestrated by Docker Compose:

| Service | Tech | Port |
|---------|------|------|
| PostgreSQL 16 | `postgres:16` container | `5433` (host) → `5432` (container) |
| Backend API | FastAPI + SQLAlchemy (async) | `8001` (host) → `8000` (container) |
| Frontend | React 19 + Vite + SurveyJS | `5173` (Vite dev) or `80` (nginx prod) |

### Running the stack for development

1. Ensure Docker daemon is running (Cloud Agent VMs): `sudo dockerd > /tmp/dockerd.log 2>&1 &` then wait a few seconds. Use `sudo docker compose` if you get permission denied on `/var/run/docker.sock`.
2. Copy env: `cp backend/.env.example backend/.env` (uses `localhost:5433` for host-side tools; compose overrides `DATABASE_URL` inside `survey-api`).
3. Start all containers: `sudo docker compose up --build -d`
4. API health check: `curl http://localhost:8001/healthz` → `{"status":"ok","db":true}`
5. For frontend development, run Vite dev server in a tmux session: `cd frontend && npm run dev -- --host 0.0.0.0` (serves on `:5173`, proxies `/api` → `localhost:8001`).

### Linting and type-checking

- **ESLint**: `cd frontend && npm run lint` (pre-existing warnings/errors in codebase)
- **TypeScript**: `cd frontend && npx tsc -b --noEmit`

### E2E tests

All tests use only `urllib` (no extra Python deps) and hit the API directly:

```bash
python3 scripts/e2e_smoke.py --api http://localhost:8001/api/v1
python3 scripts/e2e_survey_lifecycle.py --api http://localhost:8001/api/v1
python3 scripts/e2e_public_flow.py --api http://localhost:8001/api/v1
python3 scripts/e2e_stats_and_export.py --api http://localhost:8001/api/v1
```

### Pull requests

- Before opening or updating a PR: `git fetch origin && git rebase origin/main` on the feature branch, resolve conflicts locally, run `cd frontend && npm run build`, then push (`--force-with-lease` after rebase).
- Leave PRs **mergeable** (GitHub: merge state `CLEAN`) so the user only needs to click **Merge**.
- Small infra fixes (e.g. `docker-compose.yml`) may land on `main` directly when they unblock dev; feature work stays on `cursor/*-4e66` branches.

### Gotchas

- The frontend has **no registration UI**. User registration is API-only: `POST /api/v1/auth/register` with `{"username", "password", "email", "role"}`. Survey payloads use the field `survey_json` (not `schema_json`).
- The backend `.env` `DATABASE_URL` must use `survey-db` as host when running inside Docker Compose (default in `.env.example`). Use `localhost:5433` only when running the backend directly on the host.
- Docker in Cloud Agent VMs requires `fuse-overlayfs` storage driver and `iptables-legacy`. The dockerd must be started manually (`sudo dockerd &`).
- The root `package.json` is not the frontend package — the actual frontend is at `frontend/package.json`.
