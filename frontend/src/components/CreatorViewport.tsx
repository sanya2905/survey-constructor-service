import { useEffect } from "react";
import { Box } from "@mui/material";
import { SurveyCreatorComponent } from "survey-creator-react";
import type { SurveyCreator } from "survey-creator-react";
import { applyCreatorThemeToElement } from "../surveyCreatorTheme";
import "../survey-creator-overrides.css";

type CreatorViewportProps = {
  creator: SurveyCreator;
  themeMode: "light" | "dark";
};

export default function CreatorViewport({ creator, themeMode }: CreatorViewportProps) {
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function apply() {
      if (cancelled) return;
      const el = document.querySelector(".svc-creator") as HTMLElement | null;
      if (el) {
        applyCreatorThemeToElement(el, themeMode);
        return;
      }
      attempts += 1;
      if (attempts < 25) setTimeout(apply, 100);
    }

    const t = setTimeout(apply, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [themeMode]);

  return (
    <Box
      className="survey-creator-viewport-host"
      data-theme={themeMode}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        bgcolor: themeMode === "dark" ? "#0F172A" : "#E2E8F0",
      }}
    >
      <SurveyCreatorComponent creator={creator} />
    </Box>
  );
}
