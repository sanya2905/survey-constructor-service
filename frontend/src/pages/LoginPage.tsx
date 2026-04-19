import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography, InputAdornment, IconButton, FormControl, InputLabel, OutlinedInput } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { login, setAuthToken, getCurrentUser } from "../api";

export default function LoginPage({ onLogin }: { onLogin?: (role: string) => void }) {
  const [mode, setMode] = useState<"admin" | "researcher" | "student">("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  const toggleShowPassword = () => setShowPassword((s) => !s);

  async function handleLogin() {
    setErr(null);
    try {
      const res: any = await login(username, password);
      setAuthToken(res.access_token);
      const u: any = await getCurrentUser();
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
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? String(e));
    }
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
      <Stack spacing={2} sx={{ width: 420 }}>
        <Typography variant="h5">Вход</Typography>
        <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} aria-label="mode">
          <ToggleButton value="admin">Администратор</ToggleButton>
          <ToggleButton value="researcher">Исследователь</ToggleButton>
          <ToggleButton value="student">Студент</ToggleButton>
        </ToggleButtonGroup>

        <TextField label="Username" value={username} onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} fullWidth />
        <FormControl variant="outlined" fullWidth>
          <InputLabel htmlFor="login-password">Password</InputLabel>
          <OutlinedInput
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <IconButton onClick={toggleShowPassword} edge="end" aria-label="toggle password visibility">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            }
            label="Password"
          />
        </FormControl>

        {err && <Typography color="error">{err}</Typography>}

        <Button variant="contained" onClick={handleLogin}>
          Войти
        </Button>
      </Stack>
    </Box>
  );
}
