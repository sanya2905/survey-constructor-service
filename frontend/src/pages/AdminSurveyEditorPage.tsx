import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, Checkbox, CircularProgress,
  FormControlLabel, Stack, TextField, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { getSurvey, createSurvey, updateSurvey, publishSurvey, deleteSurvey, getCurrentUser, errorMessage } from "../api";
import type { Survey, User } from "../api";

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  // datetime-local input expects "YYYY-MM-DDTHH:MM"
  return iso.slice(0, 16);
}

function fromDatetimeLocal(val: string): string | null {
  if (!val) return null;
  // append seconds and Z so the backend gets an ISO 8601 UTC-aware string
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
        // Populate conducting fields
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
          setInfo("Сохранено");
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
    <Stack spacing={2} sx={{ padding: 2 }}>
      {/* ── Top bar ── */}
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button variant="text" onClick={() => navigate("/admin/surveys")}>Назад</Button>
          <Stack>
            <Typography variant="h5">Редактор анкеты</Typography>
            {survey && (
              <Typography variant="body2" color="text.secondary">
                ID: {survey.id} • {survey.is_published ? "опубликовано" : "черновик"} • v{survey.version}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button variant="outlined" onClick={() => window.location.reload()}>Обновить</Button>
          <Button variant="outlined" onClick={() => navigate("/admin/surveys")}>Главная</Button>
          {survey?.id && (
            <Button variant="outlined" onClick={() => navigate(`/admin/surveys/${survey.id}/stats`)}>
              Статистика
            </Button>
          )}
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button variant="contained" onClick={handleSave} disabled={!canEdit}>Сохранить</Button>
            {creatorState === "saving" && <CircularProgress size={18} />}
            {creatorState === "saved" && <Typography color="success.main">Сохранено</Typography>}
            {creatorState === "modified" && <Typography color="text.secondary">Изменено</Typography>}
          </Stack>
          <Button color="success" variant="contained" onClick={handlePublish}
            disabled={!!survey?.is_published || !canEdit}>
            Опубликовать
          </Button>
          <Button variant="outlined" color="error" onClick={handleDelete} disabled={!canEdit}>
            Удалить
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      {/* ── Conducting settings (ТР-2, ТР-5, ТР-6) ── */}
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            ⚙️ Настройки проведения анкетирования (сроки, лимиты, анонимность)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              <TextField
                label="Начало проведения"
                type="datetime-local"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={!canEdit}
                helperText="До этого времени анкета недоступна респондентам"
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
              />
              <TextField
                label="Макс. число ответов"
                type="number"
                size="small"
                sx={{ width: 200 }}
                value={maxResponses}
                onChange={(e) => setMaxResponses(e.target.value)}
                disabled={!canEdit}
                slotProps={{ htmlInput: { min: 1 } }}
                helperText="Оставьте пустым — без ограничений"
              />
            </Stack>
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
            <Box>
              <Button variant="outlined" size="small" onClick={handleSaveConducting} disabled={!canEdit || !survey?.id}>
                Сохранить настройки проведения
              </Button>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ── Conditional logic guide ── */}
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            💡 Как сделать вопрос зависимым от ответа (динамическая анкета)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
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
        </AccordionDetails>
      </Accordion>

      <SurveyCreatorComponent creator={creator} />
    </Stack>
  );
}
