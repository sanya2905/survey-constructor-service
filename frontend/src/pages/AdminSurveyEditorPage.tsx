import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import RefreshIcon from "@mui/icons-material/Refresh";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { editorLocalization, settings } from "survey-creator-core";
import "survey-creator-core/i18n/russian";
import { surveyLocalization } from "survey-core";
import "survey-core/i18n/russian";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { useThemeMode } from "../ThemeContext";
import creatorThemes from "survey-creator-core/themes/index";

const CREATOR_BRAND = "#003399";

function getCreatorPatchedVars(): Record<string, string> {
  const vars = { ...((creatorThemes as any)?.DefaultDark?.cssVariables || {}) };
  vars["--sjs2-color-project-brand-600"] = CREATOR_BRAND;
  vars["--sjs2-color-project-accent-600"] = CREATOR_BRAND;
  return vars;
}

function getCreatorBrandOnlyVars(): Record<string, string> {
  return {
    "--sjs2-color-project-brand-600": CREATOR_BRAND,
    "--sjs2-color-project-accent-600": CREATOR_BRAND,
    "--sjs2-color-project-brand-400": "hsl(from " + CREATOR_BRAND + " h s calc(l * 1.1))",
    "--sjs2-color-project-brand-700": "lch(from " + CREATOR_BRAND + " calc(l * 0.85) c h)",
    "--sjs2-color-project-accent-400": "hsl(from " + CREATOR_BRAND + " h s calc(l * 1.1))",
    "--sjs2-color-project-accent-700": "lch(from " + CREATOR_BRAND + " calc(l * 0.85) c h)",
    "--sjs2-color-bg-brand-secondary": "rgba(from " + CREATOR_BRAND + " r g b / var(--sjs2-opacity-x010))",
    "--sjs2-color-bg-brand-tertiary": "rgba(from " + CREATOR_BRAND + " r g b / var(--sjs2-opacity-x000))",
    "--sjs2-color-bg-brand-secondary-dim": "rgba(from " + CREATOR_BRAND + " r g b / var(--sjs2-opacity-x015))",
    "--sjs2-color-bg-brand-tertiary-dim": "rgba(from " + CREATOR_BRAND + " r g b / var(--sjs2-opacity-x010))",
  };
}
import {
  getSurvey,
  createSurvey,
  updateSurvey,
  publishSurvey,
  deleteSurvey,
  getCurrentUser,
  errorMessage,
} from "../api";
import type { Survey, User } from "../api";
import { datetimeLocalToIso, isoToDatetimeLocalValue } from "../datetimeLocal";
import { copyTextToClipboard, getPublicSurveyUrl } from "../publicSurveyLink";
import VersionHistoryPanel from "../components/VersionHistoryPanel";

editorLocalization.currentLocale = "ru";

settings.toolbox.defaultJSON.radiogroup = {};
settings.toolbox.defaultJSON.checkbox = {};
settings.toolbox.defaultJSON.dropdown = {};
settings.toolbox.defaultJSON.tagbox = {};
settings.toolbox.defaultJSON.ranking = {};

surveyLocalization.currentLocale = "ru";
surveyLocalization.defaultLocale = "ru";

