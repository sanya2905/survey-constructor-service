import uuid
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

class SurveyOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    survey_json: dict
    is_published: bool
    version: int