export type AggregateMetrics = {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;
  avg_acs: number | null;
  avg_adr: number | null;
  avg_kda: number | null;
  avg_hs_percent: number | null;
  avg_rr_change: number | null;
};

export type BreakdownEntry = AggregateMetrics & {
  label: string;
};

export type MetricDelta = {
  metric: string;
  recent: number | null;
  baseline: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat";
};

export type TrendSummary = {
  recent_window: number;
  baseline_window: number;
  comparisons: MetricDelta[];
};

export type StreakSummary = {
  current_streak_type: string;
  current_streak_length: number;
  longest_win_streak: number;
  longest_loss_streak: number;
};

export type VolatilitySummary = {
  acs_std_dev: number | null;
  rr_std_dev: number | null;
  result_switch_rate: number | null;
  level: string;
};

export type InsightsResponse = {
  recent_form: AggregateMetrics;
  baseline_form: AggregateMetrics;
  trend_summary: TrendSummary;
  streaks: StreakSummary;
  volatility: VolatilitySummary;
  map_breakdowns: BreakdownEntry[];
  agent_breakdowns: BreakdownEntry[];
  role_breakdowns: BreakdownEntry[];
};