export default function AdminSurveyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const surveyRef = useRef<Survey | null>(survey);
  useEffect(() => {
    surveyRef.current = survey;
  }, [survey]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creatorState, setCreatorState] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | { role: string } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
      locale: "ru",
    });
    c.onCollectionItemAllowOperations.add((_sender, options) => {
      if (options.propertyName === "choices") {
        options.allowDelete = true;
        options.allowEdit = true;
      }
    });
    c.JSON = { title: "Новая анкета", pages: [] };
    return c;
  }, []);

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const s = await getSurvey(id);
        setSurvey(s);
        creator.JSON = s.survey_json ?? { title: s.title ?? "Анкета", pages: [] };
        setStartDate(s.start_date ? isoToDatetimeLocalValue(s.start_date) : "");
        setEndDate(s.end_date ? isoToDatetimeLocalValue(s.end_date) : "");
        setStartsAt(s.starts_at ? isoToDatetimeLocalValue(s.starts_at) : "");
        setEndsAt(s.ends_at ? isoToDatetimeLocalValue(s.ends_at) : "");
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
      void (async () => {
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
    void fetchUser();
  }, [creator]);

  const { mode: themeMode } = useThemeMode();

  const applyCreatorTheme = useCallback(
    (mode: "light" | "dark") => {
      const container = document.querySelector(".svc-creator") as HTMLElement | null;
      if (!container) return;

      const darkVars = getCreatorPatchedVars();
      const brandVars = getCreatorBrandOnlyVars();

      if (mode === "dark") {
        for (const [key, value] of Object.entries(brandVars)) {
          container.style.setProperty(key, value);
        }
        for (const [key, value] of Object.entries(darkVars)) {
          container.style.setProperty(key, value);
        }
      } else {
        for (const key of Object.keys(darkVars)) {
          container.style.removeProperty(key);
        }
        for (const [key, value] of Object.entries(brandVars)) {
          container.style.setProperty(key, value);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const maxAttempts = 20;
    let attempts = 0;

    function tryApply() {
      if (cancelled) return;
      const container = document.querySelector(".svc-creator") as HTMLElement | null;
      if (container) {
        applyCreatorTheme(themeMode);
        return;
      }
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryApply, 100);
      }
    }

    const timer = setTimeout(tryApply, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [themeMode, applyCreatorTheme]);

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "researcher";

  async function handleSaveSchedule() {
    if (!survey?.id) return;
    setErr(null);
    setInfo(null);
    try {
      const updated = await updateSurvey(survey.id as string, {
        start_date: datetimeLocalToIso(startDate),
        end_date: datetimeLocalToIso(endDate),
      });
      setSurvey(updated);
      setInfo("Сроки проведения сохранены");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function handleSave() {
    setErr(null);
    setInfo(null);
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
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function handleSaveConducting() {
    if (!survey?.id) return;
    setErr(null);
    setInfo(null);
    try {
      const payload: Partial<Survey> = {
        starts_at: datetimeLocalToIso(startsAt),
        ends_at: datetimeLocalToIso(endsAt),
        max_responses: maxResponses ? Number(maxResponses) : null,
        allow_anonymous: allowAnonymous,
      };
      const updated = await updateSurvey(survey.id as string, payload);
      setSurvey(updated);
      setInfo("Настройки проведения сохранены");
      setSettingsOpen(false);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function handlePublish() {
    if (!survey?.id) return;
    setErr(null);
    setInfo(null);
    try {
      const payload: Partial<Survey> = {
        title: creator.JSON?.title ?? survey?.title ?? "",
        description: survey?.description ?? null,
        survey_json: creator.JSON,
      };
      try {
        await updateSurvey(survey.id as string, payload);
      } catch {
        /* continue */
      }
      const res = await publishSurvey(survey.id as string);
      setSurvey(res);
      setInfo("Опубликовано");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function handleCopyPublicLink() {
    if (!survey?.id || !survey.is_published) return;
    setErr(null);
    const url = getPublicSurveyUrl(survey.id);
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setInfo("Ссылка для респондентов скопирована в буфер обмена");
    } else {
      setInfo(null);
      setErr("Не удалось скопировать ссылку");
    }
  }

  async function handleDelete() {
    if (!survey?.id) return;
    if (!confirm("Удалить анкету?")) return;
    try {
      await deleteSurvey(survey.id as string);
      navigate("/admin/surveys");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  if (loading) return <CircularProgress />;

  return (
    <Stack spacing={0} sx={{ height: "100%", minHeight: 0 }}>
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

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
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

          {survey?.id && (
            <VersionHistoryPanel
              surveyId={survey.id}
              currentVersion={survey.version ?? 1}
              onRestore={() => window.location.reload()}
              canEdit={canEdit}
            />
          )}

          <Tooltip title="Справка: динамическая анкета">
            <IconButton size="small" onClick={() => setHelpOpen(true)} sx={{ color: "text.secondary" }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Button variant="contained" size="small" onClick={() => void handleSave()} disabled={!canEdit} sx={{ minWidth: 100 }}>
              {creatorState === "saving" ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : "Сохранить"}
            </Button>
          </Box>

          <Button
            color="success"
            variant="contained"
            size="small"
            onClick={() => void handlePublish()}
            disabled={!!survey?.is_published || !canEdit}
            sx={{ minWidth: 110 }}
          >
            Опубликовать
          </Button>

          {survey?.is_published && survey.id && (
            <Button variant="outlined" size="small" onClick={() => void handleCopyPublicLink()}>
              Скопировать ссылку
            </Button>
          )}

          <Button variant="outlined" color="error" size="small" onClick={() => void handleDelete()} disabled={!canEdit}>
            Удалить
          </Button>
        </Box>
      </Box>

      {(err || info) && (
        <Box sx={{ px: 2, pt: 1 }}>
          {err && (
            <Alert severity="error" onClose={() => setErr(null)}>
              {err}
            </Alert>
          )}
          {info && (
            <Alert severity="success" onClose={() => setInfo(null)}>
              {info}
            </Alert>
          )}
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", px: 2, py: 1, flexWrap: "wrap" }}>
        <TextField
          label="Начало приёма ответов"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          disabled={!canEdit}
          sx={{ minWidth: 280 }}
        />
        <TextField
          label="Окончание приёма ответов"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          disabled={!canEdit}
          sx={{ minWidth: 280 }}
        />
        <Button variant="outlined" size="small" onClick={() => void handleSaveSchedule()} disabled={!survey?.id || !canEdit}>
          Сохранить сроки
        </Button>
        {(survey?.start_date || survey?.end_date) && (
          <Typography variant="body2" color="text.secondary">
            {survey?.start_date && <>С {new Date(survey.start_date).toLocaleString("ru-RU")}</>}
            {survey?.start_date && survey?.end_date && <> — </>}
            {survey?.end_date && <>по {new Date(survey.end_date).toLocaleString("ru-RU")}</>}
          </Typography>
        )}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <SurveyCreatorComponent creator={creator} />
      </Box>

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
              helperText="До этого времени анкета недоступна респондентам (дополнительно к полю «Начало приёма» сверху)"
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
          <Button variant="contained" onClick={() => void handleSaveConducting()} disabled={!canEdit || !survey?.id}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Справка: динамическая анкета</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              Вы можете скрывать или показывать вопросы (и целые страницы) в зависимости от ответов респондента — без
              написания кода.
            </Alert>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Способ 1 — через вкладку «Логика»
            </Typography>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2">
                Откройте вкладку <b>Логика</b> вверху редактора.
              </Typography>
              <Typography component="li" variant="body2">
                Нажмите <b>«Добавить условие»</b>.
              </Typography>
              <Typography component="li" variant="body2">
                В поле <b>«Если»</b> выберите вопрос-триггер и значение ответа.
              </Typography>
              <Typography component="li" variant="body2">
                В поле <b>«Тогда»</b> выберите действие: <b>«Показать вопрос»</b> или <b>«Скрыть вопрос»</b>.
              </Typography>
              <Typography component="li" variant="body2">
                Выберите вопрос(ы) и нажмите <b>«Сохранить»</b>.
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Способ 2 — через свойства вопроса
            </Typography>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2">
                Кликните на вопрос → правая панель → раздел <b>«Условия»</b>.
              </Typography>
              <Typography component="li" variant="body2">
                В поле <b>«Показывать вопрос, если»</b> нажмите карандаш.
              </Typography>
            </Box>
            <Typography variant="body2">
              Перейдите на вкладку <b>Предварительный просмотр</b> — зависимые вопросы работают в реальном времени.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)} variant="contained">
            Понятно
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
