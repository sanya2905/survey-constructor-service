import { useCallback, useState, useMemo } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { createAppTheme, type ThemeMode } from "./theme";
import { ThemeContext } from "./ThemeContext";

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem("theme_mode");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  return "light";
}

export default function AppRoot() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("theme_mode", next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const ctxValue = useMemo(() => ({ mode, toggleTheme }), [mode, toggleTheme]);

  return (
    <ThemeContext.Provider value={ctxValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
