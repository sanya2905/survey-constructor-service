import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { editorLocalization } from "survey-creator-core";
import "survey-creator-core/i18n/russian";
import { surveyLocalization } from "survey-core";
import "survey-core/i18n/russian";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { getSurvey, createSurvey, updateSurvey, publishSurvey, deleteSurvey, getCurrentUser } from "../api";
import type { Survey } from "../api";
import { datetimeLocalToIso, isoToDatetimeLocalValue } from "../datetimeLocal";
import { copyTextToClipboard, getPublicSurveyUrl } from "../publicSurveyLink";

editorLocalization.currentLocale = "ru";
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
  const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);
  // start_date / end_date as "YYYY-MM-DDTHH:mm" for datetime-local (local wall time, not UTC slice)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const creator = useMemo(() => {
    const c = new SurveyCreator({
      showLogicTab: true,
      autoSaveEnabled: true,
      autoSaveDelay: 1000,
      locale: "ru",
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
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function handleSave() {
    setErr(null);
    setInfo(null);
    try {
      const payload = {
        title: creator.JSON?.title ?? survey?.title ?? "Анкета",
        description: survey?.description ?? null,
        survey_json: creator.JSON,
        start_date: datetimeLocalToIso(startDate),
        end_date: datetimeLocalToIso(endDate),
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
                ID: {survey.id} • статус: {survey.is_published ? "опубликована" : "черновик"} • v{survey.version}
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
          {survey?.is_published && survey.id && (
            <Button variant="outlined" onClick={() => void handleCopyPublicLink()}>
              Скопировать ссылку
            </Button>
          )}
          <Button variant="outlined" color="error" onClick={handleDelete} disabled={!(currentUser?.role === "admin" || currentUser?.role === "researcher")}>
            Удалить
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", px: 1, flexWrap: "wrap" }}>
        <TextField
          label="Начало приёма ответов"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          disabled={!(currentUser?.role === "admin" || currentUser?.role === "researcher")}
          sx={{ minWidth: 280 }}
        />
        <TextField
          label="Окончание приёма ответов"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          disabled={!(currentUser?.role === "admin" || currentUser?.role === "researcher")}
          sx={{ minWidth: 280 }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleSaveSchedule}
          disabled={!survey?.id || !(currentUser?.role === "admin" || currentUser?.role === "researcher")}
        >
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

      <SurveyCreatorComponent creator={creator} />
    </Stack>
  );
}