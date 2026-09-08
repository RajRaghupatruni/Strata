from datetime import datetime

from pydantic import BaseModel, Field


class PatternHighlight(BaseModel):
    label: str
    matches: int = 0
    win_rate: float | None = None


class CoachingHighlight(BaseModel):
    report_id: int
    generated_at: datetime | None = None
    priority_issue: str | None = None
    stop_doing: str | None = None
    keep_doing: str | None = None
    next_action: str | None = None


class ProgressHighlight(BaseModel):
    snapshot_id: int
    snapshot_date: datetime | None = None
    summary: str | None = None
    effectiveness_status: str | None = None


class HomeCounters(BaseModel):
    total_matches: int = 0
    total_review_notes: int = 0
    total_coaching_reports: int = 0
    total_progress_snapshots: int = 0


class HomeSummaryRead(BaseModel):
    generated_at: datetime
    current_rank_context: str
    recent_trend: str
    strongest_map: PatternHighlight | None = None
    weakest_map: PatternHighlight | None = None
    strongest_agent: PatternHighlight | None = None
    weakest_agent: PatternHighlight | None = None
    current_focus_area: str | None = None
    next_review_suggestion: str | None = None
    coaching_summary: CoachingHighlight | None = None
    progress_highlight: ProgressHighlight | None = None
    counters: HomeCounters
    quick_links: list[str] = Field(default_factory=list)

