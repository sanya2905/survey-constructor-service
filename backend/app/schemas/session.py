import uuid
from pydantic import BaseModel

class SessionCreate(BaseModel):
    respondent_id: str | None = None

class SessionOut(BaseModel):
    id: uuid.UUID
    survey_id: uuid.UUID
    respondent_id: str | None
    answers_json: dict
    is_completed: bool

class SessionSave(BaseModel):
    answers_json: dict

class SessionComplete(BaseModel):
    answers_json: dict