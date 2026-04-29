import { useEffect, useState } from "react";
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
  Typography,
} from "@mui/material";
import { getSurveys, createSurvey as apiCreateSurvey, deleteSurvey, getCurrentUser, errorMessage } from "../api";
import type { Survey } from "../api";

export default function AdminSurveysListPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role?: string; username?: string } | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getSurveys();
      setSurveys(data || []);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    try {
      const u = await getCurrentUser();
      setCurrentUser(u);
    } catch {
      const role = localStorage.getItem("auth_role");
      if (role) setCurrentUser({ role });
      else setCurrentUser(null);
    }
  }

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
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    if (!confirm("Удалить анкету?")) return;
    try {
      await deleteSurvey(id);
      await load();
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "researcher";

  function formatPublishedAt(dateStr?: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  return (
    <div style={{ padding: 16 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h5">Анкеты</Typography>
        <Button variant="contained" onClick={handleCreate} disabled={!canEdit}>
          Создать
        </Button>
        <Button variant="outlined" component={Link} to="/admin/surveys">
          Главная
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
                <TableCell>Дата публикации</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {surveys.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>{s.is_published ? <Chip color="success" label="published" size="small" /> : <Chip label="draft" size="small" />}</TableCell>
                  <TableCell>{formatPublishedAt(s.published_at)}</TableCell>
                  <TableCell>
                    <Button size="small" component={Link} to={`/admin/surveys/${s.id}`}>
                      Редактировать
                    </Button>
                    <Button size="small" onClick={() => handleDelete(s.id)} disabled={!canEdit}>
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