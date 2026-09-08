from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IssueTag(Base):
    __tablename__ = "issue_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    review_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("review_notes.id"), nullable=True
    )
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(80))
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    round_reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

