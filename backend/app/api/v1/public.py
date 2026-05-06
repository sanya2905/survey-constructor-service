"""Public (unauthenticated) survey endpoints.

These endpoints are used by respondents who fill in published surveys.
All domain logic is handled by the service layer.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.schemas.session import SessionCreate, SessionOut, SessionSave, SessionComplete
from app.services.survey_service import SurveyService
from app.services.session_service import SessionService

router = APIRouter(prefix="/public")


@router.get("/surveys/{survey_id}")
async def get_public_survey(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    survey = await SurveyService(db).get_public_survey(survey_id)
    return {
        "id": str(survey.id),
        "title": survey.title,
        "description": survey.description,
        "survey_json": survey.survey_json,
        "version": survey.version,
        "allow_anonymous": survey.allow_anonymous,
        "ends_at": survey.ends_at.isoformat() if survey.ends_at else None,
    }


@router.post("/surveys/{survey_id}/sessions", response_model=SessionOut)
async def start_session(
    survey_id: uuid.UUID,
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
):
    return await SessionService(db).start_session(survey_id, payload.respondent_id)


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await SessionService(db).get_session(session_id)


@router.put("/sessions/{session_id}", response_model=SessionOut)
async def save_progress(
    session_id: uuid.UUID,
    payload: SessionSave,
    db: AsyncSession = Depends(get_db),
):
    return await SessionService(db).save_progress(session_id, payload)


@router.post("/sessions/{session_id}/complete", response_model=SessionOut)
async def complete_session(
    session_id: uuid.UUID,
    payload: SessionComplete,
    db: AsyncSession = Depends(get_db),
):
    return await SessionService(db).complete_session(session_id, payload)
