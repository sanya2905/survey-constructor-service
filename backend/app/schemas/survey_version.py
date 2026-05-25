import uuid
from datetime import datetime

from pydantic import BaseModel


class SurveyVersionOut(BaseModel):
    id: uuid.UUID
    survey_id: uuid.UUID
    version_number: int
    edited_by_name: str | None = None
    change_summary: str | None = None
    changes: dict | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SurveyVersionDetailOut(SurveyVersionOut):
    survey_json_snapshot: dict | None = None
