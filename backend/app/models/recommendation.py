from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.models.base import Base


json_type = JSON().with_variant(JSONB(), "postgresql")


RECOMMENDATION_STATUSES = (
    "active",
    "completed",
    "effective",
    "ineffective",
    "inconclusive",
    "superseded",
)


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        CheckConstraint(
            "status in ('active', 'completed', 'effective', 'ineffective', 'inconclusive', 'superseded')",
            name="ck_recommendations_status",
        ),
        Index("ix_recommendations_report_id", "coaching_report_id"),
        Index("ix_recommendations_status_active_at", "status", "active_at"),
        Index("ix_recommendations_target_issue", "target_issue_category"),
        Index("ix_recommendations_target_metric", "target_metric"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coaching_report_id: Mapped[int] = mapped_column(
        ForeignKey("coaching_reports.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_summary: Mapped[str] = mapped_column(Text, nullable=False)
    target_issue_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    target_metric: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evaluation_summary_json: Mapped[dict | None] = mapped_column(json_type, nullable=True)
