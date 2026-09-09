from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.models.base import Base


json_type = JSON().with_variant(JSONB(), "postgresql")


class CoachingReport(Base):
    __tablename__ = "coaching_reports"
    __table_args__ = (Index("ix_coaching_reports_generated_at_id", "generated_at", "id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    time_window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    priority_issue: Mapped[str | None] = mapped_column(Text, nullable=True)
    stop_doing: Mapped[str | None] = mapped_column(Text, nullable=True)
    keep_doing: Mapped[str | None] = mapped_column(Text, nullable=True)
    improve_next: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_session_focus: Mapped[str | None] = mapped_column(Text, nullable=True)
    weekly_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    supporting_data_json: Mapped[dict | None] = mapped_column(json_type, nullable=True)
