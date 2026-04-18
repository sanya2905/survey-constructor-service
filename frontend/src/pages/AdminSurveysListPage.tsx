import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { getSurveys, createSurvey as apiCreateSurvey, deleteSurvey, login, setAuthToken } from "../api";
import type { Survey } from "../api";

export default function AdminSurveysListPage(): JSX.Element {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getSurveys();
      setSurveys(data || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setErr(null);
    try {
      const payload: Partial<Survey> = {
        title: "Новая анкета",
        description: null,
        survey_json: { title: "Новая анкета", pages: [{ name: "page1", elements: [] }] },
      };
      const s = await apiCreateSurvey(payload);
      navigate(`/admin/surveys/${s.id}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    if (!confirm("Удалить анкету?")) return;
    try {
      await deleteSurvey(id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function handleLogin() {
    try {
      const res: any = await login(username, password);
      setAuthToken(res.access_token);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h5">Админ — анкеты</Typography>
        <Button variant="contained" onClick={handleCreate}>
          Создать
        </Button>
        <Button variant="outlined" component={Link} to="/">
          Главная
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} style={{ marginTop: 12 }}>
        <TextField label="username" size="small" value={username} onChange={(e) => setUsername(e.target.value)} />
        <TextField label="password" type="password" size="small" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button variant="contained" onClick={handleLogin}>
          Войти
        </Button>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {surveys.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>{s.is_published ? <Chip color="success" label="published" size="small" /> : <Chip label="draft" size="small" />}</TableCell>
                  <TableCell>
                    <Button size="small" component={Link} to={`/admin/surveys/${s.id}`}>
                      Редактировать
                    </Button>
                    <Button size="small" onClick={() => handleDelete(s.id)}>
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}