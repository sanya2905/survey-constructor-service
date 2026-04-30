import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar, Avatar, Box, Button, Chip, Container,
  Divider, Stack, Toolbar, Tooltip, Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import AssignmentIcon from "@mui/icons-material/Assignment";

import AdminSurveysListPage from "./pages/AdminSurveysListPage";
import AdminSurveyEditorPage from "./pages/AdminSurveyEditorPage";
import SurveyStatsPage from "./pages/SurveyStatsPage";
import PublicSurveyRunPage from "./pages/PublicSurveyRunPage";
import LoginPage from "./pages/LoginPage";
import { getCurrentUser, setAuthToken } from "./api";
import { useState, useEffect } from "react";
import UnnLogo from "./assets/UnnLogo";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  researcher: "Исследователь",
  student: "Студент",
};

function roleInitials(role: string | null): string {
  if (role === "admin") return "АД";
  if (role === "researcher") return "ИС";
  if (role === "student") return "СТ";
  return "?";
}

export default function App() {
  const [authRole, setAuthRole] = useState<string | null>(() => localStorage.getItem("auth_role"));
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onStorage = () => setAuthRole(localStorage.getItem("auth_role"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const tryRestore = async () => {
      if (!authRole) {
        const t = (() => {
          try { return localStorage.getItem("token"); } catch { return null; }
        })();
        if (t) {
          try {
            const u = await getCurrentUser();
            if (u?.role) setAuthRole(u.role);
          } catch {
            setAuthToken(undefined);
          }
        }
      }
    };
    tryRestore();
  }, [authRole]);

  function handleLogout() {
    localStorage.removeItem("auth_role");
    setAuthToken(undefined);
    setAuthRole(null);
    navigate("/login");
  }

  const isPublicPage = location.pathname.startsWith("/s/");
  const isLoginPage = location.pathname === "/login";
  const showNav = !isPublicPage && !isLoginPage;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100svh", bgcolor: "background.default" }}>
      {/* ── Top Navigation Bar ── */}
      {showNav && (
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ gap: 2, minHeight: { xs: 60, sm: 64 } }}>
            {/* Logo */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                gap: 1.5,
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
                flexShrink: 0,
              }}
              onClick={() => navigate("/admin/surveys")}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "primary.main",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                }}
              >
                <UnnLogo width={22} height={22} />
              </Box>
              <Box sx={{ lineHeight: 1 }}>
                <Typography
                  sx={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "text.primary",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  Анкетирование
                </Typography>
                <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.2 }}>
                  ННГУ им. Лобачевского
                </Typography>
              </Box>
            </Box>

            {/* Center nav tabs */}
            {authRole && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 28, alignSelf: "center" }} />
                <Stack direction="row" spacing={0.5}>
                  <NavTab
                    label="Анкеты"
                    icon={<AssignmentIcon sx={{ fontSize: 16 }} />}
                    active={location.pathname.startsWith("/admin/surveys")}
                    onClick={() => navigate("/admin/surveys")}
                  />
                </Stack>
              </>
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* Right side: role chip + logout */}
            {authRole && (
              <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}>
                <Chip
                  label={ROLE_LABELS[authRole] ?? authRole}
                  size="small"
                  sx={{
                    bgcolor: "rgba(13,148,136,0.1)",
                    color: "primary.dark",
                    fontWeight: 600,
                    fontSize: 12,
                    height: 26,
                  }}
                />
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "primary.main",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {roleInitials(authRole)}
                </Avatar>
                <Tooltip title="Выйти">
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleLogout}
                    sx={{ color: "text.secondary", minWidth: 0, px: 1 }}
                    startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                  >
                    Выйти
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Toolbar>
        </AppBar>
      )}

      {/* ── Page content ── */}
      <Box component="main" sx={{ flexGrow: 1, py: isPublicPage || isLoginPage ? 0 : 3 }}>
        <Container maxWidth="lg" sx={{ height: "100%" }}>
          <Routes>
            <Route path="/login" element={<LoginPage onLogin={(r) => setAuthRole(r)} />} />
            <Route path="/" element={<Navigate to="/admin/surveys" replace />} />

            <Route
              path="/admin/surveys"
              element={authRole ? <AdminSurveysListPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin/surveys/:id"
              element={authRole ? <AdminSurveyEditorPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin/surveys/:id/stats"
              element={authRole ? <SurveyStatsPage /> : <Navigate to="/login" replace />}
            />

            <Route path="/s/:surveyId" element={<PublicSurveyRunPage />} />

            <Route
              path="*"
              element={
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
                  <Typography color="text.secondary">Страница не найдена</Typography>
                </Box>
              }
            />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

function NavTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      size="small"
      startIcon={icon}
      sx={{
        color: active ? "primary.main" : "text.secondary",
        fontWeight: active ? 600 : 400,
        fontSize: 14,
        borderRadius: "8px 8px 0 0",
        px: 1.5,
        py: 0.75,
        bgcolor: active ? "rgba(13,148,136,0.08)" : "transparent",
        "&:hover": { bgcolor: "rgba(13,148,136,0.06)", color: "primary.main" },
        borderBottom: "2px solid",
        borderColor: active ? "primary.main" : "transparent",
      }}
    >
      {label}
    </Button>
  );
}
