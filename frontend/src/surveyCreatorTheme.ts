import creatorThemes from "survey-creator-core/themes/index";

/** Matches MUI theme primary */
export const CREATOR_BRAND = "#003399";
export const CREATOR_BRAND_LIGHT = "#1A4DB3";
export const CREATOR_BRAND_DARK = "#002277";

/** Slightly smaller UI than SurveyJS default (8px base) */
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
};

/** App dark theme (MUI) aligned grays for Survey Creator */
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

/** App light theme aligned grays */
const LIGHT_GRAY_SCALE: Record<string, string> = {
  "--sjs2-palette-gray-100": "#F8FAFC",
  "--sjs2-palette-gray-150": "#F1F5F9",
  "--sjs2-palette-gray-200": "#E2E8F0",
  "--sjs2-palette-gray-250": "#CBD5E1",
  "--sjs2-palette-gray-300": "#94A3B8",
  "--sjs2-palette-gray-400": "#64748B",
  "--sjs2-palette-gray-500": "#475569",
  "--sjs2-palette-gray-600": "#334155",
  "--sjs2-palette-gray-700": "#1E293B",
  "--sjs2-palette-gray-750": "#0F172A",
  "--sjs2-palette-gray-800": "#FFFFFF",
  "--sjs2-palette-gray-900": "#0F172A",
  "--sjs2-palette-gray-950": "#0F172A",
  "--sjs2-palette-gray-999": "#FFFFFF",
  "--sjs2-palette-gray-000": "#0F172A",
};

function buildThemeVars(mode: "light" | "dark"): Record<string, string> {
  const base =
    mode === "dark"
      ? { ...(creatorThemes as { DefaultDark?: { cssVariables?: Record<string, string> } }).DefaultDark?.cssVariables }
      : { ...(creatorThemes as { DefaultDark?: { cssVariables?: Record<string, string> } }).DefaultDark?.cssVariables };

  const grayScale = mode === "dark" ? DARK_GRAY_SCALE : LIGHT_GRAY_SCALE;

  return {
    ...base,
    ...COMPACT_UNITS,
    ...grayScale,
    ...BRAND_PALETTE,
  };
}

let cachedLight: Record<string, string> | null = null;
let cachedDark: Record<string, string> | null = null;

export function getCreatorCssVariables(mode: "light" | "dark"): Record<string, string> {
  if (mode === "dark") {
    if (!cachedDark) cachedDark = buildThemeVars("dark");
    return cachedDark;
  }
  if (!cachedLight) cachedLight = buildThemeVars("light");
  return cachedLight;
}

export function applyCreatorThemeToElement(container: HTMLElement, mode: "light" | "dark"): void {
  const vars = getCreatorCssVariables(mode);
  for (const [key, value] of Object.entries(vars)) {
    container.style.setProperty(key, value);
  }
}
