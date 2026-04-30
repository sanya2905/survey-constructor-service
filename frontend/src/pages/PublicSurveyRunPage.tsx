import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Box, CircularProgress, LinearProgress, Stack, Typography } from "@mui/material";
import { api, errorMessage } from "../api";
import type { PublicSurvey, Session } from "../api";
import { Model } from "survey-core";
import { Survey as SurveyRunner } from "survey-react-ui";

function storageKey(surveyId: string) {
  return `survey_session_${surveyId}`;
}

export default function PublicSurveyRunPage() {
  const { surveyId } = useParams<{ surveyId: string }>();

  const [pub, setPub] = useState<PublicSurvey | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const saveTimer = useRef<number | null>(null);
  const model = useMemo(() => new Model({ title: "Loading...", pages: [] }), []);

  async function loadAll() {
    if (!surveyId) return;
    setLoading(true);
    setErr(null);

    try {
      // 1) load published survey — may 403 if not started / ended
      const sres = await api.get<PublicSurvey>(`/public/surveys/${surveyId}`);
      setPub(sres.data);

      const surveyJson = sres.data.survey_json || { pages: [] };
      model.fromJSON(surveyJson);

      // ТР-3: enable SurveyJS built-in progress bar
      model.showProgressBar = "top";
      model.progressBarType = "questions";

      // 2) session resume/start
      const existing = localStorage.getItem(storageKey(surveyId));
      let activeSession: Session | null = null;

      if (existing) {
        try {
          const ses = await api.get<Session>(`/public/sessions/${existing}`);
          activeSession = ses.data;
          model.data = ses.data.answers_json || {};
          if (ses.data.current_page) {
            model.currentPageNo = ses.data.current_page;
          }
          setProgress(ses.data.progress_pct ?? 0);
        } catch {
          // stale session id — start fresh
          localStorage.removeItem(storageKey(surveyId));
        }
      }

      if (!activeSession) {
        // ТР-2: pass respondent_id if survey requires it (here we use null for anonymous)
        const created = await api.post<Session>(`/public/surveys/${surveyId}/sessions`, { respondent_id: null });
        activeSession = created.data;
        localStorage.setItem(storageKey(surveyId), created.data.id);
        model.data = {};
      }
      setSession(activeSession);

      // 3) autosave hooks — save answers + current page + progress (ТР-3, ТР-8)
      model.onValueChanged.add(() => { updateProgress(); scheduleSave(); });
      model.onCurrentPageChanged.add(() => { updateProgress(); scheduleSave(); });

      // 4) complete hook
      model.onComplete.add(async (sender) => {
        if (!surveyId) return;
        const sid = localStorage.getItem(storageKey(surveyId));
        if (!sid) return;
        try {
          await api.post(`/public/sessions/${sid}/complete`, { answers_json: sender.data });
          setProgress(100);
          localStorage.removeItem(storageKey(surveyId));
        } catch (e: unknown) {
          setErr(errorMessage(e, "Ошибка при завершении анкеты"));
        }
      });

    } catch (e: unknown) {
      // Friendly messages for 403 conducting-time errors
      const msg = errorMessage(e, "Ошибка загрузки анкеты");
      if (msg.includes("not started")) setErr("Анкета ещё не началась. Попробуйте позже.");
      else if (msg.includes("ended")) setErr("Сбор ответов завершён. Анкета больше не доступна.");
      else if (msg.includes("maximum number")) setErr("Достигнуто максимальное число участников. Анкета закрыта.");
      else setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  function updateProgress() {
    // Calculate answered questions / total visible questions
    const visibleQuestions = model.getAllQuestions(false).filter((q) => q.isVisible);
    const answered = visibleQuestions.filter((q) => !q.isEmpty()).length;
    const total = visibleQuestions.length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    setProgress(pct);
  }

  function scheduleSave() {
    if (!surveyId) return;
    const sid = localStorage.getItem(storageKey(surveyId));
    if (!sid) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      try {
        const visibleQuestions = model.getAllQuestions(false).filter((q) => q.isVisible);
        const answered = visibleQuestions.filter((q) => !q.isEmpty()).length;
        const total = visibleQuestions.length;
        const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

        await api.put(`/public/sessions/${sid}`, {
          answers_json: model.data,
          current_page: model.currentPageNo,
          progress_pct: pct,
        });
      } catch {
        // silently ignore transient save failures
      }
    }, 700) as unknown as number;
  }

  useEffect(() => {
    loadAll();
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  if (loading) return <CircularProgress />;

  if (err) return <Alert severity="error">{err}</Alert>;

  return (
    <Stack spacing={1}>
      <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
      {pub?.description && (
        <Typography variant="body2" color="text.secondary">{pub.description}</Typography>
      )}

      {/* ТР-8: progress indicator */}
      {!session?.is_completed && progress > 0 && (
        <Box sx={{ width: "100%" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1, height: 8, borderRadius: 4 }} />
            <Typography variant="caption" color="text.secondary">{progress}%</Typography>
          </Stack>
        </Box>
      )}

      {session?.is_completed && (
        <Alert severity="success">Анкета завершена. Спасибо за участие!</Alert>
      )}

      {/* ТР-5: show countdown if survey has an end time */}
      {pub?.ends_at && !session?.is_completed && (
        <Typography variant="caption" color="text.secondary">
          Анкета доступна до: {new Date(pub.ends_at).toLocaleString("ru-RU")}
        </Typography>
      )}

      <SurveyRunner model={model} />
    </Stack>
  );
}
