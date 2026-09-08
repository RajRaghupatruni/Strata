from pydantic import BaseModel, Field


class AggregateMetrics(BaseModel):
    matches: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    win_rate: float | None = None
    avg_acs: float | None = None
    avg_adr: float | None = None
    avg_kda: float | None = None
    avg_hs_percent: float | None = None
    avg_rr_change: float | None = None


class BreakdownEntry(AggregateMetrics):
    label: str


class MetricDelta(BaseModel):
    metric: str
    recent: float | None = None
    baseline: float | None = None
    delta: float | None = None
    direction: str = "flat"


class TrendSummary(BaseModel):
    recent_window: int
    baseline_window: int
    comparisons: list[MetricDelta] = Field(default_factory=list)


class StreakSummary(BaseModel):
    current_streak_type: str = "none"
    current_streak_length: int = 0
    longest_win_streak: int = 0
    longest_loss_streak: int = 0


class VolatilitySummary(BaseModel):
    acs_std_dev: float | None = None
    rr_std_dev: float | None = None
    result_switch_rate: float | None = None
    level: str = "insufficient_data"


class InsightsSummary(BaseModel):
    recent_form: AggregateMetrics
    baseline_form: AggregateMetrics
    trend_summary: TrendSummary
    streaks: StreakSummary
    volatility: VolatilitySummary
    map_breakdowns: list[BreakdownEntry] = Field(default_factory=list)
    agent_breakdowns: list[BreakdownEntry] = Field(default_factory=list)
    role_breakdowns: list[BreakdownEntry] = Field(default_factory=list)
