import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.models.survey import Survey
from app.models.session import SurveySession
from app.schemas.session import SessionCreate, SessionOut, SessionSave, SessionComplete

router = APIRouter(prefix="/public")

@router.get("/surveys/{survey_id}")
async def get_public_survey(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    if not survey or not survey.is_published:
        raise HTTPException(404, "Survey not found or not published")
    return {
        "id": str(survey.id),
        "title": survey.title,
        "description": survey.description,
        "survey_json": survey.survey_json,
        "version": survey.version,
    }

@router.post("/surveys/{survey_id}/sessions", response_model=SessionOut)
async def start_session(survey_id: uuid.UUID, payload: SessionCreate, db: AsyncSession = Depends(get_db)):
    # проверим, что анкета опубликована
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    if not survey or not survey.is_published:
        raise HTTPException(404, "Survey not found or not published")

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

    session.answers_json = payload.answers_json or {}
    session.is_completed = True
    await db.commit()
    await db.refresh(session)
    return session