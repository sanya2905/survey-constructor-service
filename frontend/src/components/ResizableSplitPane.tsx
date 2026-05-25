import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box } from "@mui/material";

const DEFAULT_SECONDARY = 260;
const MIN_PRIMARY = 480;
const MIN_SECONDARY = 180;
const MAX_SECONDARY = 520;

type ResizableSplitPaneProps = {
  primary: ReactNode;
  secondary: ReactNode;
  /** localStorage key suffix */
  storageKey?: string;
  defaultSecondaryWidth?: number;
  minPrimaryWidth?: number;
  minSecondaryWidth?: number;
  maxSecondaryWidth?: number;
  /** Start with secondary panel hidden */
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

function readStoredWidth(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export default function ResizableSplitPane({
  primary,
  secondary,
  storageKey = "split-pane",
  defaultSecondaryWidth = DEFAULT_SECONDARY,
  minPrimaryWidth = MIN_PRIMARY,
  minSecondaryWidth = MIN_SECONDARY,
  maxSecondaryWidth = MAX_SECONDARY,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
}: ResizableSplitPaneProps) {
  const widthKey = `${storageKey}:width`;
  const collapsedKey = `${storageKey}:collapsed`;

  const [secondaryWidth, setSecondaryWidth] = useState(() =>
    readStoredWidth(widthKey, defaultSecondaryWidth),
  );
  const [collapsedInternal, setCollapsedInternal] = useState(() => {
    try {
      return localStorage.getItem(collapsedKey) === "1";
    } catch {
      return defaultCollapsed;
    }
  });
  const collapsed = collapsedProp ?? collapsedInternal;
  const setCollapsed = useCallback(
    (value: boolean) => {
      if (onCollapsedChange) onCollapsedChange(value);
      else setCollapsedInternal(value);
    },
    [onCollapsedChange],
  );
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(widthKey, String(secondaryWidth));
    } catch {
      /* ignore */
    }
  }, [secondaryWidth, widthKey]);

  useEffect(() => {
    if (collapsedProp === undefined) {
      try {
        localStorage.setItem(collapsedKey, collapsed ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }, [collapsed, collapsedKey, collapsedProp]);

  const clampSecondary = useCallback(
    (raw: number, containerWidth: number) => {
      const maxByPrimary = containerWidth - minPrimaryWidth;
      const max = Math.min(maxSecondaryWidth, Math.max(minSecondaryWidth, maxByPrimary));
      return Math.min(max, Math.max(minSecondaryWidth, raw));
    },
    [maxSecondaryWidth, minPrimaryWidth, minSecondaryWidth],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fromRight = rect.right - e.clientX;
      setSecondaryWidth(clampSecondary(fromRight, rect.width));
      setCollapsed(false);
    };

    const onUp = () => setDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, clampSecondary, setCollapsed]);

  const effectiveWidth = collapsed ? 0 : secondaryWidth;

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: minPrimaryWidth,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {primary}
      </Box>

      {!collapsed && (
        <Box
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели истории"
          onMouseDown={() => setDragging(true)}
          sx={{
            width: 6,
            flexShrink: 0,
            cursor: "col-resize",
            bgcolor: dragging ? "primary.main" : "divider",
            opacity: dragging ? 0.35 : 1,
            transition: "background-color 0.15s",
            "&:hover": { bgcolor: "primary.main", opacity: 0.25 },
          }}
        />
      )}

      <Box
        sx={{
          width: effectiveWidth,
          flexShrink: 0,
          minHeight: 0,
          overflow: "hidden",
          display: collapsed ? "none" : "flex",
          flexDirection: "column",
          transition: dragging ? "none" : "width 0.15s ease",
        }}
      >
        {secondary}
      </Box>
    </Box>
  );
}
