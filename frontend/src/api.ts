import axios from "axios";

const API_HOST = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8001";
const API_PREFIX = API_HOST.replace(/\/$/, "") + "/api/v1";

export const api = axios.create({ baseURL: API_PREFIX, headers: { "Content-Type": "application/json" } });

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      localStorage.setItem("token", token);
    } catch {}
  } else {
    delete api.defaults.headers.common["Authorization"];
    try {
      localStorage.removeItem("token");
    } catch {}
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
  survey_json: any;
  is_published?: boolean;
  version?: number;
};

export async function login(username: string, password: string) {
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

export async function createSurvey(payload: Partial<Survey>) {
  const res = await api.post("/surveys", payload);
  return res.data;
}

export async function updateSurvey(id: string, payload: Partial<Survey>) {
  const res = await api.put(`/surveys/${id}`, payload);
  return res.data;
}

export async function deleteSurvey(id: string) {
  return api.delete(`/surveys/${id}`);
}

export async function publishSurvey(id: string) {
  const res = await api.post(`/surveys/${id}/publish`);
  return res.data;
}

// public endpoints
export async function getPublicSurvey(id: string) {
  const res = await axios.get(`${API_HOST}/public/surveys/${id}`);
  return res.data;
}

export async function startSession(survey_id: string, respondent_id?: string) {
  const res = await axios.post(`${API_HOST}/public/surveys/${survey_id}/sessions`, { respondent_id });
  return res.data;
}

export async function saveProgress(session_id: string, answers_json: any) {
  const res = await axios.put(`${API_HOST}/public/sessions/${session_id}`, { answers_json });
  return res.data;
}

export async function completeSession(session_id: string, answers_json: any) {
  const res = await axios.post(`${API_HOST}/public/sessions/${session_id}/complete`, { answers_json });
  return res.data;
}

export type PublicSurvey = {
  id: string;
  title: string;
  description?: string | null;
  survey_json: any;
  version: number;
};

export type Session = {
  id: string;
  survey_id: string;
  respondent_id?: string | null;
  answers_json: any;
  is_completed: boolean;
};