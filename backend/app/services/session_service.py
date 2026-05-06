"""Session domain service.

Handles all business rules around respondent survey sessions:
starting, saving progress, and completing a session.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import SurveySession
from app.models.survey import Survey
from app.schemas.session import SessionSave, SessionComplete
from app.services.survey_service import SurveyService


def _validate_answers(answers_json: dict) -> None:
    if not isinstance(answers_json, dict):
        raise HTTPException(400, "answers_json must be an object")
    for k in answers_json.keys():
        if not isinstance(k, str):
            raise HTTPException(400, "answers_json keys must be strings")


class SessionService:
    """Stateless service – pass a db session on every call."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._survey_svc = SurveyService(db)

    # ──────────────────────────────────────────────────────────────────────────
    # Reads
    # ──────────────────────────────────────────────────────────────────────────

    async def get_session(self, session_id: uuid.UUID) -> SurveySession:
        res = await self._db.execute(
            select(SurveySession).where(SurveySession.id == session_id)
        )
        session = res.scalar_one_or_none()
        if session is None:
            raise HTTPException(404, "Session not found")
        return session

    async def list_sessions(
        self,
        survey_id: uuid.UUID,
        respondent_id: str | None = None,
        completed_only: bool = False,
    ) -> list[SurveySession]:
        q = select(SurveySession).where(SurveySession.survey_id == survey_id)
        if respondent_id:
            q = q.where(SurveySession.respondent_id == respondent_id)
        if completed_only:
            q = q.where(SurveySession.is_completed == True)  # noqa: E712
        q = q.order_by(SurveySession.created_at.desc())
        res = await self._db.execute(q)
        return list(res.scalars().all())

    # ──────────────────────────────────────────────────────────────────────────
    # Writes
    # ──────────────────────────────────────────────────────────────────────────

    async def start_session(
        self, survey_id: uuid.UUID, respondent_id: str | None
    ) -> SurveySession:
        survey: Survey = await self._survey_svc.get_public_survey(survey_id)

        # Enforce max_responses cap
        if survey.max_responses is not None:
            count = await self._survey_svc.completed_response_count(survey_id)
            if count >= survey.max_responses:
                raise HTTPException(403, "Survey has reached the maximum number of responses")

        if not survey.allow_anonymous and not respondent_id:
            raise HTTPException(400, "This survey requires a respondent identifier")

        session = SurveySession(
            survey_id=survey_id,
            respondent_id=respondent_id,
            answers_json={},
            is_completed=False,
            current_page=0,
            progress_pct=0.0,
        )
        self._db.add(session)
        await self._db.commit()
        await self._db.refresh(session)
        return session

    async def save_progress(
        self, session_id: uuid.UUID, payload: SessionSave
    ) -> SurveySession:
        session = await self.get_session(session_id)
        if session.is_completed:
            raise HTTPException(400, "Session already completed")

        # Check survey deadline on every save
        survey_res = await self._db.execute(
            select(Survey).where(Survey.id == session.survey_id)
        )
        survey = survey_res.scalar_one_or_none()
        if survey and survey.ends_at and datetime.now(timezone.utc) > survey.ends_at:
            raise HTTPException(403, "Survey has ended — no further changes allowed")

        _validate_answers(payload.answers_json or {})
        session.answers_json = payload.answers_json or {}
        session.current_page = payload.current_page
        session.progress_pct = min(max(payload.progress_pct, 0.0), 100.0)
        session.last_saved_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(session)
        return session

    async def complete_session(
        self, session_id: uuid.UUID, payload: SessionComplete
    ) -> SurveySession:
        session = await self.get_session(session_id)
        _validate_answers(payload.answers_json or {})
        session.answers_json = payload.answers_json or {}
        session.is_completed = True
        session.progress_pct = 100.0
        session.completed_at = datetime.now(timezone.utc)
        session.last_saved_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(session)
        return session
