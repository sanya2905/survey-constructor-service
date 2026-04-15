import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "../api";
import type { Survey } from "../api";

import { SurveyCreator, SurveyCreatorComponent } from "survey-creator-react";

export default function AdminSurveyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const creator = useMemo(() => {
    const c = new SurveyCreator({
      showLogicTab: true,
      isAutoSave: false, // автосейв можно добавить позже
    });
    c.JSON = { title: "Loading...", pages: [] };
    return c;
  }, []);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await api.get<Survey>(`/surveys/${id}`);
      setSurvey(res.data);
      creator.JSON = res.data.survey_json ?? {};
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load survey");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!id) return;
    setErr(null);
    setInfo(null);
    try {
      const json = creator.JSON;
      const res = await api.put<Survey>(`/surveys/${id}`, {
        title: survey?.title ?? "Анкета",
        description: survey?.description ?? null,
        survey_json: json,
      });
      setSurvey(res.data);
      setInfo("Сохранено");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    }
  }

  async function publish() {
    if (!id) return;
    setErr(null);
    setInfo(null);
    try {
      const res = await api.post<Survey>(`/surveys/${id}/publish`);
      setSurvey(res.data);
      setInfo("Опубликовано");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to publish");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <CircularProgress />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Stack>
          <Typography variant="h5">Редактор анкеты</Typography>
          {survey && (
            <Typography variant="body2" color="text.secondary">
              ID: {survey.id} • status: {survey.is_published ? "published" : "draft"} • v{survey.version}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load}>
            Обновить
          </Button>
          <Button variant="contained" onClick={save}>
            Сохранить
          </Button>
          <Button color="success" variant="contained" onClick={publish} disabled={!!survey?.is_published}>
            Опубликовать
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      <SurveyCreatorComponent creator={creator} />
    </Stack>
  );
}