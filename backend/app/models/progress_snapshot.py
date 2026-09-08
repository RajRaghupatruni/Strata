from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class ProgressSnapshot(Base):
    __tablename__ = "progress_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    snapshot_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    metric_window: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue_trends_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    performance_change_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation_effectiveness_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

