export type MetricChange = {
  metric: string;
  recent: number | null;
  previous: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat";
};

export type IssueTrend = {
  category: string;
  recent_count: number;
  previous_count: number;
  delta: number;
  direction: "up" | "down" | "flat";
};

export type RecommendationEffectiveness = {
  evaluated: boolean;
  status: string;
  report_id: number | null;
  before_window_matches: number;
  after_window_matches: number;
  details: MetricChange[];
  note?: string | null;
};

export type ProgressSnapshot = {
  id: number;
  snapshot_date?: string | null;
  metric_window?: string | null;
  summary?: string | null;
  issue_trends: IssueTrend[];
  performance_change: MetricChange[];
  recommendation_effectiveness?: RecommendationEffectiveness | null;
};

export type LatestProgressResponse = {
  snapshot: ProgressSnapshot | null;
};

export type ProgressSnapshotsResponse = {
  total: number;
  snapshots: ProgressSnapshot[];
};

