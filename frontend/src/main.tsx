import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./AppRoot";

import "./index.css";
import "survey-core/survey-core.min.css";
import "survey-creator-core/survey-creator-core.min.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
