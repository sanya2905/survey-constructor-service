import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { api } from "../api";
import type { Survey } from "../api";

export default function AdminSurveysListPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<Survey[]>("/surveys");
      setItems(res.data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load surveys");
    } finally {
      setLoading(false);
    }
  }

  async function createSurvey() {
    setErr(null);
    try {
      const res = await api.post<Survey>("/surveys", {
        title: "Новая анкета",
        description: null,
        survey_json: {
          title: "Новая анкета",
          pages: [{ name: "page1", elements: [] }],
        },
      });
      nav(`/admin/surveys/${res.data.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create survey");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">Анкеты (Admin)</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load}>
            Обновить
          </Button>
          <Button variant="contained" onClick={createSurvey}>
            Создать анкету
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
      {loading ? (
        <CircularProgress />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Версия</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.title}</TableCell>
                <TableCell>
                  {s.is_published ? (
                    <Chip color="success" label="published" size="small" />
                  ) : (
                    <Chip color="default" label="draft" size="small" />
                  )}
                </TableCell>
                <TableCell>{s.version}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                    <Button size="small" onClick={() => nav(`/admin/surveys/${s.id}`)}>
                      Редактировать
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => nav(`/s/${s.id}`)}>
                      Открыть ссылку
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}