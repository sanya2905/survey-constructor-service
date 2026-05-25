import { useEffect, useRef, useCallback } from "react";
import { Box } from "@mui/material";
import { SurveyCreatorComponent } from "survey-creator-react";
import type { SurveyCreator } from "survey-creator-react";
import { applyCreatorThemeToElement } from "../surveyCreatorTheme";
import { useEditorChrome } from "../EditorChromeContext";
import "../survey-creator-overrides.css";

const SCROLL_HIDE_THRESHOLD = 48;

type CreatorViewportProps = {
  creator: SurveyCreator;
  themeMode: "light" | "dark";
};

export default function CreatorViewport({ creator, themeMode }: CreatorViewportProps) {
  const { setHidden } = useEditorChrome();
  const scrollRef = useRef<HTMLDivElement>(null);

  const onScrollCapture = useCallback(
    (e: React.UIEvent) => {
      const host = scrollRef.current;
      if (!host) return;

      let maxScroll = host.scrollTop;
      let node = e.target as HTMLElement | null;
      while (node && host.contains(node)) {
        if (node.scrollTop > maxScroll) maxScroll = node.scrollTop;
        node = node.parentElement;
      }
      setHidden(maxScroll > SCROLL_HIDE_THRESHOLD);
    },
    [setHidden],
  );

  useEffect(() => {
    return () => setHidden(false);
  }, [setHidden]);

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
      ref={scrollRef}
      className="survey-creator-viewport-host"
      data-theme={themeMode}
      onScrollCapture={onScrollCapture}
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
