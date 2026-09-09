from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


RecommendationStatus = Literal[
    "active",
    "completed",
    "effective",
    "ineffective",
    "inconclusive",
    "superseded",
]

UserRecommendationStatus = Literal["active", "completed", "superseded"]


class RecommendationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coaching_report_id: int
    code: str
    category: str
    title: str
    action: str
    evidence_summary: str
    target_issue_category: str | None = None
    target_metric: str | None = None
    status: RecommendationStatus
    active_at: datetime
    created_at: datetime | None = None
    completed_at: datetime | None = None
    evaluated_at: datetime | None = None
    evaluation_summary: dict[str, Any] | None = None


class RecommendationListResponse(BaseModel):
    total: int
    recommendations: list[RecommendationRead]


class RecommendationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: UserRecommendationStatus | None = None
    completed_at: datetime | None = None


class RecommendationProgressEvaluation(BaseModel):
    recommendation_id: int
    recommendation: str
    evaluation_metric: str
    before_sample_size: int
    after_sample_size: int
    before_value: float | None = None
    after_value: float | None = None
    delta: float | None = None
    evidence_level: str
    outcome: str
    explanation: str
    before_occurrences: int | None = None
    after_occurrences: int | None = None
    details: dict[str, Any] = Field(default_factory=dict)
