import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, LinearProgress, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from "@mui/material";
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

  if (loading) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!stats) return null;

  const visibleSessions = showAll ? sessions : sessions.slice(0, 10);

  return (
    <Stack spacing={3} sx={{ padding: 2 }}>
      {/* ── Header ── */}
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Button variant="text" onClick={() => navigate(`/admin/surveys/${id}`)}>← Редактор</Button>
        <Stack>
          <Typography variant="h5">Статистика анкеты</Typography>
          {survey && (
            <Typography variant="body2" color="text.secondary">
              {survey.title} · ID: {id}
            </Typography>
          )}
        </Stack>
      </Stack>

      {/* ── Summary cards ── */}
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
        <StatCard label="Всего сессий" value={stats.total_sessions} />
        <StatCard label="Завершено" value={stats.completed_sessions} color="success.main" />
        <StatCard label="В процессе" value={stats.in_progress_sessions} color="warning.main" />
        <StatCard
          label="Процент завершения"
          value={`${Math.round(stats.completion_rate * 100)}%`}
          color="primary.main"
        />
        <StatCard
          label="Средний прогресс"
          value={`${Math.round(stats.avg_progress_pct)}%`}
        />
      </Stack>

      {/* ── Completion progress bar ── */}
      {stats.total_sessions > 0 && (
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Завершённость: {stats.completed_sessions} из {stats.total_sessions}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={stats.completion_rate * 100}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </Box>
      )}

      {/* ── Per-question distributions (ТР-7, ТР-9) ── */}
      {Object.keys(stats.responses_by_question).length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>Распределение ответов по вопросам</Typography>
          <Stack spacing={2}>
            {Object.entries(stats.responses_by_question).map(([qName, choices]) => {
              const total = Object.values(choices).reduce((a, b) => a + b, 0);
              return (
                <Card variant="outlined" key={qName}>
                  <CardContent sx={{ pb: "12px !important" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{qName}</Typography>
                    <Stack spacing={0.5}>
                      {Object.entries(choices)
                        .sort(([, a], [, b]) => b - a)
                        .map(([choice, count]) => {
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <Stack key={choice} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Typography variant="body2" sx={{ minWidth: 140, flexShrink: 0 }}>{choice}</Typography>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50, textAlign: "right" }}>
                                {count} ({pct}%)
                              </Typography>
                            </Stack>
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
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1 }}>
          <Typography variant="h6">Сессии ({sessions.length})</Typography>
          <Button
            size="small"
            component={Link}
            to={`/api/v1/surveys/${id}/export?format=csv&include_incomplete=true`}
            target="_blank"
          >
            Экспорт CSV
          </Button>
          <Button
            size="small"
            component={Link}
            to={`/api/v1/surveys/${id}/export?format=json&include_incomplete=true`}
            target="_blank"
          >
            Экспорт JSON
          </Button>
        </Stack>
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
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                  {s.respondent_id ?? "анонимно"}
                </TableCell>
                <TableCell>
                  {s.is_completed ? (
                    <Typography variant="caption" color="success.main">завершено</Typography>
                  ) : (
                    <Typography variant="caption" color="warning.main">в процессе</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <LinearProgress
                      variant="determinate"
                      value={s.progress_pct ?? 0}
                      sx={{ width: 60, height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption">{Math.round(s.progress_pct ?? 0)}%</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{formatDate(s.created_at)}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{formatDate(s.completed_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sessions.length > 10 && (
          <Button size="small" sx={{ mt: 1 }} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Свернуть" : `Показать все ${sessions.length}`}
          </Button>
        )}
      </Box>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Данные обновляются в реальном времени. Страница не автообновляется — нажмите F5 для актуализации.
      </Typography>
    </Stack>
  );
}

function StatCard({ label, value, color = "text.primary" }: { label: string; value: string | number; color?: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140 }}>
      <CardContent sx={{ pb: "12px !important" }}>
        <Typography variant="h4" sx={{ color, fontWeight: 700 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}
