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

  // Hide license banner and fix layout issues
  useEffect(() => {
    let cancelled = false;
    let interval: number;

    function hideBannerAndFixLayout() {
      if (cancelled) return;

      // Hide banner footer
      const bannerSelectors = [
        ".sv-root-panel-footer",
        "[class*='panel-footer']",
        "[class*='footer-banner']",
        "[class*='license-banner']",
        ".svc-creator__footer",
        ".sv-components__panel-footer",
        ".svc-footer",
        ".sv-footer",
        ".sv-panel-footer",
      ];

      bannerSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "none";
          htmlEl.style.visibility = "hidden";
          htmlEl.style.height = "0";
          htmlEl.style.overflow = "hidden";
          htmlEl.style.padding = "0";
          htmlEl.style.margin = "0";
          htmlEl.style.border = "none";
        });
      });

      // Fix overflow in logic tab
      const logicElements = document.querySelectorAll(".svc-tab-logic, .svc-plugin-tab__content");
      logicElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.overflow = "auto";
        htmlEl.style.maxHeight = "none";
      });

      // Ensure questions are visible in test tab
      const testTab = document.querySelector(".svc-tab-test");
      if (testTab) {
        const questions = testTab.querySelectorAll(".sd-question, .sv-question");
        questions.forEach((q) => {
          const htmlEl = q as HTMLElement;
          htmlEl.style.display = "block";
          htmlEl.style.visibility = "visible";
          htmlEl.style.opacity = "1";
        });

        const container = testTab.querySelector(".sd-container-modern, .sv-root-modern");
        if (container) {
          const htmlEl = container as HTMLElement;
          htmlEl.style.display = "flex";
          htmlEl.style.flexDirection = "column";
          htmlEl.style.visibility = "visible";
          htmlEl.style.opacity = "1";
        }
      }
    }

    hideBannerAndFixLayout();
    interval = window.setInterval(hideBannerAndFixLayout, 500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
