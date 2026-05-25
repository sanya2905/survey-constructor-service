import creatorThemes from "survey-creator-core/themes/index";

/** Matches MUI theme primary */
export const CREATOR_BRAND = "#003399";
export const CREATOR_BRAND_LIGHT = "#1A4DB3";
export const CREATOR_BRAND_DARK = "#002277";

const COMPACT_UNITS: Record<string, string> = {
  "--sjs2-base-unit-size": "6px",
  "--sjs2-base-unit-spacing": "6px",
  "--sjs2-base-unit-font-size": "6px",
  "--sjs2-base-unit-line-height": "7px",
  "--sjs2-base-unit-radius": "6px",
};

const BRAND_PALETTE: Record<string, string> = {
  "--sjs2-palette-green-400": CREATOR_BRAND_LIGHT,
  "--sjs2-palette-green-600": CREATOR_BRAND,
  "--sjs2-palette-green-700": CREATOR_BRAND_DARK,
  "--sjs2-palette-blue-400": CREATOR_BRAND_LIGHT,
  "--sjs2-palette-blue-600": CREATOR_BRAND,
  "--sjs2-palette-blue-700": CREATOR_BRAND_DARK,
  "--sjs2-color-project-brand-600": CREATOR_BRAND,
  "--sjs2-color-project-brand-400": CREATOR_BRAND_LIGHT,
  "--sjs2-color-project-brand-700": CREATOR_BRAND_DARK,
  "--sjs2-color-project-accent-600": CREATOR_BRAND,
  "--sjs2-color-project-accent-400": CREATOR_BRAND_LIGHT,
  "--sjs2-color-project-accent-700": CREATOR_BRAND_DARK,
};

/**
 * Gray scale with the same *roles* as SurveyJS dark theme:
 * gray-000 = primary text, gray-900 = primary surface, gray-999 = elevated surface.
 */
const DARK_GRAY_SCALE: Record<string, string> = {
  "--sjs2-palette-gray-100": "#334155",
  "--sjs2-palette-gray-150": "#2D3A4F",
  "--sjs2-palette-gray-200": "#293548",
  "--sjs2-palette-gray-250": "#253041",
  "--sjs2-palette-gray-300": "#1E293B",
  "--sjs2-palette-gray-400": "#64748B",
  "--sjs2-palette-gray-500": "#94A3B8",
  "--sjs2-palette-gray-600": "#CBD5E1",
  "--sjs2-palette-gray-700": "#E2E8F0",
  "--sjs2-palette-gray-750": "#F1F5F9",
  "--sjs2-palette-gray-800": "#1E293B",
  "--sjs2-palette-gray-900": "#0F172A",
  "--sjs2-palette-gray-950": "#0B1220",
  "--sjs2-palette-gray-999": "#0F172A",
  "--sjs2-palette-gray-000": "#F1F5F9",
};

const LIGHT_GRAY_SCALE: Record<string, string> = {
  "--sjs2-palette-gray-100": "#F1F5F9",
  "--sjs2-palette-gray-150": "#E2E8F0",
  "--sjs2-palette-gray-200": "#E2E8F0",
  "--sjs2-palette-gray-250": "#CBD5E1",
  "--sjs2-palette-gray-300": "#94A3B8",
  "--sjs2-palette-gray-400": "#64748B",
  "--sjs2-palette-gray-500": "#475569",
  "--sjs2-palette-gray-600": "#334155",
  "--sjs2-palette-gray-700": "#1E293B",
  "--sjs2-palette-gray-750": "#0F172A",
  "--sjs2-palette-gray-800": "#FFFFFF",
  "--sjs2-palette-gray-900": "#F8FAFC",
  "--sjs2-palette-gray-950": "#F1F5F9",
  "--sjs2-palette-gray-999": "#FFFFFF",
  "--sjs2-palette-gray-000": "#0F172A",
};

/** Extra semantic tokens that must differ in light mode (not only palette swap). */
const LIGHT_SEMANTIC: Record<string, string> = {
  "--sjs2-color-bg-static-1-primary": "#FFFFFF",
  "--sjs2-color-bg-static-1-secondary": "rgba(15, 23, 42, 0.06)",
  "--sjs2-color-bg-static-2-primary": "#0F172A",
  "--sjs2-color-bg-static-2-secondary": "rgba(15, 23, 42, 0.08)",
  "--sjs2-color-fg-neutral-on-primary": "#FFFFFF",
  "--sjs2-color-fg-brand-on-primary": "#FFFFFF",
  "--sjs2-color-fg-accent-on-primary": "#FFFFFF",
  "--ctr-surface-background-color": "#E2E8F0",
  "--sjs-layer-3-background-500": "#FFFFFF",
  "--sjs-layer-3-background-400": "#FFFFFF",
  "--sjs-layer-3-foreground-100": "rgba(15, 23, 42, 0.92)",
  "--sjs-layer-3-foreground-50": "rgba(15, 23, 42, 0.55)",
  "--ctr-survey-header-text-title-color": "#0F172A",
  "--ctr-survey-header-text-title-color-placeholder": "rgba(15, 23, 42, 0.4)",
  "--ctr-survey-header-text-description-color": "rgba(15, 23, 42, 0.55)",
  "--ctr-survey-header-text-description-color-placeholder": "rgba(15, 23, 42, 0.4)",
};

type ThemeBundle = {
  vars: Record<string, string>;
  className: string;
};

const appliedKeysByElement = new WeakMap<HTMLElement, Set<string>>();

function getDarkBase(): Record<string, string> {
  return {
    ...((creatorThemes as { DefaultDark?: { cssVariables?: Record<string, string> } }).DefaultDark
      ?.cssVariables ?? {}),
  };
}

function buildThemeBundle(mode: "light" | "dark"): ThemeBundle {
  const base = getDarkBase();
  const grayScale = mode === "dark" ? DARK_GRAY_SCALE : LIGHT_GRAY_SCALE;
  const semantic = mode === "light" ? LIGHT_SEMANTIC : {};

  return {
    className: mode === "dark" ? "svc-creator--app-dark" : "svc-creator--app-light",
    vars: {
      ...base,
      ...COMPACT_UNITS,
      ...grayScale,
      ...BRAND_PALETTE,
      ...semantic,
    },
  };
}

let cachedLight: ThemeBundle | null = null;
let cachedDark: ThemeBundle | null = null;

export function getCreatorThemeBundle(mode: "light" | "dark"): ThemeBundle {
  if (mode === "dark") {
    if (!cachedDark) cachedDark = buildThemeBundle("dark");
    return cachedDark;
  }
  if (!cachedLight) cachedLight = buildThemeBundle("light");
  return cachedLight;
}

export function applyCreatorThemeToElement(container: HTMLElement, mode: "light" | "dark"): void {
  const { vars, className } = getCreatorThemeBundle(mode);

  container.classList.remove("svc-creator--app-dark", "svc-creator--app-light");
  container.classList.add(className);

  const prevKeys = appliedKeysByElement.get(container);
  if (prevKeys) {
    for (const key of prevKeys) {
      container.style.removeProperty(key);
    }
  }

  const nextKeys = new Set<string>();
  for (const [key, value] of Object.entries(vars)) {
    container.style.setProperty(key, value);
    nextKeys.add(key);
  }
  appliedKeysByElement.set(container, nextKeys);
}
