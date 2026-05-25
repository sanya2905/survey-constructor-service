import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getSurveyVersions, restoreSurveyVersion, errorMessage } from "../api";
import type { SurveyVersion } from "../api";

interface VersionHistoryPanelProps {
  surveyId: string;
  currentVersion: number;
  refreshKey?: number;
  onRestore?: (surveyJson: Record<string, unknown>, title?: string) => void;
  canEdit: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("ru-RU", {
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

  const actionMap: Record<string, string> = {
    created: "Создана",
    published: "Опубликована",
    restored: "Восстановлена",
    structure_changed: "Изменена структура",
  };

  return (
    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
      {Object.entries(changes).map(([key, value]) => {
        const label = fieldNames[key] || key;
        let changeText = "";

        if (key === "action") {
          if (key === "action" && changes.from_version != null && value === "restored") {
            changeText = `Восстановлена из v${changes.from_version}`;
          } else {
            changeText = actionMap[String(value)] || String(value);
          }
        } else if (key === "from_version") {
          return null;
        } else if (key === "survey_json" && value && typeof value === "object") {
          const v = value as Record<string, unknown>;
          if (v.questions && typeof v.questions === "object") {
            const q = v.questions as { old?: number; new?: number };
            changeText = `Вопросов: ${q.old ?? 0} → ${q.new ?? 0}`;
          } else {
            changeText = "Изменена структура";
          }
        } else if (value && typeof value === "object" && "old" in value && "new" in value) {
          const oldVal = (value as { old: unknown }).old;
          const newVal = (value as { new: unknown }).new;
          changeText = `${oldVal ?? "—"} → ${newVal ?? "—"}`;
        } else {
          changeText = String(value);
        }

        return (
          <Typography key={key} variant="caption" color="text.secondary" sx={{ display: "block" }}>
            <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
              {label}:
            </Box>{" "}
            {changeText}
          </Typography>
        );
      })}
    </Stack>
  );
}

export default function VersionHistoryPanel({
  surveyId,
  currentVersion,
  refreshKey = 0,
  onRestore,
  canEdit,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<SurveyVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    if (!surveyId) return;
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
  }, [surveyId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions, refreshKey]);

  function handleToggleExpand(versionId: string) {
    setExpandedId((prev) => (prev === versionId ? null : versionId));
  }

  function handleRestoreClick(version: SurveyVersion) {
    setSelectedVersion(version);
    setRestoreError(null);
    setRestoreDialogOpen(true);
  }

  async function handleConfirmRestore() {
    if (!selectedVersion) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const updated = await restoreSurveyVersion(surveyId, selectedVersion.id);
      setRestoreDialogOpen(false);
      setSelectedVersion(null);
      await loadVersions();
      const json = updated.survey_json as Record<string, unknown>;
      onRestore?.(json, updated.title);
    } catch (e: unknown) {
      setRestoreError(errorMessage(e));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <HistoryIcon sx={{ fontSize: 20, color: "primary.main" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            История версий
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Chip label={`v${currentVersion}`} size="small" color="primary" />
          <Tooltip title="Обновить">
            <IconButton size="small" onClick={() => void loadVersions()} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", px: 1.5, py: 1.5 }}>
        {loading && versions.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        ) : versions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            История пуста
          </Typography>
        ) : (
          <Stack spacing={1}>
            {versions.map((version) => {
              const isCurrent = version.version_number === currentVersion;
              const isExpanded = expandedId === version.id;

              return (
                <Box
                  key={version.id}
                  sx={{
                    border: "1px solid",
                    borderColor: isCurrent ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    bgcolor: isCurrent ? "action.selected" : "background.default",
                    overflow: "hidden",
                    transition: "border-color 0.15s",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.25,
                      py: 1,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => handleToggleExpand(version.id)}
                  >
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
                    >
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                        <Chip
                          label={`v${version.version_number}`}
                          size="small"
                          color={isCurrent ? "primary" : "default"}
                          variant={isCurrent ? "filled" : "outlined"}
                          sx={{ height: 22, fontSize: 11 }}
                        />
                        {isCurrent && (
                          <Chip
                            label="Текущая"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 11 }}
                          />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                        {canEdit && !isCurrent && (
                          <Tooltip title="Восстановить">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreClick(version);
                              }}
                            >
                              <RestoreIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? (
                            <ExpandLessIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <ExpandMoreIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.75, lineHeight: 1.3 }}>
                      {version.change_summary || "Изменение"}
                    </Typography>

                    <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <PersonIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                        <Typography variant="caption" color="text.secondary">
                          {version.edited_by_name || "Система"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <AccessTimeIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(version.created_at)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Divider />
                    <Box sx={{ px: 1.25, py: 1 }}>{renderChanges(version.changes)}</Box>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      <Dialog
        open={restoreDialogOpen}
        onClose={() => !restoring && setRestoreDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Восстановить версию?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Восстановить версию <strong>v{selectedVersion?.version_number}</strong>? Текущее состояние
            (v{currentVersion}) останется в истории; будет создана новая версия с содержимым выбранной.
          </Typography>
          {restoreError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {restoreError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={restoring}>
            Отмена
          </Button>
          <Button
            onClick={() => void handleConfirmRestore()}
            color="warning"
            variant="contained"
            disabled={restoring}
            startIcon={restoring ? <CircularProgress size={16} color="inherit" /> : <RestoreIcon />}
          >
            {restoring ? "Восстановление…" : "Восстановить"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
