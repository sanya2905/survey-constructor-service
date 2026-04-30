import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Checkbox, CircularProgress,
  Dialog, DialogContent, DialogTitle, DialogActions,
  Divider, FormControlLabel, IconButton, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import RefreshIcon from "@mui/icons-material/Refresh";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { getSurvey, createSurvey, updateSurvey, publishSurvey, deleteSurvey, getCurrentUser, errorMessage } from "../api";
import type { Survey, User } from "../api";

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function fromDatetimeLocal(val: string): string | null {
  if (!val) return null;
  return val.length === 16 ? val + ":00Z" : val;
}

export default function AdminSurveyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const surveyRef = useRef<Survey | null>(survey);
  useEffect(() => { surveyRef.current = survey; }, [survey]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creatorState, setCreatorState] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | { role: string } | null>(null);

  // Dialog visibility
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Conducting settings local state
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxResponses, setMaxResponses] = useState("");
  const [allowAnonymous, setAllowAnonymous] = useState(true);

  const creator = useMemo(() => {
    const c = new SurveyCreator({
      showLogicTab: true,
      showPreviewTab: true,
      logicAllowTextEditExpressions: false,
      autoSaveEnabled: true,
      autoSaveDelay: 1000,
    });
    c.JSON = { title: "Новая анкета", pages: [] };
    return c;
  }, []);

  useEffect(() => {
    async function load() {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      setErr(null);
      try {
        const s = await getSurvey(id);
        setSurvey(s);
        creator.JSON = s.survey_json ?? { title: s.title ?? "Анкета", pages: [] };
        setStartsAt(toDatetimeLocal(s.starts_at));
        setEndsAt(toDatetimeLocal(s.ends_at));
        setMaxResponses(s.max_responses != null ? String(s.max_responses) : "");
        setAllowAnonymous(s.allow_anonymous ?? true);
      } catch (e: unknown) {
        setErr(errorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const st = (creator as { state?: string }).state;
      setCreatorState(st ?? null);
    }, 300);
    return () => clearInterval(interval);
  }, [creator]);

  useEffect(() => {
    creator.saveSurveyFunc = (saveNo: number, callback: (no: number, isSuccess: boolean) => void) => {
      (async () => {
        setErr(null);
        setInfo(null);
        try {
          const payload: Partial<Survey> = {
            title: creator.JSON?.title ?? surveyRef.current?.title ?? "Анкета",
            description: surveyRef.current?.description ?? null,
            survey_json: creator.JSON,
          };
          if (surveyRef.current?.id) {
            const updated = await updateSurvey(surveyRef.current.id as string, payload);
            setSurvey(updated);
          } else {
            const created = await createSurvey(payload);
            navigate(`/admin/surveys/${created.id}`);
          }
          callback(saveNo, true);
        } catch (e: unknown) {
          setErr(errorMessage(e));
          callback(saveNo, false);
        }
      })();
    };
  }, [creator, navigate]);

  useEffect(() => {
    async function fetchUser() {
      try {
        const u = await getCurrentUser();
        setCurrentUser(u);
        creator.autoSaveEnabled = u?.role === "admin" || u?.role === "researcher";
      } catch {
        const role = localStorage.getItem("auth_role");
        if (role) {
          setCurrentUser({ role });
          creator.autoSaveEnabled = role === "admin" || role === "researcher";
        } else {
          setCurrentUser(null);
          creator.autoSaveEnabled = false;
        }
      }
    }
    fetchUser();
  }, [creator]);

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "researcher";

  async function handleSave() {
    setErr(null); setInfo(null);
    try {
      const payload: Partial<Survey> = {
        title: creator.JSON?.title ?? survey?.title ?? "Анкета",
        description: survey?.description ?? null,
        survey_json: creator.JSON,
      };
      if (survey?.id) {
        const updated = await updateSurvey(survey.id as string, payload);
        setSurvey(updated);
        setInfo("Сохранено");
      } else {
        const created = await createSurvey(payload);
        navigate(`/admin/surveys/${created.id}`);
      }
    } catch (e: unknown) { setErr(errorMessage(e)); }
  }

  async function handleSaveConducting() {
    if (!survey?.id) return;
    setErr(null); setInfo(null);
    try {
      const payload: Partial<Survey> = {
        starts_at: fromDatetimeLocal(startsAt),
        ends_at: fromDatetimeLocal(endsAt),
        max_responses: maxResponses ? Number(maxResponses) : null,
        allow_anonymous: allowAnonymous,
      };
      const updated = await updateSurvey(survey.id as string, payload);
      setSurvey(updated);
      setInfo("Настройки проведения сохранены");
      setSettingsOpen(false);
    } catch (e: unknown) { setErr(errorMessage(e)); }
  }

  async function handlePublish() {
    if (!survey?.id) return;
    setErr(null); setInfo(null);
    try {
      const payload: Partial<Survey> = {
        title: creator.JSON?.title ?? survey?.title ?? "",
        description: survey?.description ?? null,
        survey_json: creator.JSON,
      };
      try { await updateSurvey(survey.id as string, payload); } catch { /* continue */ }
      const res = await publishSurvey(survey.id as string);
      setSurvey(res);
      setInfo("Опубликовано");
    } catch (e: unknown) { setErr(errorMessage(e)); }
  }

  async function handleDelete() {
    if (!survey?.id) return;
    if (!confirm("Удалить анкету?")) return;
    try {
      await deleteSurvey(survey.id as string);
      navigate("/admin/surveys");
    } catch (e: unknown) { setErr(errorMessage(e)); }
  }

  if (loading) return <CircularProgress />;

  return (
    <Stack spacing={0} sx={{ height: "100%", minHeight: 0 }}>
      {/* ── Top bar ── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          gap: 1,
        }}
      >
        {/* Left: back + title */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Tooltip title="Назад к списку анкет">
            <IconButton size="small" onClick={() => navigate("/admin/surveys")} sx={{ color: "text.secondary" }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ lineHeight: 1.2 }}>
              Редактор анкеты
            </Typography>
            {survey && (
              <Typography variant="caption" color="text.secondary" noWrap>
                ID: {survey.id} · {survey.is_published ? "опубликовано" : "черновик"} · v{survey.version}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right: action buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {/* Utility icon buttons */}
          <Tooltip title="Главная (список анкет)">
            <IconButton size="small" onClick={() => navigate("/admin/surveys")} sx={{ color: "text.secondary" }}>
              <HomeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Обновить страницу">
            <IconButton size="small" onClick={() => window.location.reload()} sx={{ color: "text.secondary" }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {survey?.id && (
            <Tooltip title="Статистика">
              <IconButton
                size="small"
                onClick={() => navigate(`/admin/surveys/${survey.id}/stats`)}
                sx={{ color: "text.secondary" }}
              >
                <BarChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Настройки проведения (сроки, лимиты, анонимность)">
            <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: "text.secondary" }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Справка: динамическая анкета">
            <IconButton size="small" onClick={() => setHelpOpen(true)} sx={{ color: "text.secondary" }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Save — show spinner while autosaving */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={!canEdit}
              sx={{ minWidth: 100 }}
            >
              {creatorState === "saving" ? (
                <CircularProgress size={16} sx={{ color: "inherit" }} />
              ) : (
                "Сохранить"
              )}
            </Button>
          </Box>

          <Button
            color="success"
            variant="contained"
            size="small"
            onClick={handlePublish}
            disabled={!!survey?.is_published || !canEdit}
            sx={{ minWidth: 110 }}
          >
            Опубликовать
          </Button>

          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleDelete}
            disabled={!canEdit}
          >
            Удалить
          </Button>
        </Box>
      </Box>

      {/* ── Alerts ── */}
      {(err || info) && (
        <Box sx={{ px: 2, pt: 1 }}>
          {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}
          {info && <Alert severity="success" onClose={() => setInfo(null)}>{info}</Alert>}
        </Box>
      )}

      {/* ── Survey Creator ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <SurveyCreatorComponent creator={creator} />
      </Box>

      {/* ── Settings Dialog ── */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Настройки проведения анкетирования</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Начало проведения"
              type="datetime-local"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              disabled={!canEdit}
              helperText="До этого времени анкета недоступна респондентам"
              fullWidth
            />
            <TextField
              label="Окончание проведения"
              type="datetime-local"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              disabled={!canEdit}
              helperText="После этого времени новые сессии не принимаются"
              fullWidth
            />
            <TextField
              label="Макс. число ответов"
              type="number"
              size="small"
              value={maxResponses}
              onChange={(e) => setMaxResponses(e.target.value)}
              disabled={!canEdit}
              slotProps={{ htmlInput: { min: 1 } }}
              helperText="Оставьте пустым — без ограничений"
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={allowAnonymous}
                  onChange={(e) => setAllowAnonymous(e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label="Разрешить анонимное прохождение (без идентификатора респондента)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleSaveConducting}
            disabled={!canEdit || !survey?.id}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Help Dialog ── */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Справка: динамическая анкета</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              Вы можете скрывать или показывать вопросы (и целые страницы) в зависимости от ответов респондента — без написания кода.
            </Alert>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Способ 1 — через вкладку «Логика»</Typography>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2">Откройте вкладку <b>Логика</b> вверху редактора.</Typography>
              <Typography component="li" variant="body2">Нажмите <b>«Добавить условие»</b>.</Typography>
              <Typography component="li" variant="body2">В поле <b>«Если»</b> выберите вопрос-триггер и значение ответа.</Typography>
              <Typography component="li" variant="body2">В поле <b>«Тогда»</b> выберите действие: <b>«Показать вопрос»</b> или <b>«Скрыть вопрос»</b>.</Typography>
              <Typography component="li" variant="body2">Выберите вопрос(ы) и нажмите <b>«Сохранить»</b>.</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Способ 2 — через свойства вопроса</Typography>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2">Кликните на вопрос → правая панель → раздел <b>«Условия»</b>.</Typography>
              <Typography component="li" variant="body2">В поле <b>«Показывать вопрос, если»</b> нажмите карандаш.</Typography>
            </Box>
            <Typography variant="body2">
              Перейдите на вкладку <b>Предварительный просмотр</b> — зависимые вопросы работают в реальном времени.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)} variant="contained">Понятно</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
