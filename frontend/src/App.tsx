import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";

import AdminSurveysListPage from "./pages/AdminSurveysListPage";
import AdminSurveyEditorPage from "./pages/AdminSurveyEditorPage";
import SurveyStatsPage from "./pages/SurveyStatsPage";
import PublicSurveyRunPage from "./pages/PublicSurveyRunPage";
import LoginPage from "./pages/LoginPage";
import { getCurrentUser, setAuthToken } from "./api";
import { useState, useEffect } from "react";


export default function App() {
  const [authRole, setAuthRole] = useState<string | null>(() => localStorage.getItem("auth_role"));
  const navigate = useNavigate();

  useEffect(() => {
    const onStorage = () => setAuthRole(localStorage.getItem("auth_role"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const tryRestore = async () => {
      if (!authRole) {
        const t = (() => {
          try {
            return localStorage.getItem("token");
          } catch {
            return null;
          }
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

  return (
    <>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Конструктор анкетирования
          </Typography>

          {authRole && (
            <>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {authRole === "admin" ? "Админ" : authRole === "researcher" ? "Исследователь" : authRole === "student" ? "Студент" : authRole}
              </Typography>
              <Button color="inherit" onClick={handleLogout} sx={{ ml: 2 }}>
                Выйти
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ py: 3 }}>
        <Container maxWidth="lg">
          <Routes>
            <Route path="/login" element={<LoginPage onLogin={(r) => setAuthRole(r)} />} />
            <Route path="/" element={<Navigate to="/admin/surveys" replace />} />

            <Route path="/admin/surveys" element={authRole ? <AdminSurveysListPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/surveys/:id" element={authRole ? <AdminSurveyEditorPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/surveys/:id/stats" element={authRole ? <SurveyStatsPage /> : <Navigate to="/login" replace />} />

            {/* Public runner */}
            <Route path="/s/:surveyId" element={<PublicSurveyRunPage />} />

            <Route path="*" element={<div>Not found</div>} />
          </Routes>
        </Container>
      </Box>
    </>
  );
}