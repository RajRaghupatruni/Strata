from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.models.base import Base


json_type = JSON().with_variant(JSONB(), "postgresql")


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("external_match_id", name="uq_matches_external_match_id"),
        Index("ix_matches_played_at_id", "played_at", "id"),
        Index("ix_matches_session_id", "session_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_match_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    map_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    agent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    scoreline: Mapped[str | None] = mapped_column(String(20), nullable=True)
    kills: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deaths: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assists: Mapped[int | None] = mapped_column(Integer, nullable=True)
    adr: Mapped[float | None] = mapped_column(Float, nullable=True)
    acs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hs_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    rr_change: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rank_at_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(json_type, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
