export type MetricChange = {
  metric: string;
  recent: number | null;
  previous: number | null;
  delta: number | null;
  direction: string;
};

export type IssueTrend = {
  category: string;
  recent_count: number;
  previous_count: number;
  delta: number;
  direction: string;
};

export type RecommendationEffectiveness = {
  recommendation_id: number | null;
  recommendation: string;
  evaluation_metric: string;
  before_sample_size: number;
  after_sample_size: number;
  before_value: number | null;
  after_value: number | null;
  delta: number | null;
  // Backend fields are strings, not enums; presentation handles known values.
  evidence_level: string;
  outcome: string;
  explanation: string;
  before_occurrences: number | null;
  after_occurrences: number | null;
  details: unknown;
  status: string | null;
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
