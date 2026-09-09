from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class IssueTag(Base):
    __tablename__ = "issue_tags"
    __table_args__ = (
        Index("ix_issue_tags_category_created", "category", "created_at"),
        Index("ix_issue_tags_match_category", "match_id", "category"),
        Index("ix_issue_tags_review_note_id", "review_note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    review_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("review_notes.id", ondelete="CASCADE"), nullable=True
    )
    match_id: Mapped[int | None] = mapped_column(
        ForeignKey("matches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(80))
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    round_reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
