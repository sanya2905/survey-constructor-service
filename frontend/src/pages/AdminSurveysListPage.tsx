import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BarChartIcon from "@mui/icons-material/BarChart";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { getSurveys, createSurvey as apiCreateSurvey, deleteSurvey, getCurrentUser, errorMessage } from "../api";
import type { Survey } from "../api";
import { copyTextToClipboard, getPublicSurveyUrl } from "../publicSurveyLink";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function conductingStatus(s: Survey): { label: string; color: "default" | "primary" | "success" | "warning" | "error" } {
  if (!s.is_published) return { label: "черновик", color: "default" };
  const now = Date.now();
  const starts = [s.start_date, s.starts_at].filter(Boolean).map((x) => new Date(x as string).getTime());
  const ends = [s.end_date, s.ends_at].filter(Boolean).map((x) => new Date(x as string).getTime());
  const effStart = starts.length ? Math.max(...starts) : null;
  const effEnd = ends.length ? Math.min(...ends) : null;
  if (effStart != null && now < effStart) return { label: "ещё не начато", color: "warning" };
  if (effEnd != null && now > effEnd) return { label: "завершено", color: "error" };
  return { label: "активна", color: "success" };
}

function formatConductingRange(s: Survey): string {
  const start = s.starts_at || s.start_date;
  const end = s.ends_at || s.end_date;
  if (!start && !end && s.max_responses == null) return "—";
  let out = "";
  if (start) out += `с ${formatDate(start)}`;
  if (end) out += (out ? " " : "") + `по ${formatDate(end)}`;
  if (s.max_responses != null) out += (out ? " · " : "") + `макс. ${s.max_responses}`;
  return out;
}

export default function AdminSurveysListPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role?: string; username?: string } | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
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
    try { await deleteSurvey(id); await load(); }
    catch (e: unknown) { setErr(errorMessage(e)); }
  }

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "researcher";

  const totalSurveys = surveys.length;
  const activeSurveys = surveys.filter((s) => conductingStatus(s).color === "success").length;
  const draftSurveys = surveys.filter((s) => !s.is_published).length;

  return (
    <Stack spacing={3}>
      {/* ── Page header ── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          alignItems: { sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ color: "text.primary", mb: 0.25 }}>
            Анкеты
          </Typography>
          <Typography variant="body2">
            {totalSurveys > 0
              ? `${totalSurveys} ${pluralSurvey(totalSurveys)} · ${activeSurveys} активных`
              : "Нет анкет"}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          disabled={!canEdit}
          sx={{ fontWeight: 600, px: 2.5 }}
        >
          Создать анкету
        </Button>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}
      {copyHint && !err && (
        <Alert severity={copyHint === "Не удалось скопировать ссылку" ? "warning" : "success"}>{copyHint}</Alert>
      )}

      {/* ── Stats row ── */}
      {totalSurveys > 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
          }}
        >
          <MetricCard
            icon={<AssignmentIcon sx={{ color: "primary.main", fontSize: 22 }} />}
            label="Всего анкет"
            value={totalSurveys}
            accent="rgba(0,51,153,0.08)"
          />
          <MetricCard
            icon={<CheckCircleIcon sx={{ color: "success.main", fontSize: 22 }} />}
            label="Активных"
            value={activeSurveys}
            accent="rgba(5,150,105,0.08)"
          />
          <MetricCard
            icon={<PendingIcon sx={{ color: "text.secondary", fontSize: 22 }} />}
            label="Черновиков"
            value={draftSurveys}
            accent="rgba(100,116,139,0.08)"
          />
        </Box>
      )}

      {/* ── Surveys table ── */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : surveys.length === 0 ? (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <AssignmentIcon sx={{ fontSize: 48, color: "divider", mb: 1.5 }} />
            <Typography variant="h6" sx={{ color: "text.primary", mb: 0.5 }}>
              Пока нет анкет
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Создайте первую анкету, чтобы начать работу
            </Typography>
            {canEdit && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                Создать анкету
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Опубликовано</TableCell>
                <TableCell>Сроки проведения</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {surveys.map((s) => {
                const status = conductingStatus(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: "text.primary",
                          cursor: "pointer",
                          "&:hover": { color: "primary.main" },
                        }}
                        component={Link}
                        to={s.is_published ? `/admin/surveys/${s.id}/stats` : `/admin/surveys/${s.id}`}
                        style={{ textDecoration: "none" }}
                      >
                        {s.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 13 }}>
                        {formatDate(s.published_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 13 }}>
                        {formatConductingRange(s)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", flexDirection: "row", gap: 0.5, justifyContent: "flex-end" }}>
                        <Tooltip title="Редактировать">
                          <IconButton
                            size="small"
                            component={Link}
                            to={`/admin/surveys/${s.id}`}
                            sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        {s.is_published && s.id && (
                          <>
                            <Tooltip title="Скопировать ссылку для респондентов">
                              <IconButton
                                size="small"
                                onClick={() => void handleCopyPublicLink(s.id as string)}
                                sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Открыть для прохождения">
                              <IconButton
                                size="small"
                                component="a"
                                href={getPublicSurveyUrl(s.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                              >
                                <AssignmentIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {s.is_published && (
                          <Tooltip title="Статистика">
                            <IconButton
                              size="small"
                              component={Link}
                              to={`/admin/surveys/${s.id}/stats`}
                              sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                            >
                              <BarChartIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Удалить">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(s.id)}
                              disabled={!canEdit}
                              sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}

function StatusChip({
  status,
}: {
  status: { label: string; color: "default" | "primary" | "success" | "warning" | "error" };
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    success: { bg: "rgba(5,150,105,0.1)", text: "#059669" },
    warning: { bg: "rgba(217,119,6,0.1)", text: "#D97706" },
    error: { bg: "rgba(220,38,38,0.1)", text: "#DC2626" },
    default: { bg: "rgba(100,116,139,0.1)", text: "#64748B" },
    primary: { bg: "rgba(0,51,153,0.1)", text: "#003399" },
  };
  const c = colorMap[status.color] ?? colorMap.default;
  return (
    <Chip
      label={status.label}
      size="small"
      sx={{ bgcolor: c.bg, color: c.text, border: "none", fontWeight: 600, fontSize: 12 }}
    />
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 140,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ p: "16px !important" }}>
        <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              {label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function pluralSurvey(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "анкета";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "анкеты";
  return "анкет";
}
