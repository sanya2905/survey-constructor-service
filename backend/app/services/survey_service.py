"""Survey domain service.

Encapsulates all business rules and database access for surveys so that
route handlers stay thin HTTP adapters with no direct ORM calls.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import SurveySession
from app.models.survey import Survey
from app.schemas.survey import SurveyCreate, SurveyUpdate


class SurveyService:
    """Stateless service – pass a db session on every call."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ──────────────────────────────────────────────────────────────────────────
    # Reads
    # ──────────────────────────────────────────────────────────────────────────

    async def list_surveys(self) -> list[Survey]:
        res = await self._db.execute(select(Survey).order_by(Survey.created_at.desc()))
        return list(res.scalars().all())

    async def get_survey(self, survey_id: uuid.UUID) -> Survey:
        res = await self._db.execute(select(Survey).where(Survey.id == survey_id))
        survey = res.scalar_one_or_none()
        if survey is None:
            raise HTTPException(404, "Survey not found")
        return survey

    async def get_public_survey(self, survey_id: uuid.UUID) -> Survey:
        """Raise HTTP 404/403 if the survey is not publicly accessible right now."""
        survey = await self.get_survey(survey_id)
        if not survey.is_published:
            raise HTTPException(404, "Survey not found or not published")
        now = datetime.now(timezone.utc)
        if survey.starts_at and now < survey.starts_at:
            raise HTTPException(403, "Survey has not started yet")
        if survey.ends_at and now > survey.ends_at:
            raise HTTPException(403, "Survey has ended")
        return survey

    # ──────────────────────────────────────────────────────────────────────────
    # Writes
    # ──────────────────────────────────────────────────────────────────────────

    async def create_survey(self, payload: SurveyCreate) -> Survey:
        survey = Survey(
            title=payload.title,
            description=payload.description,
            survey_json=payload.survey_json or {},
            is_published=False,
            version=1,
        )
        self._db.add(survey)
        await self._db.commit()
        await self._db.refresh(survey)
        return survey

    async def update_survey(self, survey_id: uuid.UUID, payload: SurveyUpdate) -> Survey:
        survey = await self.get_survey(survey_id)
        if payload.title is not None:
            survey.title = payload.title
        if payload.description is not None:
            survey.description = payload.description
        if payload.survey_json is not None:
            survey.survey_json = payload.survey_json
            survey.version += 1
        if payload.is_published is not None:
            survey.is_published = payload.is_published
        if payload.starts_at is not None:
            survey.starts_at = payload.starts_at
        if payload.ends_at is not None:
            survey.ends_at = payload.ends_at
        if payload.max_responses is not None:
            survey.max_responses = payload.max_responses
        if payload.allow_anonymous is not None:
            survey.allow_anonymous = payload.allow_anonymous
        await self._db.commit()
        await self._db.refresh(survey)
        return survey

    async def publish_survey(self, survey_id: uuid.UUID) -> Survey:
        survey = await self.get_survey(survey_id)
        survey.is_published = True
        if survey.published_at is None:
            survey.published_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(survey)
        return survey

    async def delete_survey(self, survey_id: uuid.UUID) -> None:
        await self.get_survey(survey_id)  # raises 404 if missing
        await self._db.execute(delete(Survey).where(Survey.id == survey_id))
        await self._db.commit()

    # ──────────────────────────────────────────────────────────────────────────
    # Statistics
    # ──────────────────────────────────────────────────────────────────────────

    async def get_stats(self, survey_id: uuid.UUID) -> dict:
        await self.get_survey(survey_id)  # raises 404 if missing

        sessions_res = await self._db.execute(
            select(SurveySession).where(SurveySession.survey_id == survey_id)
        )
        sessions = list(sessions_res.scalars().all())

        total = len(sessions)
        completed = sum(1 for s in sessions if s.is_completed)
        in_progress = total - completed
        completion_rate = completed / total if total else 0.0
        avg_progress = sum(s.progress_pct for s in sessions) / total if total else 0.0

        responses_by_question: dict = defaultdict(lambda: defaultdict(int))
        for s in sessions:
            for q_name, answer in (s.answers_json or {}).items():
                if isinstance(answer, list):
                    for item in answer:
                        responses_by_question[q_name][str(item)] += 1
                else:
                    responses_by_question[q_name][str(answer)] += 1

        return {
            "survey_id": survey_id,
            "total_sessions": total,
            "completed_sessions": completed,
            "in_progress_sessions": in_progress,
            "completion_rate": round(completion_rate, 4),
            "avg_progress_pct": round(avg_progress, 2),
            "responses_by_question": {k: dict(v) for k, v in responses_by_question.items()},
        }

    async def completed_response_count(self, survey_id: uuid.UUID) -> int:
        count_res = await self._db.execute(
            select(func.count()).where(
                SurveySession.survey_id == survey_id,
                SurveySession.is_completed == True,  # noqa: E712
            )
        )
        return count_res.scalar() or 0
