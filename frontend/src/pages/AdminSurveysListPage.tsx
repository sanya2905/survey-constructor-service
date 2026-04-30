import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Button, CircularProgress, Chip, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { getSurveys, createSurvey as apiCreateSurvey, deleteSurvey, getCurrentUser, errorMessage } from "../api";
import type { Survey } from "../api";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function conductingStatus(s: Survey): { label: string; color: "default" | "primary" | "success" | "warning" | "error" } {
  if (!s.is_published) return { label: "черновик", color: "default" };
  const now = new Date();
  if (s.starts_at && new Date(s.starts_at) > now) return { label: "ещё не начато", color: "warning" };
  if (s.ends_at && new Date(s.ends_at) < now) return { label: "завершено", color: "error" };
  return { label: "идёт", color: "success" };
}

export default function AdminSurveysListPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role?: string; username?: string } | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true); setErr(null);
    try {
      const data = await getSurveys();
      setSurveys(data || []);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); fetchCurrentUser(); }, []);

  async function fetchCurrentUser() {
    try {
      const u = await getCurrentUser();
      setCurrentUser(u);
    } catch {
      const role = localStorage.getItem("auth_role");
      setCurrentUser(role ? { role } : null);
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
    } catch (e: unknown) { setErr(errorMessage(e)); }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    if (!confirm("Удалить анкету?")) return;
    try { await deleteSurvey(id); await load(); }
    catch (e: unknown) { setErr(errorMessage(e)); }
  }

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "researcher";

  return (
    <div style={{ padding: 16 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
        <Typography variant="h5">Анкеты</Typography>
        <Button variant="contained" onClick={handleCreate} disabled={!canEdit}>Создать</Button>
        <Button variant="outlined" component={Link} to="/admin/surveys">Главная</Button>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}

      {loading ? (
        <CircularProgress />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Статус проведения</TableCell>
              <TableCell>Дата публикации</TableCell>
              <TableCell>Сроки проведения</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {surveys.map((s) => {
              const status = conductingStatus(s);
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>
                    <Chip label={status.label} color={status.color} size="small" />
                  </TableCell>
                  <TableCell>{formatDate(s.published_at)}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {s.starts_at || s.ends_at ? (
                      <>
                        {s.starts_at ? `с ${formatDate(s.starts_at)}` : ""}
                        {s.starts_at && s.ends_at ? " " : ""}
                        {s.ends_at ? `по ${formatDate(s.ends_at)}` : ""}
                        {s.max_responses ? ` · макс. ${s.max_responses}` : ""}
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" component={Link} to={`/admin/surveys/${s.id}`}>
                        Редактировать
                      </Button>
                      {s.is_published && (
                        <Button size="small" component={Link} to={`/admin/surveys/${s.id}/stats`}>
                          Статистика
                        </Button>
                      )}
                      <Button size="small" onClick={() => handleDelete(s.id)} disabled={!canEdit}>
                        Удалить
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
