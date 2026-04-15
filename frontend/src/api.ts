import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export type Survey = {
  id: string;
  title: string;
  description?: string | null;
  survey_json: any;
  is_published: boolean;
  version: number;
};

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