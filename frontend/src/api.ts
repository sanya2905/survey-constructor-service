/**
 * API client layer — thin wrapper over axios.
 *
 * Mirrors the utility-layer pattern from the ARM-researcher module (api.js):
 * - 30-second request timeout
 * - Automatic Bearer token attachment
 * - Response interceptor: clears auth state on 401 and redirects to /login
 * - Centralised error-message helper
 * - Typed helpers for every backend endpoint
 */

import axios from "axios";

const API_PREFIX = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const api = axios.create({
  baseURL: API_PREFIX,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ── Token management ──────────────────────────────────────────────────────────

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      localStorage.setItem("token", token);
    } catch {
      // Ignore storage failures in private/incognito contexts.
    }
  } else {
    delete api.defaults.headers.common["Authorization"];
    try {
      localStorage.removeItem("token");
    } catch {
      // Ignore storage failures in private/incognito contexts.
    }
  }
}

// Restore token from storage on module load.
const _saved = (() => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
})();
if (_saved) setAuthToken(_saved);

// ── Request interceptor ───────────────────────────────────────────────────────
// Always attach the most recent token even if it was set after module load.
api.interceptors.request.use((config) => {
  const token = (() => {
    try { return localStorage.getItem("token"); } catch { return null; }
  })();
  if (token && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
// On 401, clear credentials and redirect to /login so the user never gets
// stuck with an invisible auth failure.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("auth_role");
      } catch {
        // ignore
      }
      delete api.defaults.headers.common["Authorization"];
      // Only redirect if we are in a browser context and not already on /login.
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ── Error helper ──────────────────────────────────────────────────────────────

export function errorMessage(error: unknown, fallback = "Request failed"): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (error.code === "ECONNABORTED") return "Request timed out — please try again.";
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : String(error);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Survey = {
   id?: string;
   title: string;
   description?: string | null;
   survey_json: Record<string, unknown>;
   is_published?: boolean;
   version?: number;
   created_at?: string | null;
   published_at?: string | null;
   start_date?: string | null;
   end_date?: string | null;
   starts_at?: string | null;
   ends_at?: string | null;
   max_responses?: number | null;
   allow_anonymous?: boolean;
};

export type SurveyVersion = {
   id: string;
   survey_id: string;
   version_number: number;
   edited_by_name: string | null;
   change_summary: string | null;
   changes: Record<string, unknown> | null;
   created_at: string | null;
};

export type SurveyVersionDetail = SurveyVersion & {
   survey_json_snapshot: Record<string, unknown> | null;
};

export type SurveyStats = {
   survey_id: string;
   total_sessions: number;
   completed_sessions: number;
   in_progress_sessions: number;
   completion_rate: number;
   avg_progress_pct: number;
   responses_by_question: Record<string, Record<string, number>>;
};

export type User = {
   id?: string;
   username: string;
   role: string;
   email?: string | null;
};

export type AuthToken = {
   access_token: string;
   token_type?: string;
};

export type Session = {
   id: string;
   survey_id: string;
   respondent_id?: string | null;
   answers_json: Record<string, unknown>;
   is_completed: boolean;
   current_page?: number;
   progress_pct?: number;
   last_saved_at?: string | null;
   completed_at?: string | null;
   created_at?: string | null;
};

export type PublicSurvey = {
    id: string;
    title: string;
    description?: string | null;
    survey_json: Record<string, unknown>;
    version: number;
    allow_anonymous?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    start_date?: string | null;
    end_date?: string | null;
};

// ── API Endpoints ──────────────────────────────────────────────────────────────
export function login(username: string, password: string) {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);
  return api.post<AuthToken>("/auth/token", params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).then(res => res.data);
}

export function getCurrentUser() {
  return api.get<User>("/auth/me").then(res => res.data);
}

export function getSurveys() {
  return api.get<Survey[]>('/surveys').then(res => res.data);
}

export function createSurvey(survey: Partial<Survey>) {
  return api.post<Survey>('/surveys', survey).then(res => res.data);
}

export function updateSurvey(id: string, survey: Partial<Survey>) {
  return api.put<Survey>(`/surveys/${id}`, survey).then(res => res.data);
}

export function deleteSurvey(id: string) {
  return api.delete<void>(`/surveys/${id}`).then(res => res.data);
}

export function publishSurvey(id: string) {
  return api.post<Survey>(`/surveys/${id}/publish`).then(res => res.data);
}

export function getSurvey(id: string) {
  return api.get<Survey>(`/surveys/${id}`).then(res => res.data);
}

export function getSurveyStats(id: string) {
  return api.get<SurveyStats>(`/surveys/${id}/stats`).then(res => res.data);
}

export function getSurveySessions(id: string) {
   return api.get<Session[]>(`/surveys/${id}/sessions`).then(res => res.data);
}

export type SurveyExportFormat = "csv" | "json";

export async function exportSurveyResponses(
  id: string,
  format: SurveyExportFormat,
  options?: { includeIncomplete?: boolean; anonymize?: boolean },
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (options?.includeIncomplete) params.set("include_incomplete", "true");
  if (options?.anonymize) params.set("anonymize", "true");

  const response = await api.get(`/surveys/${id}/export?${params.toString()}`, {
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"] as string | undefined;
  const filenameMatch = disposition?.match(/filename="?([^";\n]+)"?/);
  const ext = format === "csv" ? "csv" : "json";
  const filename = filenameMatch?.[1] ?? `survey_${id}_responses.${ext}`;

  const blob = new Blob([response.data], {
    type: format === "csv" ? "text/csv" : "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getSurveyVersions(id: string) {
   return api.get<SurveyVersion[]>(`/surveys/${id}/versions`).then(res => res.data);
}

export function getSurveyVersion(id: string, versionId: string) {
   return api.get<SurveyVersionDetail>(`/surveys/${id}/versions/${versionId}`).then(res => res.data);
}

export function restoreSurveyVersion(id: string, versionId: string) {
   return api.post<Survey>(`/surveys/${id}/versions/${versionId}/restore`).then(res => res.data);
}
