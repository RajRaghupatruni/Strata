// Mirrors backend/app/schemas/recommendation.py. Evaluation fields are read-only.
export type UserRecommendationStatus = "active" | "completed" | "superseded";
export type RecommendationStatus = UserRecommendationStatus | "effective" | "ineffective" | "inconclusive";

export type Recommendation = {
  id: number;
  coaching_report_id: number;
  code: string;
  category: string;
  title: string;
  action: string;
  evidence_summary: string;
  target_issue_category: string | null;
  target_metric: string | null;
  status: RecommendationStatus;
  active_at: string;
  created_at: string | null;
  completed_at: string | null;
  evaluated_at: string | null;
  evaluation_summary: Record<string, unknown> | null;
};

export type RecommendationListResponse = {
  total: number;
  recommendations: Recommendation[];
};

export type RecommendationUpdate = {
  status?: UserRecommendationStatus | null;
  completed_at?: string | null;
};
