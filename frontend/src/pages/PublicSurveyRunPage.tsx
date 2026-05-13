import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import type { PublicSurvey, Session } from "../api";
import { Model, surveyLocalization } from "survey-core";
import "survey-core/i18n/russian";
import { Survey as SurveyRunner } from "survey-react-ui";

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

  const saveTimer = useRef<number | null>(null);
  const loadSurveyRef = useRef<() => Promise<void>>(async () => {});

  const model = useMemo(() => {
    const m = new Model({ title: "Загрузка…", pages: [] });
    m.locale = "ru";
    return m;
  }, []);

  function scheduleSave(sessionId: string) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await api.put(`/public/sessions/${sessionId}`, { answers_json: model.data });
      } catch {
        // silent in MVP
      }
    }, 700) as unknown as number;
  }

  function attachHooks(sessionId: string) {
    model.onValueChanged.clear();
    model.onCurrentPageChanged.clear();
    model.onComplete.clear();

    model.onValueChanged.add(() => scheduleSave(sessionId));
    model.onCurrentPageChanged.add(() => scheduleSave(sessionId));

    model.onComplete.add(async (sender) => {
      try {
        const res = await api.post<Session>(`/public/sessions/${sessionId}/complete`, {
          answers_json: sender.data,
        });
        setSession(res.data);
        setStage("done");
      } catch (e: any) {
        setErr(e?.response?.data?.detail ?? e?.message ?? "Не удалось завершить анкету");
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
      model.fromJSON(sres.data.survey_json || { pages: [] });
      model.locale = "ru";

      const existing = localStorage.getItem(storageKey(surveyId));
      if (existing) {
        try {
          const ses = await api.get<Session>(`/public/sessions/${existing}`);
          setSession(ses.data);
          if (ses.data.is_completed) {
            setStage("done");
          } else {
            model.data = ses.data.answers_json || {};
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
    } catch (e: any) {
      if (e?.response?.status === 410) {
        setStage("expired");
      } else if (e?.response?.status === 403) {
        const d = e?.response?.data?.detail;
        if (d && typeof d === "object" && d.code === "survey_not_started") {
          setNotStarted({
            title: d.title ?? "Анкета",
            description: d.description ?? null,
            start_date: d.start_date ?? null,
            end_date: d.end_date ?? null,
          });
          setPub(null);
          setStage("not_started");
        } else {
          const det = e?.response?.data?.detail;
          setErr(typeof det === "string" ? det : det?.message ?? e?.message ?? "Нет доступа к анкете");
        }
      } else {
        const det = e?.response?.data?.detail;
        setErr(typeof det === "string" ? det : e?.message ?? "Не удалось загрузить анкету");
      }
    } finally {
      setLoading(false);
    }
  }

  loadSurveyRef.current = loadSurvey;

  async function handleStart() {
    if (!surveyId) return;
    const rid = respondentId.trim() || null;
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
      attachHooks(created.data.id);
      setStage("running");
    } catch (e: any) {
      if (e?.response?.status === 410) {
        setStage("expired");
      } else if (e?.response?.status === 403) {
        const d = e?.response?.data?.detail;
        if (d && typeof d === "object" && d.code === "survey_not_started") {
          setNotStarted({
            title: d.title ?? "Анкета",
            description: d.description ?? null,
            start_date: d.start_date ?? null,
            end_date: d.end_date ?? null,
          });
          setPub(null);
          setStage("not_started");
        } else {
          const det = e?.response?.data?.detail;
          setErr(typeof det === "string" ? det : det?.message ?? e?.message ?? "Не удалось начать сессию");
        }
      } else {
        const det = e?.response?.data?.detail;
        setErr(typeof det === "string" ? det : e?.message ?? "Не удалось начать сессию");
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

  if (loading) return <CircularProgress />;

  if (err && stage !== "running") {
    const msg = typeof err === "string" ? err : String(err);
    return <Alert severity="error">{msg}</Alert>;
  }

  // Stage: not yet open (start_date in the future)
  if (stage === "not_started" && notStarted) {
    const range =
      notStarted.start_date && notStarted.end_date
        ? `С ${formatSurveyLocale(notStarted.start_date)} по ${formatSurveyLocale(notStarted.end_date)}`
        : notStarted.start_date
          ? `Начало приёма ответов: ${formatSurveyLocale(notStarted.start_date)}`
          : null;
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6 }}>
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

  // Stage: expired — survey deadline has passed
  if (stage === "expired") {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6 }}>
        <Stack spacing={2}>
          <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
          <Alert severity="warning">
            Срок проведения этой анкеты истёк. Приём ответов завершён.
          </Alert>
        </Stack>
      </Box>
    );
  }

  // Stage: identify — ask for respondent name before starting
  if (stage === "identify") {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6 }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
            {pub?.description && (
              <Typography variant="body2" color="text.secondary">
                {pub.description}
              </Typography>
            )}
          </Stack>

          <TextField
            label="Ваше имя или идентификатор (необязательно)"
            value={respondentId}
            onChange={(e) => setRespondentId(e.target.value)}
            fullWidth
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
          />

          {err && <Alert severity="error">{err}</Alert>}

          <Button
            variant="contained"
            onClick={handleStart}
            disabled={startingSession}
          >
            {startingSession ? <CircularProgress size={20} /> : "Начать анкетирование"}
          </Button>
        </Stack>
      </Box>
    );
  }

  // Stage: done — survey completed
  if (stage === "done") {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 6 }}>
        <Stack spacing={2}>
          <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
          <Alert severity="success">
            Анкета завершена. Спасибо за участие!
          </Alert>
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

  // Stage: running
  return (
    <Stack spacing={1}>
      <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
      {pub?.description && (
        <Typography variant="body2" color="text.secondary">
          {pub.description}
        </Typography>
      )}
      {err && <Alert severity="error">{err}</Alert>}
      <SurveyRunner model={model} />
    </Stack>
  );
}
