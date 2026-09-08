from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MetricChange(BaseModel):
    metric: str
    recent: float | None = None
    previous: float | None = None
    delta: float | None = None
    direction: str = "flat"


class IssueTrend(BaseModel):
    category: str
    recent_count: int
    previous_count: int
    delta: int
    direction: str


class RecommendationEffectiveness(BaseModel):
    evaluated: bool = False
    status: str = "insufficient_data"
    report_id: int | None = None
    before_window_matches: int = 0
    after_window_matches: int = 0
    details: list[MetricChange] = Field(default_factory=list)
    note: str | None = None


class ProgressSnapshotRead(BaseModel):
    id: int
    snapshot_date: datetime | None = None
    metric_window: str | None = None
    summary: str | None = None
    issue_trends: list[IssueTrend] = Field(default_factory=list)
    performance_change: list[MetricChange] = Field(default_factory=list)
    recommendation_effectiveness: RecommendationEffectiveness | None = None


class ProgressGenerateRequest(BaseModel):
    recent_window: int = Field(default=10, ge=3, le=50)
    previous_window: int = Field(default=10, ge=3, le=50)


class ProgressSnapshotListResponse(BaseModel):
    total: int
    snapshots: list[ProgressSnapshotRead]


class LatestProgressResponse(BaseModel):
    snapshot: ProgressSnapshotRead | None = None


class ProgressSummaryResponse(BaseModel):
    # Lightweight summary endpoint payload if we need quick cards in future.
    latest_snapshot_id: int | None = None
    latest_summary: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)
