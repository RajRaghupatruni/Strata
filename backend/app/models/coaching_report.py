from datetime import datetime

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CoachingReport(Base):
    __tablename__ = "coaching_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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
    supporting_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)

