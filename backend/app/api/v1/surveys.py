import uuid
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
import io
import csv
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from app.core.db import get_db
from app.models.survey import Survey
from app.models.session import SurveySession
from app.schemas.survey import SurveyCreate, SurveyOut, SurveyUpdate, SurveyStats
from app.schemas.session import SessionOut
from app.core.auth import has_role, get_current_active_user

router = APIRouter(prefix="/surveys")


@router.post("", response_model=SurveyOut)
async def create_survey(payload: SurveyCreate, db: AsyncSession = Depends(get_db), _=Depends(has_role("admin"))):
    survey = Survey(
        title=payload.title,
        description=payload.description,
        survey_json=payload.survey_json or {},
        is_published=False,
        version=1,
    )
    db.add(survey)
    await db.commit()
    await db.refresh(survey)
    return survey


@router.get("", response_model=list[SurveyOut])
async def list_surveys(db: AsyncSession = Depends(get_db), _=Depends(get_current_active_user)):
    res = await db.execute(select(Survey).order_by(Survey.created_at.desc()))
    return list(res.scalars().all())


@router.get("/{survey_id}", response_model=SurveyOut)
async def get_survey(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_active_user)):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    if not survey:
        raise HTTPException(404, "Survey not found")
    return survey


@router.put("/{survey_id}", response_model=SurveyOut)
async def update_survey(survey_id: uuid.UUID, payload: SurveyUpdate, db: AsyncSession = Depends(get_db), _=Depends(has_role("admin"))):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    if not survey:
        raise HTTPException(404, "Survey not found")

    if payload.title is not None:
        survey.title = payload.title
    if payload.description is not None:
        survey.description = payload.description
    if payload.survey_json is not None:
        survey.survey_json = payload.survey_json
        survey.version += 1
    if payload.is_published is not None:
        survey.is_published = payload.is_published
    # Conducting settings
    if payload.starts_at is not None:
        survey.starts_at = payload.starts_at
    if payload.ends_at is not None:
        survey.ends_at = payload.ends_at
    if payload.max_responses is not None:
        survey.max_responses = payload.max_responses
    if payload.allow_anonymous is not None:
        survey.allow_anonymous = payload.allow_anonymous

    await db.commit()
    await db.refresh(survey)
    return survey


@router.post("/{survey_id}/publish", response_model=SurveyOut)
async def publish_survey(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(has_role("admin"))):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    if not survey:
        raise HTTPException(404, "Survey not found")
    survey.is_published = True
    if survey.published_at is None:
        survey.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(survey)
    return survey


@router.delete("/{survey_id}", status_code=204)
async def delete_survey(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(has_role("admin"))):
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = res.scalar_one_or_none()
    if not survey:
        raise HTTPException(404, "Survey not found")
    await db.execute(delete(Survey).where(Survey.id == survey_id))
    await db.commit()
    return Response(status_code=204)


# ── ТР-7: Real-time aggregated statistics ─────────────────────────────────────

@router.get("/{survey_id}/stats", response_model=SurveyStats)
async def survey_stats(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_active_user)):
    """
    Returns aggregated statistics for a survey including session counts,
    completion rate, average progress, and per-question answer distributions.
    Available on both completed and in-progress sessions (ТР-7, ТР-9).
    """
    res = await db.execute(select(Survey).where(Survey.id == survey_id))
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Survey not found")

    sessions_res = await db.execute(
        select(SurveySession).where(SurveySession.survey_id == survey_id)
    )
    sessions = list(sessions_res.scalars().all())

    total = len(sessions)
    completed = sum(1 for s in sessions if s.is_completed)
    in_progress = total - completed
    completion_rate = completed / total if total else 0.0
    avg_progress = sum(s.progress_pct for s in sessions) / total if total else 0.0

    # ТР-9: per-question answer distribution across all sessions
    responses_by_question: dict = defaultdict(lambda: defaultdict(int))
    for s in sessions:
        for q_name, answer in (s.answers_json or {}).items():
            if isinstance(answer, list):
                for item in answer:
                    responses_by_question[q_name][str(item)] += 1
            else:
                responses_by_question[q_name][str(answer)] += 1

    return SurveyStats(
        survey_id=survey_id,
        total_sessions=total,
        completed_sessions=completed,
        in_progress_sessions=in_progress,
        completion_rate=round(completion_rate, 4),
        avg_progress_pct=round(avg_progress, 2),
        responses_by_question={k: dict(v) for k, v in responses_by_question.items()},
    )


# ── ТР-9: Sessions list with filtering ────────────────────────────────────────

@router.get("/{survey_id}/sessions", response_model=list[SessionOut])
async def list_sessions(
    survey_id: uuid.UUID,
    respondent_id: str | None = None,
    completed_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """
    List sessions for a survey with optional filters.
    respondent_id: filter to a specific respondent.
    completed_only: if true, return only completed sessions.
    """
    q = select(SurveySession).where(SurveySession.survey_id == survey_id)
    if respondent_id:
        q = q.where(SurveySession.respondent_id == respondent_id)
    if completed_only:
        q = q.where(SurveySession.is_completed == True)  # noqa: E712
    q = q.order_by(SurveySession.created_at.desc())
    res = await db.execute(q)
    return list(res.scalars().all())


# ── Legacy responses endpoint (kept for compatibility) ────────────────────────

@router.get("/{survey_id}/responses")
async def export_completed_responses(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(has_role("admin"))):
    res = await db.execute(
        select(SurveySession).where(
            (SurveySession.survey_id == survey_id) & (SurveySession.is_completed == True)  # noqa: E712
        ).order_by(SurveySession.created_at.desc())
    )
    sessions = list(res.scalars().all())
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


# ── ТР-10: Export with include_incomplete flag ────────────────────────────────

@router.get("/{survey_id}/export")
async def export_survey(
    survey_id: uuid.UUID,
    format: str = "json",
    anonymize: bool = False,
    include_incomplete: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role("admin")),
):
    """
    Export responses.  format: json | csv.
    anonymize=true  removes respondent_id.
    include_incomplete=true  includes sessions that are not yet completed (ТР-10).
    """
    q = select(SurveySession).where(SurveySession.survey_id == survey_id)
    if not include_incomplete:
        q = q.where(SurveySession.is_completed == True)  # noqa: E712
    q = q.order_by(SurveySession.created_at.desc())
    res = await db.execute(q)
    sessions = list(res.scalars().all())

    rows = []
    for s in sessions:
        row = {
            "response_id": str(s.id),
            "survey_id": str(s.survey_id),
            "respondent_id": None if anonymize else s.respondent_id,
            "is_completed": s.is_completed,
            "progress_pct": s.progress_pct,
            "started_at": s.created_at.isoformat() if s.created_at else None,
            "submitted_at": s.completed_at.isoformat() if s.completed_at else None,
            "answers": s.answers_json,
        }
        rows.append(row)

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["response_id", "survey_id", "respondent_id", "is_completed",
                         "progress_pct", "started_at", "submitted_at", "answers_json"])
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

    return rows
