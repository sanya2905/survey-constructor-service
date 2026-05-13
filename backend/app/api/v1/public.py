import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.models.survey import Survey
from app.models.session import SurveySession
from app.schemas.session import SessionCreate, SessionOut, SessionSave, SessionComplete


def _validate_answers(answers_json: dict) -> None:
    if not isinstance(answers_json, dict):
        raise HTTPException(400, "answers_json must be an object")
    for k in answers_json.keys():
        if not isinstance(k, str):
            raise HTTPException(400, "answers_json keys must be strings")


def _aware_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _check_survey_available(survey: Survey) -> None:
    """Raise 404 if not published, 410 if deadline has passed, 403 if start is in the future."""
    if not survey or not survey.is_published:
        raise HTTPException(404, "Survey not found or not published")
    now = datetime.now(timezone.utc)

    if survey.end_date is not None:
        end = _aware_utc(survey.end_date)
        if now > end:
            raise HTTPException(410, "Survey is closed: the deadline has passed")

    if survey.start_date is not None:
        start = _aware_utc(survey.start_date)
        if now < start:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "survey_not_started",
                    "message": "Survey has not started yet",
                    "title": survey.title,
                    "description": survey.description,
                    "start_date": start.isoformat(),
                    "end_date": survey.end_date.isoformat() if survey.end_date else None,
                },
            )


router = APIRouter(prefix="/public")

@router.get("/surveys/{survey_id}")
async def get_public_survey(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    _check_survey_available(survey)
    return {
        "id": str(survey.id),
        "title": survey.title,
        "description": survey.description,
        "survey_json": survey.survey_json,
        "version": survey.version,
        "start_date": survey.start_date.isoformat() if survey.start_date else None,
        "end_date": survey.end_date.isoformat() if survey.end_date else None,
    }

@router.post("/surveys/{survey_id}/sessions", response_model=SessionOut)
async def start_session(survey_id: uuid.UUID, payload: SessionCreate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    _check_survey_available(survey)

    session = SurveySession(survey_id=survey_id, respondent_id=payload.respondent_id, answers_json={}, is_completed=False)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SurveySession).where(SurveySession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    return session

@router.put("/sessions/{session_id}", response_model=SessionOut)
async def save_progress(session_id: uuid.UUID, payload: SessionSave, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SurveySession).where(SurveySession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.is_completed:
        raise HTTPException(400, "Session already completed")

    _validate_answers(payload.answers_json or {})
    session.answers_json = payload.answers_json or {}
    await db.commit()
    await db.refresh(session)
    return session

@router.post("/sessions/{session_id}/complete", response_model=SessionOut)
async def complete_session(session_id: uuid.UUID, payload: SessionComplete, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SurveySession).where(SurveySession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    _validate_answers(payload.answers_json or {})
    session.answers_json = payload.answers_json or {}
    session.is_completed = True
    await db.commit()
    await db.refresh(session)
    return session