import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api, errorMessage } from "../api";
import type { PublicSurvey, Session } from "../api";
import { Model, surveyLocalization } from "survey-core";
import "survey-core/i18n/russian";
import { Survey as SurveyRunner } from "survey-react-ui";
import UnnLogo from "../assets/UnnLogo";

surveyLocalization.currentLocale = "ru";
surveyLocalization.defaultLocale = "ru";

function storageKey(surveyId: string) {
  return `survey_session_${surveyId}`;
}

function formatSurveyLocale(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU");
}

type Stage = "identify" | "running" | "done" | "expired" | "not_started";

type NotStartedInfo = {
  title: string;
  description?: string | null;
  start_date: string | null;
  end_date: string | null;
};

export default function PublicSurveyRunPage() {
  const { surveyId } = useParams<{ surveyId: string }>();

  const [pub, setPub] = useState<PublicSurvey | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("identify");
  const [respondentId, setRespondentId] = useState("");
  const [notStarted, setNotStarted] = useState<NotStartedInfo | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [progress, setProgress] = useState(0);

  const saveTimer = useRef<number | null>(null);
  const loadSurveyRef = useRef<() => Promise<void>>(async () => {});

  const model = useMemo(() => {
    const m = new Model({ title: "Загрузка…", pages: [] });
    m.locale = "ru";
    return m;
  }, []);

  function updateProgress() {
    const visibleQuestions = model.getAllQuestions(false).filter((q) => q.isVisible);
    const answered = visibleQuestions.filter((q) => !q.isEmpty()).length;
    const total = visibleQuestions.length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    setProgress(pct);
  }

  function scheduleSave(sessionId: string) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        updateProgress();
        const visibleQuestions = model.getAllQuestions(false).filter((q) => q.isVisible);
        const answered = visibleQuestions.filter((q) => !q.isEmpty()).length;
        const total = visibleQuestions.length;
        const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
        await api.put(`/public/sessions/${sessionId}`, {
          answers_json: model.data,
          current_page: model.currentPageNo,
          progress_pct: pct,
        });
      } catch {
        /* silent for autosave */
      }
    }, 700) as unknown as number;
  }

  function attachHooks(sessionId: string) {
    model.onValueChanged.clear();
    model.onCurrentPageChanged.clear();
    model.onComplete.clear();

    model.onValueChanged.add(() => {
      updateProgress();
      scheduleSave(sessionId);
    });
    model.onCurrentPageChanged.add(() => {
      updateProgress();
      scheduleSave(sessionId);
    });

    model.onComplete.add(async (sender) => {
      try {
        const res = await api.post<Session>(`/public/sessions/${sessionId}/complete`, {
          answers_json: sender.data,
        });
        setSession(res.data);
        setProgress(100);
        setStage("done");
      } catch (e: unknown) {
        setErr(errorMessage(e, "Не удалось завершить анкету"));
      }
    });
  }

  async function loadSurvey() {
    if (!surveyId) return;
    setLoading(true);
    setErr(null);
    try {
      const sres = await api.get<PublicSurvey>(`/public/surveys/${surveyId}`);
      setNotStarted(null);
      setPub(sres.data);
      const surveyJson = sres.data.survey_json || { pages: [] };
      model.fromJSON(surveyJson);
      model.locale = "ru";
      model.showProgressBar = "top";
      model.progressBarType = "questions";

      const existing = localStorage.getItem(storageKey(surveyId));

      if (existing) {
        try {
          const ses = await api.get<Session>(`/public/sessions/${existing}`);
          setSession(ses.data);
          if (ses.data.is_completed) {
            setStage("done");
          } else {
            model.data = ses.data.answers_json || {};
            if (ses.data.current_page) {
              model.currentPageNo = ses.data.current_page;
            }
            setProgress(ses.data.progress_pct ?? 0);
            attachHooks(existing);
            setStage("running");
          }
        } catch {
          localStorage.removeItem(storageKey(surveyId));
          setStage("identify");
        }
      } else {
        setStage("identify");
      }
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { detail?: unknown } } };
      if (ax?.response?.status === 410) {
        setStage("expired");
      } else if (ax?.response?.status === 403) {
        const d = ax.response?.data?.detail;
        if (d && typeof d === "object" && !Array.isArray(d) && "code" in d && (d as { code?: string }).code === "survey_not_started") {
          const o = d as {
            title?: string;
            description?: string | null;
            start_date?: string | null;
            end_date?: string | null;
          };
          setNotStarted({
            title: o.title ?? "Анкета",
            description: o.description ?? null,
            start_date: o.start_date ?? null,
            end_date: o.end_date ?? null,
          });
          setPub(null);
          setStage("not_started");
        } else {
          const det = ax.response?.data?.detail;
          const msg =
            typeof det === "string"
              ? det
              : det && typeof det === "object" && "message" in det
                ? String((det as { message?: string }).message)
                : errorMessage(e, "Нет доступа к анкете");
          setErr(msg);
        }
      } else {
        setErr(errorMessage(e, "Не удалось загрузить анкету"));
      }
    } finally {
      setLoading(false);
    }
  }

  loadSurveyRef.current = loadSurvey;

  async function handleStart() {
    if (!surveyId) return;
    const rid = respondentId.trim() || null;
    if (pub && !pub.allow_anonymous && !rid) {
      setErr("Укажите идентификатор — для этой анкеты анонимное прохождение отключено.");
      return;
    }
    setStartingSession(true);
    setErr(null);
    try {
      const created = await api.post<Session>(`/public/surveys/${surveyId}/sessions`, {
        respondent_id: rid,
      });
      localStorage.setItem(storageKey(surveyId), created.data.id);
      setSession(created.data);
      model.data = {};
      model.currentPageNo = 0;
      setProgress(0);
      attachHooks(created.data.id);
      setStage("running");
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { detail?: unknown } } };
      if (ax?.response?.status === 410) {
        setStage("expired");
      } else if (ax?.response?.status === 403) {
        const d = ax.response?.data?.detail;
        if (d && typeof d === "object" && !Array.isArray(d) && "code" in d && (d as { code?: string }).code === "survey_not_started") {
          const o = d as {
            title?: string;
            description?: string | null;
            start_date?: string | null;
            end_date?: string | null;
          };
          setNotStarted({
            title: o.title ?? "Анкета",
            description: o.description ?? null,
            start_date: o.start_date ?? null,
            end_date: o.end_date ?? null,
          });
          setPub(null);
          setStage("not_started");
        } else {
          setErr(errorMessage(e, "Не удалось начать сессию"));
        }
      } else {
        setErr(errorMessage(e, "Не удалось начать сессию"));
      }
    } finally {
      setStartingSession(false);
    }
  }

  function handleRestart() {
    if (!surveyId) return;
    localStorage.removeItem(storageKey(surveyId));
    setSession(null);
    setRespondentId("");
    setErr(null);
    model.fromJSON(pub?.survey_json || { pages: [] });
    model.locale = "ru";
    setStage("identify");
  }

  useEffect(() => {
    void loadSurvey();
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  useEffect(() => {
    if (stage !== "not_started" || !surveyId) return;
    const id = window.setInterval(() => void loadSurveyRef.current(), 15000);
    return () => clearInterval(id);
  }, [stage, surveyId]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (err && stage !== "running") {
    return (
      <Box
        sx={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          px: 2,
        }}
      >
        <Card elevation={0} sx={{ maxWidth: 480, width: "100%", border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ p: 3, textAlign: "center" }}>
            <Alert severity="error" sx={{ textAlign: "left" }}>
              {err}
            </Alert>
            <Typography variant="body2" sx={{ mt: 2, color: "text.secondary", fontSize: 12 }}>
              ННГУ им. Лобачевского — Система анкетирования
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (stage === "not_started" && notStarted) {
    const range =
      notStarted.start_date && notStarted.end_date
        ? `С ${formatSurveyLocale(notStarted.start_date)} по ${formatSurveyLocale(notStarted.end_date)}`
        : notStarted.start_date
          ? `Начало приёма ответов: ${formatSurveyLocale(notStarted.start_date)}`
          : null;
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6, px: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h5">{notStarted.title}</Typography>
          {notStarted.description && (
            <Typography variant="body2" color="text.secondary">
              {notStarted.description}
            </Typography>
          )}
          <Alert severity="info">Ещё не начато — приём ответов ещё не открыт.</Alert>
          {range && (
            <Typography variant="body2" color="text.secondary">
              {range}
            </Typography>
          )}
          <Button variant="outlined" onClick={() => void loadSurvey()}>
            Проверить снова
          </Button>
        </Stack>
      </Box>
    );
  }

  if (stage === "not_started") {
    return <CircularProgress />;
  }

  if (stage === "expired") {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6, px: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
          <Alert severity="warning">Срок проведения этой анкеты истёк. Приём ответов завершён.</Alert>
        </Stack>
      </Box>
    );
  }

  if (stage === "identify") {
    const deadline = pub?.ends_at ?? pub?.end_date;
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6, px: 2 }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
            {pub?.description && (
              <Typography variant="body2" color="text.secondary">
                {pub.description}
              </Typography>
            )}
            {deadline && (
              <Typography variant="caption" color="text.secondary">
                Доступна до: {new Date(deadline).toLocaleString("ru-RU")}
              </Typography>
            )}
          </Stack>

          <TextField
            label={
              pub?.allow_anonymous === false
                ? "Ваш идентификатор (обязательно)"
                : "Ваше имя или идентификатор (необязательно)"
            }
            value={respondentId}
            onChange={(e) => setRespondentId(e.target.value)}
            fullWidth
            required={pub?.allow_anonymous === false}
            onKeyDown={(e) => e.key === "Enter" && void handleStart()}
          />

          {err && <Alert severity="error">{err}</Alert>}

          <Button variant="contained" onClick={() => void handleStart()} disabled={startingSession}>
            {startingSession ? <CircularProgress size={20} /> : "Начать анкетирование"}
          </Button>
        </Stack>
      </Box>
    );
  }

  if (stage === "done") {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6, px: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
          <Alert severity="success">Анкета завершена. Спасибо за участие!</Alert>
          {session?.respondent_id && (
            <Typography variant="body2" color="text.secondary">
              Участник: {session.respondent_id}
            </Typography>
          )}
          <Button variant="outlined" onClick={handleRestart}>
            Пройти заново
          </Button>
        </Stack>
      </Box>
    );
  }

  const deadline = pub?.ends_at ?? pub?.end_date;

  return (
    <Box sx={{ minHeight: "100svh", bgcolor: "background.default" }}>
      <Box
        sx={{
          bgcolor: "white",
          borderBottom: "1px solid",
          borderColor: "divider",
          px: 3,
          py: 1.5,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              bgcolor: "primary.main",
              borderRadius: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <UnnLogo width={18} height={18} />
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>Анкетирование</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>· ННГУ им. Лобачевского</Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ color: "text.primary", mb: 0.5 }}>
            {pub?.title ?? "Анкета"}
          </Typography>
          {pub?.description && <Typography variant="body2">{pub.description}</Typography>}
          {deadline && !session?.is_completed && (
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
              Доступна до: {new Date(deadline).toLocaleString("ru-RU")}
            </Typography>
          )}
        </Box>

        {!session?.is_completed && progress > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "center", mb: 0.75 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                color="primary"
              />
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, minWidth: 32 }}>
                {progress}%
              </Typography>
            </Box>
          </Box>
        )}

        {session?.is_completed && (
          <Card
            elevation={0}
            sx={{ mb: 3, border: "1px solid", borderColor: "rgba(5,150,105,0.3)", bgcolor: "rgba(5,150,105,0.05)" }}
          >
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}>
                <CheckCircleIcon sx={{ color: "#059669", fontSize: 24 }} />
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#059669", fontSize: 15 }}>Анкета завершена</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Спасибо за участие!
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <SurveyRunner model={model} />
      </Box>
    </Box>
  );
}
