import uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import UUIDPkMixin, TimestampMixin
from app.core.db import Base

class Survey(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "surveys"

    title: Mapped[str] = mapped_column(String(200), default="Новая анкета")
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # JSON SurveyJS schema
    survey_json: Mapped[dict] = mapped_column(JSONB, default=dict)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    published_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Conducting settings (ТР-2, ТР-5, ТР-6) ──────────────────────────────
    starts_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_responses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    allow_anonymous: Mapped[bool] = mapped_column(Boolean, default=True)