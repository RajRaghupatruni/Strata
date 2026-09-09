from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.models.base import Base


json_type = JSON().with_variant(JSONB(), "postgresql")


class ProgressSnapshot(Base):
    __tablename__ = "progress_snapshots"
    __table_args__ = (Index("ix_progress_snapshots_snapshot_date_id", "snapshot_date", "id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    metric_window: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue_trends_json: Mapped[list | None] = mapped_column(json_type, nullable=True)
    performance_change_json: Mapped[list | None] = mapped_column(json_type, nullable=True)
    recommendation_effectiveness_json: Mapped[dict | None] = mapped_column(json_type, nullable=True)
