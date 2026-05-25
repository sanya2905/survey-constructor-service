# survey-constructor-service

## Запуск

Backend:

```bash
docker compose up --build
```

Миграции БД (локально, без Docker):

```bash
cd backend
cp .env.example .env   # при первом запуске, поправьте DATABASE_URL
./migrate.sh
```

Скрипт ставит зависимости из `requirements.txt` и запускает `python -m alembic upgrade head`.
**Не вызывайте глобальный `alembic`** из Codespace — у него нет пакетов проекта (`pydantic_settings` и др.).

Вручную (эквивалент):

```bash
cd backend
pip install -r requirements.txt
export PYTHONPATH="$(pwd)"
python -m alembic upgrade head
```

После запуска проверяйте:

- http://localhost:8001/healthz
- http://localhost:8001/docs

Frontend:

```bash
docker compose up --build -d
cd frontend
npm run dev
```

Vite проксирует `/api` на API на хосте (`localhost:8001`), поэтому контейнер `survey-api` должен быть запущен и с проброшенным портом `8001` (см. `docker-compose.yml`). Без этого запросы к `/api/v1/...` дадут **502 Bad Gateway**.

Откройте браузер на http://localhost:5173/ и используйте `/admin/surveys` для создания анкеты, `/s/<survey_id>` для прохождения.

E2E smoke test
----------------

Чтобы быстро проверить основные сценарии (регистрация, логин, создание анкеты, публикация, автосохранение/обновление, прохождение):

```bash
docker compose up --build -d
python3 scripts/e2e_smoke.py
```

Workflow для CI: [.github/workflows/e2e-smoke.yml](.github/workflows/e2e-smoke.yml)
