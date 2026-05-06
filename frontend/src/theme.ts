import { createTheme, type Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

export function createAppTheme(mode: ThemeMode): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#0D9488",
        light: "#14B8A6",
        dark: "#0F766E",
        contrastText: "#fff",
      },
      secondary: {
        main: isDark ? "#94A3B8" : "#0F172A",
      },
      background: {
        default: isDark ? "#0F172A" : "#F8FAFC",
        paper: isDark ? "#1E293B" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#F1F5F9" : "#0F172A",
        secondary: isDark ? "#94A3B8" : "#64748B",
      },
      divider: isDark ? "#334155" : "#E2E8F0",
      success: {
        main: "#059669",
        light: isDark ? "#064E3B" : "#D1FAE5",
      },
      warning: {
        main: "#D97706",
        light: isDark ? "#78350F" : "#FEF3C7",
      },
      error: {
        main: "#DC2626",
        light: isDark ? "#7F1D1D" : "#FEE2E2",
      },
    },
    typography: {
      fontFamily: "'Inter', system-ui, 'Segoe UI', Roboto, sans-serif",
      h4: { fontWeight: 700, letterSpacing: "-0.02em" },
      h5: { fontWeight: 600, letterSpacing: "-0.01em" },
      h6: { fontWeight: 600 },
      body2: { color: isDark ? "#94A3B8" : "#64748B" },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            color: isDark ? "#F1F5F9" : "#0F172A",
            boxShadow: "none",
            borderBottom: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 500,
            borderRadius: 8,
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)"
              : "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
            borderRadius: 12,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-root": {
              backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
              color: isDark ? "#94A3B8" : "#64748B",
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
            padding: "12px 16px",
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child .MuiTableCell-root": { borderBottom: "none" },
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            fontSize: 12,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 500,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: isDark ? "#334155" : "#E2E8F0",
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: "small" },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
    },
  });
}

export default createAppTheme("light");
