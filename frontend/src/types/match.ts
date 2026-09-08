export type Match = {
  id: number;
  external_match_id?: string | null;
  played_at?: string | null;
  map_name?: string | null;
  mode?: string | null;
  agent?: string | null;
  role?: string | null;
  result?: string | null;
  scoreline?: string | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  adr?: number | null;
  acs?: number | null;
  hs_percent?: number | null;
  rr_change?: number | null;
  rank_at_time?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown> | null;
  review_note_count?: number | null;
};

export type MatchFilters = {
  map?: string;
  agent?: string;
  role?: string;
  result?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
};

export type MatchListResponse = {
  total: number;
  matches: Match[];
};
