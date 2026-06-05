"""Survey management endpoints.

All business logic lives in SurveyService / SessionService.
Route handlers are intentionally thin: they only parse HTTP concerns
(path params, auth, response format) and delegate to the service layer.
"""

import io
import csv
import json
import uuid

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.auth import has_role, get_current_active_user
from app.schemas.survey import SurveyCreate, SurveyOut, SurveyUpdate, SurveyStats
from app.schemas.survey_version import SurveyVersionDetailOut, SurveyVersionOut
from app.schemas.session import SessionOut
from app.services.survey_service import SurveyService
from app.services.session_service import SessionService
from app.services.survey_version_service import SurveyVersionService

router = APIRouter(prefix="/surveys")


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("", response_model=SurveyOut)
async def create_survey(
    payload: SurveyCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(has_role("admin")),
):
    return await SurveyService(db).create_survey(payload, user=current_user)


@router.get("", response_model=list[SurveyOut])
async def list_surveys(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    return await SurveyService(db).list_surveys()


@router.get("/{survey_id}", response_model=SurveyOut)
async def get_survey(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    return await SurveyService(db).get_survey(survey_id)


@router.put("/{survey_id}", response_model=SurveyOut)
async def update_survey(
    survey_id: uuid.UUID,
    payload: SurveyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(has_role("admin")),
):
    return await SurveyService(db).update_survey(survey_id, payload, user=current_user)


@router.post("/{survey_id}/publish", response_model=SurveyOut)
async def publish_survey(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(has_role("admin")),
):
    return await SurveyService(db).publish_survey(survey_id, user=current_user)


# ── Version history ───────────────────────────────────────────────────────────

@router.get("/{survey_id}/versions", response_model=list[SurveyVersionOut])
async def list_survey_versions(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    await SurveyService(db).get_survey(survey_id)
    return await SurveyVersionService(db).list_versions(survey_id)


@router.get("/{survey_id}/versions/{version_id}", response_model=SurveyVersionDetailOut)
async def get_survey_version(
    survey_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    return await SurveyVersionService(db).get_version(survey_id, version_id)


@router.post("/{survey_id}/versions/{version_id}/restore", response_model=SurveyOut)
async def restore_survey_version(
    survey_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(has_role("admin")),
):
    survey = await SurveyService(db).get_survey(survey_id)
    return await SurveyVersionService(db).restore_version(survey, version_id, current_user)


@router.delete("/{survey_id}", status_code=204)
async def delete_survey(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role("admin")),
):
    await SurveyService(db).delete_survey(survey_id)
    return Response(status_code=204)


# ── Statistics (ТР-7) ─────────────────────────────────────────────────────────

@router.get("/{survey_id}/stats", response_model=SurveyStats)
async def survey_stats(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Aggregated statistics: session counts, completion rate, per-question distributions (ТР-7, ТР-9)."""
    stats = await SurveyService(db).get_stats(survey_id)
    return SurveyStats(**stats)


# ── Sessions list (ТР-9) ──────────────────────────────────────────────────────

@router.get("/{survey_id}/sessions", response_model=list[SessionOut])
async def list_sessions(
    survey_id: uuid.UUID,
    respondent_id: str | None = None,
    completed_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """List sessions with optional respondent / completion filters."""
    return await SessionService(db).list_sessions(survey_id, respondent_id, completed_only)


# ── Legacy responses endpoint (kept for compatibility) ────────────────────────

@router.get("/{survey_id}/responses")
async def export_completed_responses(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role("admin")),
):
    sessions = await SessionService(db).list_sessions(survey_id, completed_only=True)
    return [
        {
            "response_id": str(s.id),
            "survey_id": str(s.survey_id),
            "respondent_id": s.respondent_id,
            "submitted_at": s.completed_at,
            "answers": s.answers_json,
        }
        for s in sessions
    ]


# ── Export (ТР-10) ────────────────────────────────────────────────────────────

@router.get("/{survey_id}/export")
async def export_survey(
    survey_id: uuid.UUID,
    format: str = "json",
    anonymize: bool = False,
    include_incomplete: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role("admin")),
):
    """Export responses as JSON or CSV.

    anonymize=true removes respondent_id.
    include_incomplete=true includes in-progress sessions (ТР-10).
    """
    sessions = await SessionService(db).list_sessions(
        survey_id,
        completed_only=not include_incomplete,
    )

    rows = [
        {
            "response_id": str(s.id),
            "survey_id": str(s.survey_id),
            "respondent_id": None if anonymize else s.respondent_id,
            "is_completed": s.is_completed,
            "progress_pct": s.progress_pct,
            "started_at": s.created_at.isoformat() if s.created_at else None,
            "submitted_at": s.completed_at.isoformat() if s.completed_at else None,
            "answers": s.answers_json,
        }
        for s in sessions
    ]

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "response_id", "survey_id", "respondent_id", "is_completed",
            "progress_pct", "started_at", "submitted_at", "answers_json",
        ])
        for r in rows:
            writer.writerow([
                r["response_id"], r["survey_id"], r["respondent_id"],
                r["is_completed"], r["progress_pct"],
                r["started_at"], r["submitted_at"], json.dumps(r["answers"]),
            ])
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=survey_{survey_id}_responses.csv"},
        )

    content = json.dumps(rows, ensure_ascii=False, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=survey_{survey_id}_responses.json"},
    )
