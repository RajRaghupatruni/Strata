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
  return parsed.toLocaleString();
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

export function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [recurringIssues, setRecurringIssues] = useState<RecurringIssue[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filterMatchId, setFilterMatchId] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [form, setForm] = useState<ReviewFormState>(emptyForm);
  const [tagDraft, setTagDraft] = useState<IssueTagInput>(emptyTagDraft);

  const selectedMatchId = useMemo(() => parseMatchId(filterMatchId), [filterMatchId]);

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
    try {
      if (editingNoteId) {
        await updateReviewNote(editingNoteId, payload);
      } else {
        await createReviewNote(payload);
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
    try {
      await deleteReviewNote(noteId);
      await loadData(selectedMatchId);
      if (editingNoteId === noteId) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Review Workflow"
        title="Review Workspace"
        description="Capture match reflections, tag mistakes, and track what repeats most often."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
        <label className="text-sm text-stone-300" htmlFor="filter-match-id">
          Filter by match
        </label>
        <select
          id="filter-match-id"
          className="min-w-[280px] rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={filterMatchId}
          onChange={(event) => setFilterMatchId(event.target.value)}
        >
          <option value="">All matches</option>
          {matches.map((match) => (
            <option key={match.id} value={String(match.id)}>
              {matchLabel(match)}
            </option>
          ))}
        </select>
        <button
          className="rounded bg-amber-200/20 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30"
          type="button"
          onClick={() => void loadData(selectedMatchId)}
        >
          Apply Filter
        </button>
        <button
          className="rounded bg-stone-700 px-3 py-2 text-sm text-stone-100 transition hover:bg-stone-600"
          type="button"
          onClick={() => {
            setFilterMatchId("");
            void loadData();
          }}
        >
          Clear
        </button>
      </div>

      <form
        className="space-y-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{editingNoteId ? "Edit Note" : "Add Review Note"}</h3>
          {editingNoteId && (
            <button
              className="rounded bg-stone-700 px-3 py-1 text-xs text-stone-100 hover:bg-stone-600"
              type="button"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
            value={form.matchId}
            onChange={(event) => setForm((prev) => ({ ...prev, matchId: event.target.value }))}
          >
            <option value="">No match linked</option>
            {matches.map((match) => (
              <option key={match.id} value={String(match.id)}>
                {matchLabel(match)}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
            value={form.noteType}
            onChange={(event) => setForm((prev) => ({ ...prev, noteType: event.target.value }))}
          >
            {noteTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <input
          className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          placeholder="Summary (required)"
          value={form.summary}
          onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
        />

        <textarea
          className="min-h-[100px] w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          placeholder="Full review details"
          value={form.fullNote}
          onChange={(event) => setForm((prev) => ({ ...prev, fullNote: event.target.value }))}
        />

        <div className="rounded border border-stone-700/60 bg-stone-950/30 p-3">
          <p className="mb-2 text-sm text-stone-300">Issue Tags</p>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="Category (required)"
              value={tagDraft.category ?? ""}
              onChange={(event) =>
                setTagDraft((prev) => ({ ...prev, category: event.target.value }))
              }
            />
            <select
              className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              value={tagDraft.severity ?? ""}
              onChange={(event) =>
                setTagDraft((prev) => ({ ...prev, severity: event.target.value }))
              }
            >
              {severityOptions.map((severity) => (
                <option key={severity || "none"} value={severity}>
                  {severity || "Severity"}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="Round ref (e.g. 8A)"
              value={tagDraft.round_reference ?? ""}
              onChange={(event) =>
                setTagDraft((prev) => ({ ...prev, round_reference: event.target.value }))
              }
            />
            <button
              className="rounded bg-stone-700 px-3 py-2 text-sm text-stone-100 hover:bg-stone-600"
              onClick={addTagFromDraft}
              type="button"
            >
              Add Tag
            </button>
          </div>
          <input
            className="mt-2 w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
            placeholder="Tag description (optional)"
            value={tagDraft.description ?? ""}
            onChange={(event) =>
              setTagDraft((prev) => ({ ...prev, description: event.target.value }))
            }
          />

          {form.issueTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {form.issueTags.map((tag, index) => (
                <span
                  key={`${tag.category}-${index}`}
                  className="inline-flex items-center gap-2 rounded bg-stone-700 px-2 py-1 text-xs text-stone-100"
                >
                  {tag.category}
                  {tag.severity ? ` (${tag.severity})` : ""}
                  <button
                    className="text-red-200 hover:text-red-100"
                    onClick={() => removeTag(index)}
                    type="button"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          className="rounded bg-amber-200/20 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30 disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving..." : editingNoteId ? "Update Note" : "Save Note"}
        </button>
      </form>

      {error && <StatePanel variant="error" title="Review Action Failed" description={error} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
          <h3 className="text-lg font-medium">Review Notes</h3>
          {loading && (
            <StatePanel
              variant="loading"
              title="Loading Notes"
              description="Fetching your saved review notes and issue tags."
            />
          )}
          {!loading && notes.length === 0 && (
            <StatePanel
              variant="empty"
              title="No Notes For This Filter"
              description="Create your first review note to start building recurring issue history."
            />
          )}
          {!loading &&
            notes.map((note) => (
              <article key={note.id} className="rounded border border-stone-700/60 bg-stone-950/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-100">{note.summary}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      Note #{note.id} | Match {note.match_id ?? "None"} | {note.note_type ?? "other"} |{" "}
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded bg-stone-700 px-2 py-1 text-xs text-stone-100 hover:bg-stone-600"
                      onClick={() => startEdit(note)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded bg-red-700/50 px-2 py-1 text-xs text-red-100 hover:bg-red-600/60"
                      onClick={() => void handleDelete(note.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {note.full_note && <p className="mt-2 text-sm text-stone-300">{note.full_note}</p>}
                {note.issue_tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {note.issue_tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded bg-stone-700 px-2 py-1 text-xs text-stone-100"
                      >
                        {tag.category}
                        {tag.severity ? ` (${tag.severity})` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
        </div>

        <div className="space-y-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
          <h3 className="text-lg font-medium">Recurring Issues</h3>
          {loading && (
            <StatePanel
              variant="loading"
              title="Loading Issue Trends"
              description="Grouping issue tags to surface your most repeated mistakes."
            />
          )}
          {!loading && recurringIssues.length === 0 && (
            <StatePanel
              variant="empty"
              title="No Recurring Issue Data"
              description="Add issue tags to review notes and trends will appear here."
            />
          )}
          {!loading && recurringIssues.length > 0 && (
            <div className="overflow-x-auto rounded border border-stone-700/60">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-900/70 text-stone-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Occurrences</th>
                    <th className="px-3 py-2 font-medium">High Sev</th>
                    <th className="px-3 py-2 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringIssues.map((issue) => (
                    <tr key={issue.category} className="border-t border-stone-800">
                      <td className="px-3 py-2">{issue.category}</td>
                      <td className="px-3 py-2">{issue.occurrences}</td>
                      <td className="px-3 py-2">{issue.high_severity_occurrences}</td>
                      <td className="px-3 py-2">{formatDate(issue.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
