import { useEffect, useState } from "react";
import { Box, IconButton, Slider, Tooltip, Typography } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { SurveyCreatorComponent } from "survey-creator-react";
import type { SurveyCreator } from "survey-creator-react";
import { applyCreatorThemeToElement } from "../surveyCreatorTheme";
import "../survey-creator-overrides.css";

const ZOOM_STORAGE_KEY = "survey-editor-zoom";
const ZOOM_MIN = 70;
const ZOOM_MAX = 115;
const ZOOM_DEFAULT = 85;
const ZOOM_STEP = 5;

function readZoom(): number {
  try {
    const v = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    if (Number.isFinite(v) && v >= ZOOM_MIN && v <= ZOOM_MAX) return v;
  } catch {
    /* ignore */
  }
  return ZOOM_DEFAULT;
}

type CreatorViewportProps = {
  creator: SurveyCreator;
  themeMode: "light" | "dark";
};

export default function CreatorViewport({ creator, themeMode }: CreatorViewportProps) {
  const [zoom, setZoom] = useState(readZoom);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      /* ignore */
    }
  }, [zoom]);

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
  }, [themeMode, zoom]);

  function changeZoom(next: number) {
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, minWidth: 0 }}>
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexShrink: 0,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          Масштаб
        </Typography>
        <Tooltip title="Уменьшить">
          <span>
            <IconButton
              size="small"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => changeZoom(zoom - ZOOM_STEP)}
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Slider
          size="small"
          value={zoom}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          onChange={(_e, v) => changeZoom(v as number)}
          sx={{ width: { xs: 80, sm: 120 }, mx: 0.5 }}
          aria-label="Масштаб конструктора"
        />
        <Tooltip title="Увеличить">
          <span>
            <IconButton
              size="small"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => changeZoom(zoom + ZOOM_STEP)}
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 36, textAlign: "right" }}>
          {zoom}%
        </Typography>
        <Tooltip title="Сбросить масштаб (85%)">
          <IconButton size="small" onClick={() => changeZoom(ZOOM_DEFAULT)}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        className="survey-creator-zoom-host"
        data-theme={themeMode}
        sx={{ bgcolor: themeMode === "dark" ? "#0F172A" : "#F8FAFC" }}
      >
        <Box className="survey-creator-zoom-inner" sx={{ zoom: zoom / 100 }}>
          <SurveyCreatorComponent creator={creator} />
        </Box>
      </Box>
    </Box>
  );
}
