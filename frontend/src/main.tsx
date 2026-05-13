import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./AppRoot";

import "./index.css";
import "survey-core/survey-core.min.css";
import "survey-creator-core/survey-creator-core.min.css";

if ("serviceWorker" in navigator) {
  // В dev-режиме SW обычно мешает отладке (кэширует старые ассеты),
  // поэтому регистрируем только в production.
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // игнорируем: PWA должна быть опциональной
      });
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
