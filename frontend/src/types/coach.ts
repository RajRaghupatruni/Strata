export type CoachingReport = {
  id: number;
  generated_at?: string | null;
  time_window_start?: string | null;
  time_window_end?: string | null;
  priority_issue?: string | null;
  stop_doing?: string | null;
  keep_doing?: string | null;
  improve_next?: string | null;
  next_session_focus?: string | null;
  weekly_plan?: string | null;
  supporting_data?: Record<string, unknown> | null;
};

export type LatestCoachingResponse = {
  report: CoachingReport | null;
};

export type CoachingReportsResponse = {
  total: number;
  reports: CoachingReport[];
};

export type ProGameBreakdown = {
  match_id: number;
  summary: string;
  did_well: string[];
  cost_you_rounds: string[];
  fix_next_time: string[];
};

export type ProCoachingBrief = {
  generated_at: string;
  recent_window: number;
  profile_focus: string;
  best_role_fit: string;
  what_you_do_well: string[];
  what_is_holding_you_back: string[];
  harsh_truths: string[];
  priority_improvements: string[];
  next_match_plan: string[];
  weekly_program: string[];
  evidence_points: string[];
  specific_game_breakdown?: ProGameBreakdown | null;
};
