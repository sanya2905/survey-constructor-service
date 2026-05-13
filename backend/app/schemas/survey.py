import uuid
from datetime import datetime
from pydantic import BaseModel

class SurveyCreate(BaseModel):
    title: str = "Новая анкета"
    description: str | None = None
    survey_json: dict = {}
    start_date: datetime | None = None
    end_date: datetime | None = None

class SurveyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    survey_json: dict | None = None
    is_published: bool | None = None
    version: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None

class SurveyOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    survey_json: dict
    is_published: bool
    version: int
    start_date: datetime | None
    end_date: datetime | None