from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.recommendation import RecommendationRead


class CoachingReportRead(BaseModel):
    id: int
    generated_at: datetime | None = None
    time_window_start: datetime | None = None
    time_window_end: datetime | None = None
    priority_issue: str | None = None
    stop_doing: str | None = None
    keep_doing: str | None = None
    improve_next: str | None = None
    next_session_focus: str | None = None
    weekly_plan: str | None = None
    supporting_data: dict[str, Any] | None = None
    recommendations: list[RecommendationRead] = Field(default_factory=list)


class CoachingGenerateRequest(BaseModel):
    recent_window: int = Field(default=10, ge=3, le=50)


class LatestCoachingResponse(BaseModel):
    report: CoachingReportRead | None = None


class CoachingReportListResponse(BaseModel):
    total: int
    reports: list[CoachingReportRead]


class ProCoachingRequest(BaseModel):
    recent_window: int = Field(default=10, ge=3, le=50)
    match_id: int | None = Field(default=None, ge=1)


class ProGameBreakdown(BaseModel):
    match_id: int
    summary: str
    did_well: list[str]
    cost_you_rounds: list[str]
    fix_next_time: list[str]


class ProCoachingResponse(BaseModel):
    generated_at: datetime
    recent_window: int
    profile_focus: str
    best_role_fit: str
    what_you_do_well: list[str]
    what_is_holding_you_back: list[str]
    harsh_truths: list[str]
    priority_improvements: list[str]
    next_match_plan: list[str]
    weekly_program: list[str]
    evidence_points: list[str]
    specific_game_breakdown: ProGameBreakdown | None = None
