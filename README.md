# survey-constructor-service

## Запуск

Backend:

```bash
docker compose up --build
```

Миграции БД (локально, без Docker):

```bash
docker compose up -d survey-db   # PostgreSQL на localhost:5433
cd backend
cp .env.example .env   # при первом запуске
./migrate.sh
```

В `.env` для работы **с хоста** (Codespace) нужен `localhost:5433`, не `survey-db` (это имя только внутри Docker).

Если Alembic пишет `Multiple head revisions`, удалите устаревшие файлы (остались после старых версий репозитория):

```bash
rm -f backend/alembic/versions/0003_add_survey_end_date.py
rm -f backend/alembic/versions/0004_add_survey_start_date.py
rm -f backend/alembic/versions/0007_add_survey_versions.py   # дубликат 0007
cd backend && python -m alembic heads   # должен быть один: 0007_survey_versions
```

Если после удаления дубликата: `Can't locate revision identified by '0007_add_survey_versions'` —
в БД осталась старая запись. Из `backend/`:

```bash
cd backend
python scripts/fix_alembic_version.py
python -m alembic upgrade head
```

Или вручную в PostgreSQL:

```bash
docker compose exec survey-db psql -U survey -d survey_db -c \
  "UPDATE alembic_version SET version_num = '0007_survey_versions' WHERE version_num = '0007_add_survey_versions';"
```

Если таблицы `survey_versions` ещё нет, вместо этого поставьте `0006_add_survey_start_date` и снова `upgrade head`.

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

Frontend (dev, Vite на :5173):

```bash
# 1) API обязателен — без survey-api будет ECONNREFUSED на :8001
docker compose up -d survey-db survey-api
# проверка: curl -s http://localhost:8001/healthz

# 2) фронт
cd frontend
npm run dev
```

Vite проксирует `/api` → `http://127.0.0.1:8001`. Контейнер **`survey-api`** должен быть запущен (порт `8001:8000` в `docker-compose.yml`). Одной БД (`survey-db`) недостаточно.

Откройте браузер на http://localhost:5173/ и используйте `/admin/surveys` для создания анкеты, `/s/<survey_id>` для прохождения.

E2E smoke test
----------------

Чтобы быстро проверить основные сценарии (регистрация, логин, создание анкеты, публикация, автосохранение/обновление, прохождение):

```bash
docker compose up --build -d
python3 scripts/e2e_smoke.py
```

Workflow для CI: [.github/workflows/e2e-smoke.yml](.github/workflows/e2e-smoke.yml)
