import type { Plugin } from "vite";

const HEALTH_URL = "http://127.0.0.1:8001/healthz";

const HINT = `
\x1b[33m⚠ Backend недоступен на http://127.0.0.1:8001\x1b[0m
  Vite проксирует /api → :8001. Запустите API в \x1b[1mдругом терминале\x1b[0m:

  \x1b[36m./scripts/dev-backend.sh\x1b[0m
  или:
  \x1b[36mcd backend && cp -n .env.example .env && docker compose up -d survey-db survey-api\x1b[0m
  или (только БД в Docker):
  \x1b[36mdocker compose up -d survey-db && cd backend && ./migrate.sh && ./run_api.sh\x1b[0m

  Проверка: \x1b[36mcurl http://127.0.0.1:8001/healthz\x1b[0m
`;

export function checkBackendPlugin(): Plugin {
  return {
    name: "check-backend",
    configureServer() {
      fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) })
        .then((res) => {
          if (res.ok) {
            console.log("\x1b[32m✓ API доступен:\x1b[0m http://127.0.0.1:8001\n");
          } else {
            console.warn(HINT);
          }
        })
        .catch(() => {
          console.warn(HINT);
        });
    },
  };
}
