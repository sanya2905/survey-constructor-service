import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
import io
import csv
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.core.db import get_db
from app.models.survey import Survey
from app.models.session import SurveySession
from app.schemas.survey import SurveyCreate, SurveyOut, SurveyUpdate
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
        survey.version += 1  # простейшее версионирование
    if payload.is_published is not None:
        survey.is_published = payload.is_published

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

@router.get("/{survey_id}/responses")
async def export_completed_responses(survey_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(has_role("admin"))):
    # Для АРМ: только завершенные сессии
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


@router.get("/{survey_id}/export")
async def export_survey(
    survey_id: uuid.UUID,
    format: str = "json",
    anonymize: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(has_role("admin")),
):
    """Export completed responses. `format` can be `json` or `csv`.
    If `anonymize=true`, respondent identifiers will be removed (set to null).
    """
    res = await db.execute(
        select(SurveySession).where((SurveySession.survey_id == survey_id) & (SurveySession.is_completed == True)).order_by(SurveySession.created_at.desc())
    )
    sessions = list(res.scalars().all())

    rows = []
    for s in sessions:
        row = {
            "response_id": str(s.id),
            "survey_id": str(s.survey_id),
            "respondent_id": None if anonymize else s.respondent_id,
            "submitted_at": s.completed_at.isoformat() if s.completed_at else None,
            "answers": s.answers_json,
        }
        rows.append(row)

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["response_id", "survey_id", "respondent_id", "submitted_at", "answers_json"])
        for r in rows:
            writer.writerow([r["response_id"], r["survey_id"], r["respondent_id"], r["submitted_at"], json.dumps(r["answers"])])
        buf.seek(0)
        return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=survey_{survey_id}_responses.csv"})

    # default: json
    return rows