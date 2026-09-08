export type IssueTag = {
  id: number;
  review_note_id?: number | null;
  match_id?: number | null;
  category: string;
  severity?: string | null;
  round_reference?: string | null;
  description?: string | null;
  created_at?: string | null;
};

export type IssueTagInput = {
  category: string;
  severity?: string;
  round_reference?: string;
  description?: string;
};

export type ReviewNote = {
  id: number;
  match_id?: number | null;
  note_type?: string | null;
  summary: string;
  full_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  issue_tags: IssueTag[];
};

export type ReviewNoteInput = {
  match_id?: number | null;
  note_type?: string;
  summary: string;
  full_note?: string;
  issue_tags: IssueTagInput[];
};

export type ReviewNotesResponse = {
  total: number;
  notes: ReviewNote[];
};

export type RecurringIssue = {
  category: string;
  occurrences: number;
  high_severity_occurrences: number;
  last_seen_at?: string | null;
};

export type RecurringIssuesResponse = {
  issues: RecurringIssue[];
};

