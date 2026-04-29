import axios from "axios";

const API_PREFIX = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const api = axios.create({ baseURL: API_PREFIX, headers: { "Content-Type": "application/json" } });

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

// restore token from storage if present
const _saved = (() => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
})();
if (_saved) setAuthToken(_saved);

export type Survey = {
  id?: string;
  title: string;
  description?: string | null;
  survey_json: Record<string, unknown>;
  is_published?: boolean;
  version?: number;
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

export function errorMessage(error: unknown, fallback = "Request failed") {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function login(username: string, password: string): Promise<AuthToken> {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);
  const res = await api.post("/auth/token", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
}

export async function register(payload: { username: string; password: string; role?: string; email?: string }) {
  const res = await api.post("/auth/register", payload);
  return res.data;
}

export async function getSurveys(): Promise<Survey[]> {
  const res = await api.get("/surveys");
  return res.data;
}

export async function getSurvey(id: string): Promise<Survey> {
  const res = await api.get(`/surveys/${id}`);
  return res.data;
}

export async function createSurvey(payload: Partial<Survey>): Promise<Survey> {
  const res = await api.post("/surveys", payload);
  return res.data;
}

export async function updateSurvey(id: string, payload: Partial<Survey>): Promise<Survey> {
  const res = await api.put(`/surveys/${id}`, payload);
  return res.data;
}

export async function deleteSurvey(id: string) {
  return api.delete(`/surveys/${id}`);
}

export async function publishSurvey(id: string): Promise<Survey> {
  const res = await api.post(`/surveys/${id}/publish`);
  return res.data;
}

export async function getCurrentUser(): Promise<User> {
  const res = await api.get("/auth/me");
  return res.data;
}

// public endpoints
export async function getPublicSurvey(id: string): Promise<PublicSurvey> {
  const res = await api.get(`/public/surveys/${id}`);
  return res.data;
}

export async function startSession(survey_id: string, respondent_id?: string): Promise<Session> {
  const res = await api.post(`/public/surveys/${survey_id}/sessions`, { respondent_id });
  return res.data;
}

export async function saveProgress(session_id: string, answers_json: Record<string, unknown>): Promise<Session> {
  const res = await api.put(`/public/sessions/${session_id}`, { answers_json });
  return res.data;
}

export async function completeSession(session_id: string, answers_json: Record<string, unknown>): Promise<Session> {
  const res = await api.post(`/public/sessions/${session_id}/complete`, { answers_json });
  return res.data;
}

export type PublicSurvey = {
  id: string;
  title: string;
  description?: string | null;
  survey_json: Record<string, unknown>;
  version: number;
};

export type Session = {
  id: string;
  survey_id: string;
  respondent_id?: string | null;
  answers_json: Record<string, unknown>;
  is_completed: boolean;
};