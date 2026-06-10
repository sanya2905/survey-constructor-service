"""Survey domain service.

Encapsulates all business rules and database access for surveys so that
route handlers stay thin HTTP adapters with no direct ORM calls.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import SurveySession
from app.models.survey import Survey
from app.schemas.survey import SurveyCreate, SurveyUpdate
from app.services.survey_version_service import SurveyVersionService
from app.utils.survey_diff import compute_field_changes

_CONDUCTING_FIELDS = frozenset({
    "start_date",
    "end_date",
    "starts_at",
    "ends_at",
    "max_responses",
    "allow_anonymous",
})


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

        # Keep compatibility with both old (starts_at/ends_at) and new
        # (start_date/end_date) field names used by clients.
        start_candidates = [dt for dt in (survey.starts_at, survey.start_date) if dt is not None]
        end_candidates = [dt for dt in (survey.ends_at, survey.end_date) if dt is not None]

        if start_candidates and now < max(start_candidates):
            raise HTTPException(403, "Survey has not started yet")
        if end_candidates and now > min(end_candidates):
            raise HTTPException(403, "Survey has ended")
        return survey

    # ──────────────────────────────────────────────────────────────────────────
    # Writes
    # ──────────────────────────────────────────────────────────────────────────

    async def create_survey(self, payload: SurveyCreate, user: Any = None) -> Survey:
        survey = Survey(
            title=payload.title,
            description=payload.description,
            survey_json=payload.survey_json or {},
            is_published=False,
            version=1,
            start_date=payload.start_date,
            end_date=payload.end_date,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            max_responses=payload.max_responses,
            allow_anonymous=payload.allow_anonymous if payload.allow_anonymous is not None else True,
        )
        self._db.add(survey)
        await self._db.flush()
        if user is not None:
            await SurveyVersionService(self._db).record_created(survey, user)
        await self._db.commit()
        await self._db.refresh(survey)
        return survey

    async def update_survey(
        self,
        survey_id: uuid.UUID,
        payload: SurveyUpdate,
        user: Any = None,
    ) -> Survey:
        survey = await self.get_survey(survey_id)
        payload_fields: dict[str, Any] = {}
        if payload.title is not None:
            payload_fields["title"] = payload.title
        if payload.description is not None:
            payload_fields["description"] = payload.description
        if payload.survey_json is not None:
            payload_fields["survey_json"] = payload.survey_json
        if payload.is_published is not None:
            payload_fields["is_published"] = payload.is_published
        if "start_date" in payload.model_fields_set:
            payload_fields["start_date"] = payload.start_date
        if "end_date" in payload.model_fields_set:
            payload_fields["end_date"] = payload.end_date
        if "starts_at" in payload.model_fields_set:
            payload_fields["starts_at"] = payload.starts_at
        if "ends_at" in payload.model_fields_set:
            payload_fields["ends_at"] = payload.ends_at
        if "max_responses" in payload.model_fields_set:
            payload_fields["max_responses"] = payload.max_responses
        if "allow_anonymous" in payload.model_fields_set:
            payload_fields["allow_anonymous"] = payload.allow_anonymous

        changes = compute_field_changes(
            title=survey.title,
            description=survey.description,
            survey_json=survey.survey_json or {},
            is_published=survey.is_published,
            start_date=survey.start_date,
            end_date=survey.end_date,
            starts_at=survey.starts_at,
            ends_at=survey.ends_at,
            max_responses=survey.max_responses,
            allow_anonymous=survey.allow_anonymous,
            payload=payload_fields,
        )
        conducting_update = bool(payload.model_fields_set & _CONDUCTING_FIELDS)

        if payload.title is not None:
            survey.title = payload.title
        if payload.description is not None:
            survey.description = payload.description
        if payload.survey_json is not None:
            survey.survey_json = payload.survey_json
        if payload.is_published is not None:
            survey.is_published = payload.is_published
        if "start_date" in payload.model_fields_set:
            survey.start_date = payload.start_date
        if "end_date" in payload.model_fields_set:
            survey.end_date = payload.end_date
        if "starts_at" in payload.model_fields_set:
            survey.starts_at = payload.starts_at
        if "ends_at" in payload.model_fields_set:
            survey.ends_at = payload.ends_at
        if "max_responses" in payload.model_fields_set:
            survey.max_responses = payload.max_responses
        if "allow_anonymous" in payload.model_fields_set:
            survey.allow_anonymous = payload.allow_anonymous

        if user is not None and changes and conducting_update:
            await SurveyVersionService(self._db).record_update_after_apply(survey, changes, user)
        await self._db.commit()
        await self._db.refresh(survey)
        return survey

    async def publish_survey(self, survey_id: uuid.UUID, user: Any = None) -> Survey:
        survey = await self.get_survey(survey_id)
        survey.is_published = True
        if survey.published_at is None:
            survey.published_at = datetime.now(timezone.utc)
        if user is not None:
            await SurveyVersionService(self._db).record_published(survey, user)
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
