import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, LinearProgress, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import { getSurveyStats, getSurveySessions, getSurvey, errorMessage } from "../api";
import type { SurveyStats, Session, Survey } from "../api";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SurveyStatsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [sv, st, ses] = await Promise.all([
          getSurvey(id),
          getSurveyStats(id),
          getSurveySessions(id),
        ]);
        setSurvey(sv);
        setStats(st);
        setSessions(ses);
      } catch (e: unknown) {
        setErr(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!stats) return null;

  const visibleSessions = showAll ? sessions : sessions.slice(0, 10);

  return (
    <Stack spacing={3}>
      {/* ── Header ── */}
      <Box sx={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "flex-start" }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/admin/surveys/${id}`)}
          sx={{ mt: 0.25, color: "text.secondary", flexShrink: 0 }}
        >
          Редактор
        </Button>
        <Box>
          <Typography variant="h5" sx={{ color: "text.primary" }}>
            Статистика анкеты
          </Typography>
          {survey && (
            <Typography variant="body2" sx={{ mt: 0.25 }}>
              {survey.title}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Summary stat cards ── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <StatCard label="Всего сессий" value={stats.total_sessions} />
        <StatCard label="Завершено" value={stats.completed_sessions} valueColor="#059669" />
        <StatCard label="В процессе" value={stats.in_progress_sessions} valueColor="#D97706" />
        <StatCard label="Завершение" value={`${Math.round(stats.completion_rate * 100)}%`} valueColor="#0D9488" />
        <StatCard label="Средний прогресс" value={`${Math.round(stats.avg_progress_pct)}%`} />
      </Box>

      {/* ── Completion progress ── */}
      {stats.total_sessions > 0 && (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ p: "16px 20px !important" }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                Завершённость
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                {stats.completed_sessions} / {stats.total_sessions}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={stats.completion_rate * 100}
              sx={{ height: 10, borderRadius: 5 }}
              color="primary"
            />
          </CardContent>
        </Card>
      )}

      {/* ── Per-question distributions ── */}
      {Object.keys(stats.responses_by_question).length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: "text.primary" }}>
            Распределение ответов
          </Typography>
          <Stack spacing={2}>
            {Object.entries(stats.responses_by_question).map(([qName, choices]) => {
              const total = Object.values(choices).reduce((a, b) => a + b, 0);
              return (
                <Card variant="outlined" key={qName} sx={{ borderColor: "divider" }}>
                  <CardContent sx={{ p: "16px 20px !important" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: "text.primary" }}>
                      {qName}
                    </Typography>
                    <Stack spacing={1}>
                      {Object.entries(choices)
                        .sort(([, a], [, b]) => b - a)
                        .map(([choice, count]) => {
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <Box
                              key={choice}
                              sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ minWidth: 140, flexShrink: 0, color: "text.primary", fontSize: 13 }}
                              >
                                {choice}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                                color="primary"
                              />
                              <Typography
                                variant="caption"
                                sx={{ minWidth: 56, textAlign: "right", color: "text.secondary", fontWeight: 500 }}
                              >
                                {count} ({pct}%)
                              </Typography>
                            </Box>
                          );
                        })}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* ── Sessions table ── */}
      <Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            gap: 2,
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ color: "text.primary" }}>
            Сессии
            <Typography
              component="span"
              variant="body2"
              sx={{ ml: 1, color: "text.secondary" }}
            >
              ({sessions.length})
            </Typography>
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
              component={Link}
              to={`/api/v1/surveys/${id}/export?format=csv&include_incomplete=true`}
              target="_blank"
              sx={{ fontSize: 12 }}
            >
              CSV
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
              component={Link}
              to={`/api/v1/surveys/${id}/export?format=json&include_incomplete=true`}
              target="_blank"
              sx={{ fontSize: 12 }}
            >
              JSON
            </Button>
          </Box>
        </Box>

        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Респондент</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Прогресс</TableCell>
                <TableCell>Начало</TableCell>
                <TableCell>Завершение</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleSessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: 12, color: "text.secondary" }}
                    >
                      {s.respondent_id ?? "анонимно"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {s.is_completed ? (
                      <Chip
                        label="завершено"
                        size="small"
                        sx={{ bgcolor: "rgba(5,150,105,0.1)", color: "#059669", fontWeight: 600, fontSize: 11 }}
                      />
                    ) : (
                      <Chip
                        label="в процессе"
                        size="small"
                        sx={{ bgcolor: "rgba(217,119,6,0.1)", color: "#D97706", fontWeight: 600, fontSize: 11 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "center" }}>
                      <LinearProgress
                        variant="determinate"
                        value={s.progress_pct ?? 0}
                        sx={{ width: 64, height: 6, borderRadius: 3 }}
                        color="primary"
                      />
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {Math.round(s.progress_pct ?? 0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary" }}>
                      {formatDate(s.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary" }}>
                      {formatDate(s.completed_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {sessions.length > 10 && (
          <Button
            size="small"
            sx={{ mt: 1.5, color: "text.secondary" }}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Свернуть" : `Показать все ${sessions.length}`}
          </Button>
        )}
      </Box>

      <Divider />
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Данные обновляются при перезагрузке страницы (F5).
      </Typography>
    </Stack>
  );
}

function StatCard({
  label,
  value,
  valueColor = "#0F172A",
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <Card
      elevation={0}
      sx={{ flex: 1, minWidth: 120, border: "1px solid", borderColor: "divider" }}
    >
      <CardContent sx={{ p: "14px 18px !important" }}>
        <Typography sx={{ fontSize: 26, fontWeight: 700, color: valueColor, lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ fontSize: 12, mt: 0.25 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
