"""Survey version history: recording edits, listing, and restore."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.utils.survey_diff import build_change_summary, compute_changes_from_snapshot, compute_field_changes


def _editor_name(user: Any) -> str:
    return getattr(user, "username", None) or "Система"


def _editor_id(user: Any) -> uuid.UUID | None:
    user_id = getattr(user, "id", None)
    return user_id if isinstance(user_id, uuid.UUID) else None


def _snapshot_from_survey(survey: Survey) -> dict:
    return {
        "title": survey.title,
        "description": survey.description,
        "survey_json": survey.survey_json or {},
        "is_published": survey.is_published,
        "start_date": survey.start_date.isoformat() if survey.start_date else None,
        "end_date": survey.end_date.isoformat() if survey.end_date else None,
        "starts_at": survey.starts_at.isoformat() if survey.starts_at else None,
        "ends_at": survey.ends_at.isoformat() if survey.ends_at else None,
        "max_responses": survey.max_responses,
        "allow_anonymous": survey.allow_anonymous,
    }


class SurveyVersionService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_versions(self, survey_id: uuid.UUID) -> list[SurveyVersion]:
        res = await self._db.execute(
            select(SurveyVersion)
            .where(SurveyVersion.survey_id == survey_id)
            .order_by(SurveyVersion.version_number.desc(), SurveyVersion.created_at.desc())
        )
        versions = list(res.scalars().all())
        if not versions:
            survey_res = await self._db.execute(select(Survey).where(Survey.id == survey_id))
            survey = survey_res.scalar_one_or_none()
            if survey is not None:
                entry = await self._record_version(
                    survey,
                    changes={"action": "created"},
                    editor_name="Система",
                    editor_id=None,
                    version_number=survey.version,
                )
                await self._db.commit()
                versions = [entry]
        return versions

    async def get_version(self, survey_id: uuid.UUID, version_id: uuid.UUID) -> SurveyVersion:
        res = await self._db.execute(
            select(SurveyVersion).where(
                SurveyVersion.id == version_id,
                SurveyVersion.survey_id == survey_id,
            )
        )
        version = res.scalar_one_or_none()
        if version is None:
            raise HTTPException(404, "Version not found")
        return version

    async def record_created(self, survey: Survey, user: Any) -> SurveyVersion:
        return await self._record_version(
            survey,
            changes={"action": "created"},
            editor_name=_editor_name(user),
            editor_id=_editor_id(user),
            version_number=1,
        )

    async def record_update_after_apply(
        self,
        survey: Survey,
        changes: dict[str, Any],
        user: Any,
    ) -> SurveyVersion:
        survey.version += 1
        return await self._record_version(
            survey,
            changes=changes,
            editor_name=_editor_name(user),
            editor_id=_editor_id(user),
            version_number=survey.version,
        )

    async def record_published(self, survey: Survey, user: Any) -> SurveyVersion:
        last_res = await self._db.execute(
            select(SurveyVersion)
            .where(SurveyVersion.survey_id == survey.id)
            .order_by(SurveyVersion.version_number.desc(), SurveyVersion.created_at.desc())
            .limit(1)
        )
        last_version = last_res.scalar_one_or_none()
        current = _snapshot_from_survey(survey)
        if last_version and last_version.survey_json_snapshot:
            changes = compute_changes_from_snapshot(last_version.survey_json_snapshot, current)
        else:
            changes = {}
        changes["action"] = "published"
        survey.version += 1
        return await self._record_version(
            survey,
            changes=changes,
            editor_name=_editor_name(user),
            editor_id=_editor_id(user),
            version_number=survey.version,
        )

    async def restore_version(
        self,
        survey: Survey,
        version_id: uuid.UUID,
        user: Any,
    ) -> Survey:
        target = await self.get_version(survey.id, version_id)
        snapshot = target.survey_json_snapshot or {}
        if not snapshot:
            raise HTTPException(400, "Version snapshot is empty")

        if target.version_number == survey.version:
            raise HTTPException(400, "Cannot restore the current version")

        if "title" in snapshot:
            survey.title = snapshot["title"]
        if "description" in snapshot:
            survey.description = snapshot["description"]
        if "survey_json" in snapshot:
            survey.survey_json = snapshot["survey_json"]
        if "start_date" in snapshot:
            survey.start_date = _parse_dt(snapshot.get("start_date"))
        if "end_date" in snapshot:
            survey.end_date = _parse_dt(snapshot.get("end_date"))
        if "starts_at" in snapshot:
            survey.starts_at = _parse_dt(snapshot.get("starts_at"))
        if "ends_at" in snapshot:
            survey.ends_at = _parse_dt(snapshot.get("ends_at"))
        if "max_responses" in snapshot:
            survey.max_responses = snapshot.get("max_responses")
        if "allow_anonymous" in snapshot:
            survey.allow_anonymous = bool(snapshot.get("allow_anonymous", True))

        survey.version += 1
        await self._record_version(
            survey,
            changes={
                "action": "restored",
                "from_version": target.version_number,
            },
            editor_name=_editor_name(user),
            editor_id=_editor_id(user),
            version_number=survey.version,
        )
        await self._db.commit()
        await self._db.refresh(survey)
        return survey

    async def _record_version(
        self,
        survey: Survey,
        *,
        changes: dict[str, Any],
        editor_name: str,
        editor_id: uuid.UUID | None,
        version_number: int,
    ) -> SurveyVersion:
        entry = SurveyVersion(
            survey_id=survey.id,
            version_number=version_number,
            edited_by_id=editor_id,
            edited_by_name=editor_name,
            change_summary=build_change_summary(changes),
            changes=changes,
            survey_json_snapshot=_snapshot_from_survey(survey),
        )
        self._db.add(entry)
        await self._db.flush()
        return entry


def _parse_dt(value: Any):
    from datetime import datetime

    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None
