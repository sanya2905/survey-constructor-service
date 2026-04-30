import uuid
from datetime import datetime
from pydantic import BaseModel

class SurveyCreate(BaseModel):
    title: str = "Новая анкета"
    description: str | None = None
    survey_json: dict = {}

class SurveyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    survey_json: dict | None = None
    is_published: bool | None = None
    version: int | None = None
    # Conducting settings
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_responses: int | None = None
    allow_anonymous: bool | None = None

class SurveyOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    survey_json: dict
    is_published: bool
    version: int
    created_at: datetime | None = None
    published_at: datetime | None = None
    # Conducting settings
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_responses: int | None = None
    allow_anonymous: bool = True

class SurveyStats(BaseModel):
    survey_id: uuid.UUID
    total_sessions: int
    completed_sessions: int
    in_progress_sessions: int
    completion_rate: float          # 0.0–1.0
    avg_progress_pct: float
    responses_by_question: dict     # question_name → {choice: count}
