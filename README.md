# survey-constructor-service

## Запуск

Backend:

```bash
docker compose up --build
```

После запуска проверяйте:

- http://localhost:8001/healthz
- http://localhost:8001/docs

Frontend:

```bash
cd frontend
npm run dev
```

Откройте браузер на http://localhost:5173/ и используйте `/admin/surveys` для создания анкеты, `/s/<survey_id>` для прохождения.

E2E smoke test
----------------

Чтобы быстро проверить основные сценарии (регистрация, логин, создание анкеты, публикация, автосохранение/обновление, прохождение):

```bash
docker compose up --build -d
python3 scripts/e2e_smoke.py
```

Workflow для CI: [.github/workflows/e2e-smoke.yml](.github/workflows/e2e-smoke.yml)
