import type { MatchFilters, MatchListResponse } from "../../types/match";
import type { InsightsResponse } from "../../types/insights";
import type {
  RecurringIssuesResponse,
  ReviewNote,
  ReviewNoteInput,
  ReviewNotesResponse
} from "../../types/review";
import type {
  CoachingReport,
  ProCoachingBrief,
  CoachingReportsResponse,
  LatestCoachingResponse
} from "../../types/coach";
import type {
  LatestProgressResponse,
  ProgressSnapshot,
  ProgressSnapshotsResponse
} from "../../types/progress";
import type { UserProfile, UserProfileInput } from "../../types/settings";
import type { HomeSummary } from "../../types/home";

export type RiotImportPayload = {
  game_name: string;
  tag_line: string;
  region: string;
  max_matches: number;
};

export type RiotImportResult = {
  game_name: string;
  tag_line: string;
  region: string;
  player_puuid: string;
  total_fetched_match_ids: number;
  total_mapped_matches: number;
  inserted: number;
  skipped_duplicates: number;
};

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE_URL = configuredApiBaseUrl?.trim() || "http://127.0.0.1:8000/api/v1";

function withQuery(path: string, filters: MatchFilters): string {
  const params = new URLSearchParams();

  if (filters.map) params.set("map", filters.map);
  if (filters.agent) params.set("agent", filters.agent);
  if (filters.role) params.set("role", filters.role);
  if (filters.result) params.set("result", filters.result);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));

  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export async function fetchMatches(filters: MatchFilters = {}): Promise<MatchListResponse> {
  const url = withQuery(`${API_BASE_URL}/matches`, filters);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load matches (${response.status})`);
  }
  return (await response.json()) as MatchListResponse;
}

export async function fetchInsights(recentWindow = 10): Promise<InsightsResponse> {
  const response = await fetch(`${API_BASE_URL}/insights?recent_window=${recentWindow}`);
  if (!response.ok) {
    throw new Error(`Failed to load insights (${response.status})`);
  }
  return (await response.json()) as InsightsResponse;
}

export async function fetchReviewNotes(matchId?: number): Promise<ReviewNotesResponse> {
  const params = new URLSearchParams();
  if (matchId && matchId > 0) {
    params.set("match_id", String(matchId));
  }
  const response = await fetch(
    `${API_BASE_URL}/review/notes${params.toString() ? `?${params.toString()}` : ""}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load review notes (${response.status})`);
  }
  return (await response.json()) as ReviewNotesResponse;
}

export async function createReviewNote(input: ReviewNoteInput): Promise<ReviewNote> {
  const response = await fetch(`${API_BASE_URL}/review/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(`Failed to create review note (${response.status})`);
  }
  return (await response.json()) as ReviewNote;
}

export async function updateReviewNote(noteId: number, input: Partial<ReviewNoteInput>): Promise<ReviewNote> {
  const response = await fetch(`${API_BASE_URL}/review/notes/${noteId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(`Failed to update review note (${response.status})`);
  }
  return (await response.json()) as ReviewNote;
}

export async function deleteReviewNote(noteId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/review/notes/${noteId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to delete review note (${response.status})`);
  }
}

export async function fetchRecurringIssues(matchId?: number): Promise<RecurringIssuesResponse> {
  const params = new URLSearchParams();
  if (matchId && matchId > 0) {
    params.set("match_id", String(matchId));
  }
  const response = await fetch(
    `${API_BASE_URL}/review/issues/recurring${params.toString() ? `?${params.toString()}` : ""}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load recurring issues (${response.status})`);
  }
  return (await response.json()) as RecurringIssuesResponse;
}

export async function fetchLatestCoachingReport(): Promise<LatestCoachingResponse> {
  const response = await fetch(`${API_BASE_URL}/coach/latest`);
  if (!response.ok) {
    throw new Error(`Failed to load latest coaching report (${response.status})`);
  }
  return (await response.json()) as LatestCoachingResponse;
}

export async function generateCoachingReport(recentWindow = 10): Promise<CoachingReport> {
  const response = await fetch(`${API_BASE_URL}/coach/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ recent_window: recentWindow })
  });
  if (!response.ok) {
    throw new Error(`Failed to generate coaching report (${response.status})`);
  }
  return (await response.json()) as CoachingReport;
}

export async function fetchCoachingReports(limit = 10): Promise<CoachingReportsResponse> {
  const response = await fetch(`${API_BASE_URL}/coach/reports?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to load coaching reports (${response.status})`);
  }
  return (await response.json()) as CoachingReportsResponse;
}

export async function generateProCoachingBrief(
  recentWindow = 10,
  matchId?: number
): Promise<ProCoachingBrief> {
  const payload: { recent_window: number; match_id?: number } = {
    recent_window: recentWindow
  };
  if (matchId && matchId > 0) payload.match_id = matchId;

  const response = await fetch(`${API_BASE_URL}/coach/pro-brief`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    let detail = `Failed to generate pro coaching brief (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }
  return (await response.json()) as ProCoachingBrief;
}

export async function fetchLatestProgressSnapshot(): Promise<LatestProgressResponse> {
  const response = await fetch(`${API_BASE_URL}/progress/latest`);
  if (!response.ok) {
    throw new Error(`Failed to load latest progress snapshot (${response.status})`);
  }
  return (await response.json()) as LatestProgressResponse;
}

export async function generateProgressSnapshot(
  recentWindow = 10,
  previousWindow = 10
): Promise<ProgressSnapshot> {
  const response = await fetch(`${API_BASE_URL}/progress/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ recent_window: recentWindow, previous_window: previousWindow })
  });
  if (!response.ok) {
    throw new Error(`Failed to generate progress snapshot (${response.status})`);
  }
  return (await response.json()) as ProgressSnapshot;
}

export async function fetchProgressSnapshots(limit = 10): Promise<ProgressSnapshotsResponse> {
  const response = await fetch(`${API_BASE_URL}/progress?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to load progress snapshots (${response.status})`);
  }
  return (await response.json()) as ProgressSnapshotsResponse;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/settings/profile`);
  if (!response.ok) {
    throw new Error(`Failed to load user profile (${response.status})`);
  }
  return (await response.json()) as UserProfile;
}

export async function updateUserProfile(input: UserProfileInput): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/settings/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(`Failed to update user profile (${response.status})`);
  }
  return (await response.json()) as UserProfile;
}

export async function fetchHomeSummary(recentWindow = 10): Promise<HomeSummary> {
  const response = await fetch(`${API_BASE_URL}/home/summary?recent_window=${recentWindow}`);
  if (!response.ok) {
    throw new Error(`Failed to load home summary (${response.status})`);
  }
  return (await response.json()) as HomeSummary;
}

export async function importMatchesFromRiot(
  payload: RiotImportPayload
): Promise<RiotImportResult> {
  const response = await fetch(`${API_BASE_URL}/matches/import/riot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    let detail = `Riot import failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // keep default message
    }
    throw new Error(detail);
  }
  return (await response.json()) as RiotImportResult;
}
