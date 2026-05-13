import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

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
    """Raise 404 if not published, 410 if any deadline passed, 403 if not yet open."""
    if not survey or not survey.is_published:
        raise HTTPException(404, "Survey not found or not published")
    now = datetime.now(timezone.utc)

    end_candidates: list[datetime] = []
    if survey.end_date is not None:
        end_candidates.append(_aware_utc(survey.end_date))
    if survey.ends_at is not None:
        end_candidates.append(_aware_utc(survey.ends_at))
    if end_candidates and now > min(end_candidates):
        raise HTTPException(410, "Survey is closed: the deadline has passed")

    start_candidates: list[datetime] = []
    if survey.start_date is not None:
        start_candidates.append(_aware_utc(survey.start_date))
    if survey.starts_at is not None:
        start_candidates.append(_aware_utc(survey.starts_at))
    if start_candidates and now < max(start_candidates):
        eff_start = max(start_candidates)
        end_for_msg = min(end_candidates) if end_candidates else None
        raise HTTPException(
            status_code=403,
            detail={
                "code": "survey_not_started",
                "message": "Survey has not started yet",
                "title": survey.title,
                "description": survey.description,
                "start_date": eff_start.isoformat(),
                "end_date": end_for_msg.isoformat() if end_for_msg else None,
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
        "allow_anonymous": survey.allow_anonymous,
        "starts_at": survey.starts_at.isoformat() if survey.starts_at else None,
        "ends_at": survey.ends_at.isoformat() if survey.ends_at else None,
    }


@router.post("/surveys/{survey_id}/sessions", response_model=SessionOut)
async def start_session(survey_id: uuid.UUID, payload: SessionCreate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    _check_survey_available(survey)

    # ТР-6: check max_responses cap
    if survey.max_responses is not None:
        count_res = await db.execute(
            select(func.count()).where(
                SurveySession.survey_id == survey_id,
                SurveySession.is_completed == True,  # noqa: E712
            )
        )
        completed_count = count_res.scalar() or 0
        if completed_count >= survey.max_responses:
            raise HTTPException(403, "Survey has reached the maximum number of responses")

    # ТР-2: if anonymous not allowed, require respondent_id
    if not survey.allow_anonymous and not payload.respondent_id:
        raise HTTPException(400, "This survey requires a respondent identifier")

    session = SurveySession(
        survey_id=survey_id,
        respondent_id=payload.respondent_id,
        answers_json={},
        is_completed=False,
        current_page=0,
        progress_pct=0.0,
    )
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

    survey_res = await db.execute(select(Survey).where(Survey.id == session.survey_id))
    survey = survey_res.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    end_bounds: list[datetime] = []
    if survey:
        if survey.ends_at is not None:
            end_bounds.append(_aware_utc(survey.ends_at))
        if survey.end_date is not None:
            end_bounds.append(_aware_utc(survey.end_date))
    if end_bounds and now > min(end_bounds):
        raise HTTPException(403, "Survey has ended — no further changes allowed")

    _validate_answers(payload.answers_json or {})
    session.answers_json = payload.answers_json or {}
    session.current_page = payload.current_page
    session.progress_pct = min(max(payload.progress_pct, 0.0), 100.0)
    session.last_saved_at = datetime.now(timezone.utc)
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
    session.progress_pct = 100.0
    session.completed_at = datetime.now(timezone.utc)
    session.last_saved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session
