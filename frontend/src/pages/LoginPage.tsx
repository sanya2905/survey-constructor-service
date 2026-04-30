import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Card, CardContent, Divider,
  FormControl, IconButton, InputAdornment, InputLabel,
  OutlinedInput, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ScienceIcon from "@mui/icons-material/Science";
import SchoolIcon from "@mui/icons-material/School";
import { errorMessage, login, setAuthToken, getCurrentUser } from "../api";
import UnnLogo from "../assets/UnnLogo";

const ROLES = [
  { value: "admin", label: "Администратор", icon: <AdminPanelSettingsIcon sx={{ fontSize: 16 }} /> },
  { value: "researcher", label: "Исследователь", icon: <ScienceIcon sx={{ fontSize: 16 }} /> },
  { value: "student", label: "Студент", icon: <SchoolIcon sx={{ fontSize: 16 }} /> },
] as const;

export default function LoginPage({ onLogin }: { onLogin?: (role: string) => void }) {
  const [mode, setMode] = useState<"admin" | "researcher" | "student">("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function handleLogin() {
    setErr(null);
    setLoading(true);
    try {
      const res = await login(username, password);
      setAuthToken(res.access_token);
      const u = await getCurrentUser();
      if (!u) {
        setErr("Не удалось получить данные пользователя");
        return;
      }
      if (u.role !== mode) {
        setErr("Учётные данные не соответствуют выбранной роли");
        setAuthToken(undefined);
        return;
      }
      localStorage.setItem("auth_role", u.role);
      onLogin?.(u.role);
      nav("/admin/surveys");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 440 }}>
        {/* Header branding */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            mb: 4,
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              bgcolor: "primary.main",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <UnnLogo width={30} height={30} />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
            <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 700 }}>
              Анкетирование
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 13 }}>
              ННГУ им. Лобачевского
            </Typography>
          </Box>
        </Box>

        {/* Login card */}
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
              Вход в систему
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Выберите роль и введите данные
            </Typography>

            {/* Role selector */}
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              aria-label="Роль"
              fullWidth
              sx={{ mb: 3 }}
            >
              {ROLES.map((r) => (
                <ToggleButton
                  key={r.value}
                  value={r.value}
                  sx={{
                    fontSize: 13,
                    py: 1,
                    gap: 0.75,
                    "&.Mui-selected": {
                      bgcolor: "rgba(13,148,136,0.1)",
                      color: "primary.dark",
                      borderColor: "primary.main",
                      "&:hover": { bgcolor: "rgba(13,148,136,0.15)" },
                    },
                  }}
                >
                  {r.icon}
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Divider sx={{ mb: 3 }} />

            <Stack spacing={2}>
              <TextField
                label="Имя пользователя"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                autoComplete="username"
                autoFocus
              />

              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel htmlFor="login-password">Пароль</InputLabel>
                <OutlinedInput
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        aria-label="Показать пароль"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  }
                  label="Пароль"
                />
              </FormControl>

              {err && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "error.light",
                    border: "1px solid",
                    borderColor: "error.main",
                  }}
                >
                  <Typography color="error.main" variant="body2" sx={{ fontWeight: 500 }}>
                    {err}
                  </Typography>
                </Box>
              )}

              <Button
                variant="contained"
                onClick={handleLogin}
                disabled={loading || !username || !password}
                fullWidth
                size="large"
                sx={{ mt: 0.5, fontWeight: 600, py: 1.25 }}
              >
                {loading ? "Вход..." : "Войти"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
