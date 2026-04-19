import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { getSurvey, createSurvey, updateSurvey, publishSurvey, deleteSurvey, getCurrentUser } from "../api";
import type { Survey } from "../api";

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
  const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);

  const creator = useMemo(() => {
    const c = new SurveyCreator({ showLogicTab: true, autoSaveEnabled: true, autoSaveDelay: 1000 });
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
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const id = setInterval(() => {
      const st = (creator as any).state as string | undefined;
      setCreatorState(st ?? null);
    }, 300);
    return () => clearInterval(id);
  }, [creator]);

  useEffect(() => {
    // wire saver used by Survey Creator autoSave mechanism
    // saveSurveyFunc(saveNo, callback)
    creator.saveSurveyFunc = (saveNo: number, callback: (no: number, isSuccess: boolean) => void) => {
      (async () => {
        setErr(null);
        setInfo(null);
        try {
          const payload = {
            title: creator.JSON?.title ?? surveyRef.current?.title ?? "Анкета",
            description: surveyRef.current?.description ?? null,
            survey_json: creator.JSON,
          } as Partial<Survey>;

          if (surveyRef.current?.id) {
            const updated = await updateSurvey(surveyRef.current.id as string, payload);
            setSurvey(updated);
          } else {
            const created = await createSurvey(payload);
            // navigate to new survey route (will trigger load)
            navigate(`/admin/surveys/${created.id}`);
          }

          setInfo("Сохранено");
          callback(saveNo, true);
        } catch (e: any) {
          setErr(e?.message ?? String(e));
          callback(saveNo, false);
        }
      })();
    };
    // keep effect stable; creator is stable from useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator, navigate]);

    useEffect(() => {
      async function fetchUser() {
        try {
          const u: any = await getCurrentUser();
          setCurrentUser(u);
          (creator as any).autoSaveEnabled = u?.role === "admin" || u?.role === "researcher";
        } catch {
          const role = localStorage.getItem("auth_role");
          if (role) {
            setCurrentUser({ role });
            (creator as any).autoSaveEnabled = role === "admin" || role === "researcher";
          } else {
            setCurrentUser(null);
            (creator as any).autoSaveEnabled = false;
          }
        }
      }
      fetchUser();
    }, [creator]);

  async function handleSave() {
    setErr(null);
    setInfo(null);
    try {
      const payload = {
        title: creator.JSON?.title ?? survey?.title ?? "Анкета",
        description: survey?.description ?? null,
        survey_json: creator.JSON,
      } as Partial<Survey>;

      if (survey?.id) {
        const updated = await updateSurvey(survey.id as string, payload);
        setSurvey(updated);
        setInfo("Сохранено");
      } else {
        const created = await createSurvey(payload);
        navigate(`/admin/surveys/${created.id}`);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function handlePublish() {
    if (!survey?.id) return;
    setErr(null);
    setInfo(null);
    try {
      // ensure latest title / JSON are persisted before publishing
      const payload = {
        title: creator.JSON?.title ?? survey?.title ?? "",
        description: survey?.description ?? null,
        survey_json: creator.JSON,
      } as Partial<Survey>;

      try {
        await updateSurvey(survey.id as string, payload);
      } catch {
        // continue to publish even if update fails; publish endpoint will still set is_published
      }

      const res = await publishSurvey(survey.id as string);
      setSurvey(res);
      setInfo("Опубликовано");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function handleDelete() {
    if (!survey?.id) return;
    if (!confirm("Удалить анкету?")) return;
    try {
      await deleteSurvey(survey.id as string);
      navigate("/admin/surveys");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  if (loading) return <CircularProgress />;

  return (
    <Stack spacing={2} sx={{ padding: 2 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button variant="text" onClick={() => navigate("/admin/surveys")}>
            Назад
          </Button>
          <Stack>
            <Typography variant="h5">Редактор анкеты</Typography>
            {survey && (
              <Typography variant="body2" color="text.secondary">
                ID: {survey.id} • status: {survey.is_published ? "published" : "draft"} • v{survey.version}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Обновить
          </Button>

          <Button variant="outlined" onClick={() => navigate("/admin/surveys")}>
            Главная
          </Button>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button variant="contained" onClick={handleSave} disabled={!(currentUser?.role === "admin" || currentUser?.role === "researcher")}>
              Сохранить
            </Button>
            {creatorState === "saving" && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={18} />
              </Stack>
            )}
            {creatorState === "saved" && <Typography color="success.main">Сохранено</Typography>}
            {creatorState === "modified" && <Typography color="text.secondary">Изменено</Typography>}
          </Stack>

          <Button color="success" variant="contained" onClick={handlePublish} disabled={!!survey?.is_published || !(currentUser?.role === "admin" || currentUser?.role === "researcher") }>
            Опубликовать
          </Button>
          <Button variant="outlined" color="error" onClick={handleDelete} disabled={!(currentUser?.role === "admin" || currentUser?.role === "researcher")}>
            Удалить
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      <SurveyCreatorComponent creator={creator} />
    </Stack>
  );
}