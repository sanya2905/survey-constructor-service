import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

/**
 * MFE Shell integration (section 7 of architecture docs):
 *
 * This app is packaged as a Module Federation remote so the АСНИ shell can
 * load it dynamically:
 *
 *   http://survey-mfe:5175/assets/remoteEntry.js
 *
 * The shell can then import the App component as:
 *
 *   const App = React.lazy(() => import("surveyConstructor/App"));
 *
 * React and React-DOM are declared as shared singletons so the shell and
 * this remote always use the same React instance (avoids hook-call errors).
 */
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "surveyConstructor",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./api": "./src/api",
      },
      shared: ["react", "react-dom", "react-router-dom", "axios"],
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        secure: false,
        ws: false,
        // увеличим таймауты, чтобы прокси не рвал соединение при медленных ответах
        proxyTimeout: 60000,
        timeout: 60000,
        /* onError(err, req, res) {
          // вернуть понятный ответ вместо необработанного исключения
          if (res && !res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Bad gateway: cannot reach backend", detail: String(err && err.message) }));
          }
        } */
      },
    },
  },
  build: {
    target: "esnext",
    minify: false,
  },
});
