import uuid
from datetime import datetime
from pydantic import BaseModel

class SessionCreate(BaseModel):
    respondent_id: str | None = None

class SessionOut(BaseModel):
    id: uuid.UUID
    survey_id: uuid.UUID
    respondent_id: str | None
    answers_json: dict
    is_completed: bool
    current_page: int = 0
    progress_pct: float = 0.0
    last_saved_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None

class SessionSave(BaseModel):
    answers_json: dict
    current_page: int = 0
    progress_pct: float = 0.0

class SessionComplete(BaseModel):
    answers_json: dict
