import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "../api";
import type { PublicSurvey } from "../api";
import type { Session } from "../api";
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

  const saveTimer = useRef<number | null>(null);

  const model = useMemo(() => {
    // создадим “пустую” модель, JSON подставим позже
    return new Model({ title: "Loading...", pages: [] });
  }, []);

  async function loadAll() {
    if (!surveyId) return;
    setLoading(true);
    setErr(null);

    try {
      // 1) load published survey
      const sres = await api.get<PublicSurvey>(`/public/surveys/${surveyId}`);
      setPub(sres.data);
      model.fromJSON(sres.data.survey_json || { pages: [] });

      // 2) session resume/start
      const existing = localStorage.getItem(storageKey(surveyId));
      if (existing) {
        const ses = await api.get<Session>(`/public/sessions/${existing}`);
        setSession(ses.data);
        model.data = ses.data.answers_json || {};
      } else {
        const created = await api.post<Session>(`/public/surveys/${surveyId}/sessions`, {
          respondent_id: null, // можно потом добавить ввод
        });
        setSession(created.data);
        localStorage.setItem(storageKey(surveyId), created.data.id);
        model.data = created.data.answers_json || {};
      }

      // 3) autosave hooks
      model.onValueChanged.add(() => scheduleSave());
      model.onCurrentPageChanged.add(() => scheduleSave());

      // 4) complete hook
      model.onComplete.add(async (sender) => {
        if (!surveyId) return;
        const sid = localStorage.getItem(storageKey(surveyId));
        if (!sid) return;

        try {
          await api.post(`/public/sessions/${sid}/complete`, { answers_json: sender.data });
          // можно очистить sessionId после завершения:
          // localStorage.removeItem(storageKey(surveyId));
        } catch (e: any) {
          setErr(e?.message ?? "Failed to complete session");
        }
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load survey");
    } finally {
      setLoading(false);
    }
  }

  function scheduleSave() {
    if (!surveyId) return;
    const sid = localStorage.getItem(storageKey(surveyId));
    if (!sid) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    // debounce 700ms
    saveTimer.current = window.setTimeout(async () => {
      try {
        await api.put(`/public/sessions/${sid}`, { answers_json: model.data });
      } catch {
        // MVP: молча (можно показать toast позже)
      }
    }, 700);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  if (loading) return <CircularProgress />;

  if (err) {
    return <Alert severity="error">{err}</Alert>;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h5">{pub?.title ?? "Анкета"}</Typography>
      {pub?.description && (
        <Typography variant="body2" color="text.secondary">
          {pub.description}
        </Typography>
      )}
      {session?.is_completed && <Alert severity="info">Сессия уже завершена. Можно просмотреть ответы.</Alert>}

      <SurveyRunner model={model} />
    </Stack>
  );
}