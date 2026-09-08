export type PatternHighlight = {
  label: string;
  matches: number;
  win_rate: number | null;
};

export type CoachingHighlight = {
  report_id: number;
  generated_at?: string | null;
  priority_issue?: string | null;
  stop_doing?: string | null;
  keep_doing?: string | null;
  next_action?: string | null;
};

export type ProgressHighlight = {
  snapshot_id: number;
  snapshot_date?: string | null;
  summary?: string | null;
  effectiveness_status?: string | null;
};

export type HomeCounters = {
  total_matches: number;
  total_review_notes: number;
  total_coaching_reports: number;
  total_progress_snapshots: number;
};

export type HomeSummary = {
  generated_at: string;
  current_rank_context: string;
  recent_trend: string;
  strongest_map?: PatternHighlight | null;
  weakest_map?: PatternHighlight | null;
  strongest_agent?: PatternHighlight | null;
  weakest_agent?: PatternHighlight | null;
  current_focus_area?: string | null;
  next_review_suggestion?: string | null;
  coaching_summary?: CoachingHighlight | null;
  progress_highlight?: ProgressHighlight | null;
  counters: HomeCounters;
  quick_links: string[];
};

