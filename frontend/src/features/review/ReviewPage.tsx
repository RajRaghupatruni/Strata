import { FormEvent, useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import {
  createReviewNote,
  deleteReviewNote,
  fetchMatches,
  fetchRecurringIssues,
  fetchReviewNotes,
  updateReviewNote
} from "../../services/api/client";
import type { Match } from "../../types/match";
import type { IssueTagInput, RecurringIssue, ReviewNote } from "../../types/review";

type ReviewFormState = {
  matchId: string;
  noteType: string;
  summary: string;
  fullNote: string;
  issueTags: IssueTagInput[];
};

const noteTypes = ["post_match", "vod_review", "session_reflection", "other"];
const severityOptions = ["", "low", "medium", "high", "critical"];
const suggestedTags = ["first death", "utility timing", "spacing", "trade discipline", "post-plant", "retake path"];

const emptyTagDraft: IssueTagInput = {
  category: "",
  severity: "",
  round_reference: "",
  description: ""
};

const emptyForm: ReviewFormState = {
  matchId: "",
  noteType: "post_match",
  summary: "",
  fullNote: "",
  issueTags: []
};

function formatDate(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function matchLabel(match: Match): string {
  const played = formatDate(match.played_at);
  return `#${match.id} | ${match.map_name ?? "Unknown map"} | ${match.agent ?? "Unknown agent"} | ${played}`;
}

function parseMatchId(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function humanize(value?: string | null): string {
  if (!value) return "N/A";
  return value.replace(/_/g, " ");
}

function severityClass(severity?: string | null): string {
  if (severity === "critical" || severity === "high") return "chip-negative";
  if (severity === "medium") return "chip-accent";
  if (severity === "low") return "chip-positive";
  return "";
}

function MatchContext({ match }: { match?: Match }) {
  if (!match) {
    return (
      <div className="surface panel-padding">
        <p className="eyebrow">Match context</p>
        <h2 className="section-title mt-3">All reviews</h2>
        <p className="section-copy">Pick a match when you want the review to inherit map, agent, score, and session context.</p>
      </div>
    );
  }

  return (
    <div className="surface panel-padding">
      <p className="eyebrow">Match context</p>
      <h2 className="section-title mt-3">{match.map_name ?? "Unknown map"} with {match.agent ?? "unknown agent"}</h2>
      <p className="section-copy">{formatDate(match.played_at)}</p>
      <div className="mt-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <div className="surface-subtle p-3">
          <p className="label">Result</p>
          <p className="metric-value text-xl">{humanize(match.result)}</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">KDA</p>
          <p className="metric-value text-xl">{match.kills ?? "-"} / {match.deaths ?? "-"} / {match.assists ?? "-"}</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">Reviews</p>
          <p className="metric-value text-xl">{match.review_note_count ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

function IssueSummary({ issues }: { issues: RecurringIssue[] }) {
  return (
    <div className="surface panel-padding">
      <p className="eyebrow">Recurring issues</p>
      <h2 className="section-title mt-3">Patterns worth breaking</h2>
      <div className="mt-5 data-list">
        {issues.length === 0 && (
          <StatePanel
            variant="empty"
            title="No repeated issue tags yet"
            description="Tag a few reviews and this panel becomes the evidence source for coaching priority."
          />
        )}
        {issues.map((issue) => (
          <article key={issue.category} className="data-row p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-[var(--text)]">{humanize(issue.category)}</p>
                <p className="section-copy">Last seen {formatDate(issue.last_seen_at)}</p>
              </div>
              <div className="text-right">
                <p className="metric-value text-2xl">{issue.occurrences}</p>
                <p className="label">occurrences</p>
              </div>
            </div>
            <div className="mt-3 progress-track" aria-label={`${issue.high_severity_occurrences} high severity occurrences`}>
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, (issue.high_severity_occurrences / Math.max(1, issue.occurrences)) * 100)}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [recurringIssues, setRecurringIssues] = useState<RecurringIssue[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filterMatchId, setFilterMatchId] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [form, setForm] = useState<ReviewFormState>(emptyForm);
  const [tagDraft, setTagDraft] = useState<IssueTagInput>(emptyTagDraft);

  const selectedMatchId = useMemo(() => parseMatchId(filterMatchId), [filterMatchId]);
  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  async function loadData(matchId?: number) {
    setLoading(true);
    setError(null);
    try {
      const [notesData, recurringData] = await Promise.all([
        fetchReviewNotes(matchId),
        fetchRecurringIssues(matchId)
      ]);
      setNotes(notesData.notes);
      setRecurringIssues(recurringData.issues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadMatches() {
    try {
      const data = await fetchMatches({ limit: 200 });
      setMatches(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches for picker");
    }
  }

  useEffect(() => {
    void loadMatches();
    void loadData();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setTagDraft(emptyTagDraft);
    setEditingNoteId(null);
  }

  function addTagFromDraft() {
    if (!tagDraft.category || tagDraft.category.trim() === "") return;
    setForm((prev) => ({
      ...prev,
      issueTags: [
        ...prev.issueTags,
        {
          category: tagDraft.category.trim(),
          severity: tagDraft.severity?.trim() || undefined,
          round_reference: tagDraft.round_reference?.trim() || undefined,
          description: tagDraft.description?.trim() || undefined
        }
      ]
    }));
    setTagDraft(emptyTagDraft);
  }

  function addSuggestedTag(category: string) {
    setTagDraft((prev) => ({ ...prev, category }));
  }

  function removeTag(index: number) {
    setForm((prev) => ({
      ...prev,
      issueTags: prev.issueTags.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.summary.trim()) {
      setError("Summary is required.");
      return;
    }

    const payload = {
      match_id: parseMatchId(form.matchId) ?? null,
      note_type: form.noteType || "post_match",
      summary: form.summary.trim(),
      full_note: form.fullNote.trim() || "",
      issue_tags: form.issueTags
    };

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingNoteId) {
        await updateReviewNote(editingNoteId, payload);
        setSuccess("Review note updated.");
      } else {
        await createReviewNote(payload);
        setSuccess("Review note saved.");
      }
      resetForm();
      await loadData(selectedMatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(note: ReviewNote) {
    setEditingNoteId(note.id);
    setForm({
      matchId: note.match_id ? String(note.match_id) : "",
      noteType: note.note_type ?? "post_match",
      summary: note.summary,
      fullNote: note.full_note ?? "",
      issueTags: note.issue_tags.map((tag) => ({
        category: tag.category,
        severity: tag.severity ?? "",
        round_reference: tag.round_reference ?? "",
        description: tag.description ?? ""
      }))
    });
    setTagDraft(emptyTagDraft);
  }

  async function handleDelete(noteId: number) {
    if (!window.confirm("Delete this review note?")) return;
    setError(null);
    setSuccess(null);
    try {
      await deleteReviewNote(noteId);
      setSuccess("Review note deleted.");
      await loadData(selectedMatchId);
      if (editingNoteId === noteId) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Review workflow"
        title="Review"
        description="Turn raw match history into reusable coaching evidence: notes, mistakes, strengths, and issue tags."
      />

      <div className="control-bar">
        <label className="field-label min-w-[280px] flex-1">
          Match filter
          <select
            className="select"
            id="filter-match-id"
            value={filterMatchId}
            onChange={(event) => setFilterMatchId(event.target.value)}
          >
            <option value="">All matches</option>
            {matches.map((match) => (
              <option key={match.id} value={String(match.id)}>{matchLabel(match)}</option>
            ))}
          </select>
        </label>
        <button className="button button-secondary" type="button" onClick={() => void loadData(selectedMatchId)}>
          Apply
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setFilterMatchId("");
            void loadData();
          }}
        >
          Clear
        </button>
      </div>

      {error && <StatePanel variant="error" title="Review action failed" description={error} />}
      {success && <StatePanel variant="success" title="Review updated" description={success} />}

      <div className="two-column">
        <div className="page-stack">
          <MatchContext match={selectedMatch} />

          <form className="surface-strong panel-padding" onSubmit={onSubmit}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Review note</p>
                <h2 className="section-title mt-3">{editingNoteId ? "Refine the evidence" : "Capture the lesson"}</h2>
              </div>
              {editingNoteId && (
                <button className="button button-secondary" type="button" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="field-label">
                Linked match
                <select className="select" value={form.matchId} onChange={(event) => setForm((prev) => ({ ...prev, matchId: event.target.value }))}>
                  <option value="">No match linked</option>
                  {matches.map((match) => (
                    <option key={match.id} value={String(match.id)}>{matchLabel(match)}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Review type
                <select className="select" value={form.noteType} onChange={(event) => setForm((prev) => ({ ...prev, noteType: event.target.value }))}>
                  {noteTypes.map((option) => (
                    <option key={option} value={option}>{humanize(option)}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field-label mt-4">
              Summary
              <input
                className="field"
                placeholder="The one thing this match revealed"
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
              />
            </label>

            <label className="field-label mt-4">
              Strengths, mistakes, and context
              <textarea
                className="textarea"
                placeholder="What worked, what cost rounds, and what you will test next session."
                value={form.fullNote}
                onChange={(event) => setForm((prev) => ({ ...prev, fullNote: event.target.value }))}
              />
            </label>

            <div className="mt-4 surface-subtle p-4">
              <p className="label">Issue tags</p>
              <div className="chip-row mt-3">
                {suggestedTags.map((tag) => (
                  <button key={tag} className="chip" type="button" onClick={() => addSuggestedTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
                <input
                  className="field"
                  placeholder="Category"
                  value={tagDraft.category ?? ""}
                  onChange={(event) => setTagDraft((prev) => ({ ...prev, category: event.target.value }))}
                />
                <select className="select" value={tagDraft.severity ?? ""} onChange={(event) => setTagDraft((prev) => ({ ...prev, severity: event.target.value }))}>
                  {severityOptions.map((severity) => (
                    <option key={severity || "none"} value={severity}>{severity || "Severity"}</option>
                  ))}
                </select>
                <input
                  className="field"
                  placeholder="Round ref"
                  value={tagDraft.round_reference ?? ""}
                  onChange={(event) => setTagDraft((prev) => ({ ...prev, round_reference: event.target.value }))}
                />
                <button className="button button-secondary" onClick={addTagFromDraft} type="button">
                  Add tag
                </button>
              </div>
              <input
                className="field mt-3"
                placeholder="Tag description"
                value={tagDraft.description ?? ""}
                onChange={(event) => setTagDraft((prev) => ({ ...prev, description: event.target.value }))}
              />

              {form.issueTags.length > 0 && (
                <div className="chip-row mt-4">
                  {form.issueTags.map((tag, index) => (
                    <span key={`${tag.category}-${index}`} className={`chip ${severityClass(tag.severity)}`}>
                      {tag.category}
                      {tag.severity ? ` / ${tag.severity}` : ""}
                      <button className="border-0 bg-transparent text-inherit" onClick={() => removeTag(index)} type="button" aria-label={`Remove ${tag.category}`}>
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className="button button-primary" disabled={saving} type="submit">
                {saving ? "Saving" : editingNoteId ? "Update note" : "Save note"}
              </button>
              <p className="microcopy">Good reviews are short, specific, and reusable by the coaching layer.</p>
            </div>
          </form>
        </div>

        <div className="page-stack">
          <IssueSummary issues={recurringIssues} />

          <div className="surface panel-padding">
            <p className="eyebrow">Saved notes</p>
            {loading && (
              <StatePanel
                variant="loading"
                title="Loading notes"
                description="Fetching review notes and tag history for the selected scope."
              />
            )}
            {!loading && notes.length === 0 && (
              <div className="mt-4">
                <StatePanel
                  variant="empty"
                  title="No notes for this filter"
                  description="Create a review note to start building an evidence trail."
                />
              </div>
            )}
            {!loading && notes.length > 0 && (
              <div className="data-list mt-4">
                {notes.map((note) => (
                  <article key={note.id} className="data-row p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--text)]">{note.summary}</p>
                        <p className="section-copy">
                          Note #{note.id} | Match {note.match_id ?? "None"} | {humanize(note.note_type)} | {formatDate(note.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="button button-secondary min-h-0 px-3 py-1" onClick={() => startEdit(note)} type="button">Edit</button>
                        <button className="button button-danger min-h-0 px-3 py-1" onClick={() => void handleDelete(note.id)} type="button">Delete</button>
                      </div>
                    </div>
                    {note.full_note && <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{note.full_note}</p>}
                    {note.issue_tags.length > 0 && (
                      <div className="chip-row mt-3">
                        {note.issue_tags.map((tag) => (
                          <span key={tag.id} className={`chip ${severityClass(tag.severity)}`}>
                            {tag.category}
                            {tag.severity ? ` / ${tag.severity}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
