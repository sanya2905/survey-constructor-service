import uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, Boolean, DateTime, Integer, Float, func
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import UUIDPkMixin, TimestampMixin
from app.core.db import Base

class SurveySession(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "survey_sessions"

    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), index=True)

    respondent_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    answers_json: Mapped[dict] = mapped_column(JSONB, default=dict)

    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped["DateTime | None"] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Progress tracking (ТР-3, ТР-8) ───────────────────────────────────────
    current_page: Mapped[int] = mapped_column(Integer, default=0)
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0)
    last_saved_at: Mapped["DateTime | None"] = mapped_column(DateTime(timezone=True), nullable=True)

    def mark_completed(self) -> None:
        self.is_completed = True
        self.completed_at = func.now()