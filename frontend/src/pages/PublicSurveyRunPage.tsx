import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert, Box, Card, CardContent, CircularProgress,
  LinearProgress, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api, errorMessage } from "../api";
import type { PublicSurvey, Session } from "../api";
import { Model } from "survey-core";
import { Survey as SurveyRunner } from "survey-react-ui";
import UnnLogo from "../assets/UnnLogo";

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
      const sres = await api.get<PublicSurvey>(`/public/surveys/${surveyId}`);
      setPub(sres.data);

      const surveyJson = sres.data.survey_json || { pages: [] };
      model.fromJSON(surveyJson);

      model.showProgressBar = "top";
      model.progressBarType = "questions";

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
          localStorage.removeItem(storageKey(surveyId));
        }
      }

      if (!activeSession) {
        const created = await api.post<Session>(`/public/surveys/${surveyId}/sessions`, { respondent_id: null });
        activeSession = created.data;
        localStorage.setItem(storageKey(surveyId), created.data.id);
        model.data = {};
      }
      setSession(activeSession);

      model.onValueChanged.add(() => { updateProgress(); scheduleSave(); });
      model.onCurrentPageChanged.add(() => { updateProgress(); scheduleSave(); });

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

  if (err) {
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
            <Alert severity="info" sx={{ textAlign: "left" }}>{err}</Alert>
            <Typography variant="body2" sx={{ mt: 2, color: "text.secondary", fontSize: 12 }}>
              ННГУ им. Лобачевского — Система анкетирования
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100svh", bgcolor: "background.default" }}>
      {/* Public top bar */}
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
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>
            Анкетирование
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            · ННГУ им. Лобачевского
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 4 }}>
        {/* Survey header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ color: "text.primary", mb: 0.5 }}>
            {pub?.title ?? "Анкета"}
          </Typography>
          {pub?.description && (
            <Typography variant="body2">{pub.description}</Typography>
          )}
          {pub?.ends_at && !session?.is_completed && (
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
              Доступна до: {new Date(pub.ends_at).toLocaleString("ru-RU")}
            </Typography>
          )}
        </Box>

        {/* Progress bar */}
        {!session?.is_completed && progress > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                gap: 1,
                alignItems: "center",
                mb: 0.75,
              }}
            >
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

        {/* Completed state */}
        {session?.is_completed && (
          <Card elevation={0} sx={{ mb: 3, border: "1px solid", borderColor: "rgba(5,150,105,0.3)", bgcolor: "rgba(5,150,105,0.05)" }}>
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}>
                <CheckCircleIcon sx={{ color: "#059669", fontSize: 24 }} />
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#059669", fontSize: 15 }}>
                    Анкета завершена
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Спасибо за участие!
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Survey runner */}
        <SurveyRunner model={model} />
      </Box>
    </Box>
  );
}
