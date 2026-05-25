import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { getSurveyVersions, restoreSurveyVersion, errorMessage } from "../api";
import type { SurveyVersion } from "../api";

interface VersionHistoryPanelProps {
  surveyId: string;
  currentVersion: number;
  onRestore?: () => void;
  canEdit: boolean;
}

export default function VersionHistoryPanel({
  surveyId,
  currentVersion,
  onRestore,
  canEdit,
}: VersionHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<SurveyVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && surveyId) {
      loadVersions();
    }
  }, [open, surveyId]);

  async function loadVersions() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSurveyVersions(surveyId);
      setVersions(data);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function handleToggleExpand(versionId: string) {
    setExpandedId(expandedId === versionId ? null : versionId);
  }

  function handleRestoreClick(version: SurveyVersion) {
    setSelectedVersion(version);
    setRestoreDialogOpen(true);
  }

  async function handleConfirmRestore() {
    if (!selectedVersion) return;
    setRestoring(true);
    setError(null);
    try {
      await restoreSurveyVersion(surveyId, selectedVersion.id);
      setRestoreDialogOpen(false);
      setSelectedVersion(null);
      await loadVersions();
      onRestore?.();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setRestoring(false);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderChanges(changes: Record<string, unknown> | null): React.ReactNode {
    if (!changes) return null;

    const fieldNames: Record<string, string> = {
      title: "Название",
      description: "Описание",
      survey_json: "Структура анкеты",
      is_published: "Статус публикации",
      start_date: "Дата начала",
      end_date: "Дата окончания",
      starts_at: "Время начала",
      ends_at: "Время окончания",
      max_responses: "Макс. ответов",
      allow_anonymous: "Анонимные ответы",
      action: "Действие",
    };

    return (
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {Object.entries(changes).map(([key, value]) => {
          const label = fieldNames[key] || key;
          let changeText = "";

          if (key === "action") {
            const actionMap: Record<string, string> = {
              created: "Создана",
              published: "Опубликована",
              restored: "Восстановлена",
            };
            changeText = actionMap[String(value)] || String(value);
          } else if (key === "survey_json") {
            changeText = "Изменена структура";
          } else if (value && typeof value === "object" && "old" in value && "new" in value) {
            const oldVal = (value as { old: unknown }).old;
            const newVal = (value as { new: unknown }).new;
            changeText = `${oldVal ?? "—"} → ${newVal ?? "—"}`;
          } else {
            changeText = String(value);
          }

          return (
            <Typography key={key} variant="body2" color="text.secondary">
              <strong>{label}:</strong> {changeText}
            </Typography>
          );
        })}
      </Stack>
    );
  }

  return (
    <>
      <Tooltip title="История версий">
        <IconButton
          onClick={() => setOpen(!open)}
          sx={{
            bgcolor: open ? "primary.main" : "background.paper",
            color: open ? "primary.contrastText" : "text.secondary",
            "&:hover": { bgcolor: open ? "primary.dark" : "action.hover" },
          }}
        >
          <HistoryIcon />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{ "& .MuiDialog-paper": { maxHeight: "80vh" } }}
      >
        <DialogTitle>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" sx={{ alignItems: "center", spacing: 1 }}>
              <HistoryIcon color="primary" />
              <Typography variant="h6">История версий</Typography>
              <Chip label={`v${currentVersion}`} size="small" color="primary" />
            </Stack>
            <IconButton onClick={() => setOpen(false)} size="small">
              <ExpandLessIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 2 }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : versions.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">История версий пуста</Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {versions.map((version, index) => (
                <Paper
                  key={version.id}
                  elevation={0}
                  sx={{
                    mb: 1,
                    mx: 2,
                    border: "1px solid",
                    borderColor: version.version_number === currentVersion ? "primary.main" : "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <ListItem
                    disablePadding
                    secondaryAction={
                      canEdit &&
                      version.version_number !== currentVersion && (
                        <Tooltip title="Восстановить эту версию">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleRestoreClick(version)}
                            sx={{ mr: 1 }}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    <ListItemButton onClick={() => handleToggleExpand(version.id)}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Chip
                          label={`v${version.version_number}`}
                          size="small"
                          color={version.version_number === currentVersion ? "primary" : "default"}
                          variant={version.version_number === currentVersion ? "filled" : "outlined"}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" sx={{ alignItems: "center", spacing: 1, flexWrap: "wrap" }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {version.change_summary || "Изменение"}
                            </Typography>
                            {version.version_number === currentVersion && (
                              <Chip label="Текущая" size="small" color="success" variant="outlined" />
                            )}
                            {index === 0 && version.version_number !== currentVersion && (
                              <Chip label="Последняя" size="small" color="info" variant="outlined" />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" sx={{ alignItems: "center", spacing: 2, mt: 0.5 }}>
                            <Stack direction="row" sx={{ alignItems: "center", spacing: 0.5 }}>
                              <PersonIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {version.edited_by_name || "Система"}
                              </Typography>
                            </Stack>
                            <Stack direction="row" sx={{ alignItems: "center", spacing: 0.5 }}>
                              <AccessTimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(version.created_at)}
                              </Typography>
                            </Stack>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>

                  <Collapse in={expandedId === version.id}>
                    <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                      <Divider sx={{ mb: 1 }} />
                      {renderChanges(version.changes)}
                    </Box>
                  </Collapse>
                </Paper>
              ))}
            </List>
          )}
        </DialogContent>

        <Divider />

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
          <Button onClick={loadVersions} disabled={loading}>
            Обновить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={restoreDialogOpen}
        onClose={() => !restoring && setRestoreDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Восстановить версию?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Вы собираетесь восстановить версию <strong>v{selectedVersion?.version_number}</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Текущая версия <strong>v{currentVersion}</strong> будет сохранена в истории, а затем будет
            создана новая версия на основе выбранной.
          </Typography>
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={restoring}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirmRestore}
            color="warning"
            variant="contained"
            disabled={restoring}
            startIcon={restoring ? <CircularProgress size={16} /> : <RestoreIcon />}
          >
            {restoring ? "Восстановление..." : "Восстановить"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
