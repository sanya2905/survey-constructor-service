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
