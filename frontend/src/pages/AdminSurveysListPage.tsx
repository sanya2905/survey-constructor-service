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
import { getSurveys, createSurvey as apiCreateSurvey, deleteSurvey, getCurrentUser } from "../api";
import type { Survey } from "../api";
import { copyTextToClipboard, getPublicSurveyUrl } from "../publicSurveyLink";

export default function AdminSurveysListPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role?: string; username?: string } | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
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
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    try {
      const u: any = await getCurrentUser();
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
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function handleCopyPublicLink(surveyId: string) {
    const url = getPublicSurveyUrl(surveyId);
    const ok = await copyTextToClipboard(url);
    setErr(null);
    if (ok) {
      setCopyHint("Ссылка скопирована в буфер обмена");
      window.setTimeout(() => setCopyHint(null), 3500);
    } else {
      setCopyHint("Не удалось скопировать ссылку");
      window.setTimeout(() => setCopyHint(null), 5000);
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

  

  const roleLabel = currentUser?.role === "admin" ? "Админ" : currentUser?.role === "researcher" ? "Исследователь" : currentUser?.role === "student" ? "Студент" : "";

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "researcher";

  return (
    <div style={{ padding: 16 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h5">{roleLabel ? `${roleLabel} — анкеты` : "Анкеты"}</Typography>
        <Button variant="contained" onClick={handleCreate} disabled={!canEdit}>
          Создать
        </Button>
        <Button variant="outlined" component={Link} to="/admin/surveys">
          Главная
        </Button>
      </Stack>

      

      {err && <Alert severity="error">{err}</Alert>}
      {copyHint && !err && (
        <Alert severity={copyHint === "Не удалось скопировать ссылку" ? "warning" : "success"}>{copyHint}</Alert>
      )}

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
                  <TableCell>
                    {s.is_published ? (
                      <Chip color="success" label="Опубликована" size="small" />
                    ) : (
                      <Chip label="Черновик" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      <Button size="small" component={Link} to={`/admin/surveys/${s.id}`}>
                        Редактировать
                      </Button>
                      {s.is_published && s.id && (
                        <>
                          <Button size="small" variant="outlined" onClick={() => void handleCopyPublicLink(s.id as string)}>
                            Скопировать ссылку
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            href={getPublicSurveyUrl(s.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Открыть для прохождения
                          </Button>
                        </>
                      )}
                      <Button size="small" onClick={() => handleDelete(s.id)} disabled={!canEdit}>
                        Удалить
                      </Button>
                    </Stack>
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