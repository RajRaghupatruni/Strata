import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import {
  fetchCoachingReports,
  fetchLatestCoachingReport,
  generateCoachingReport,
  generateProCoachingBrief
} from "../../services/api/client";
import type { CoachingReport, ProCoachingBrief } from "../../types/coach";

const windows = [5, 10, 15, 20];

function formatDate(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-stone-400">{title}</p>
      <p className="mt-2 text-sm text-stone-200 whitespace-pre-line">{value || "N/A"}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-stone-400">{title}</p>
      {items.length === 0 && <p className="mt-2 text-sm text-stone-400">No items generated.</p>}
      {items.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-200">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-stone-300">
        <span className="capitalize">{label}</span>
        <span>{score.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded bg-stone-800">
        <div
          className="h-2 rounded bg-gradient-to-r from-amber-500/80 to-emerald-400/80"
          style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
        />
      </div>
    </div>
  );
}

export function CoachPage() {
  const [recentWindow, setRecentWindow] = useState(10);
  const [latest, setLatest] = useState<CoachingReport | null>(null);
  const [history, setHistory] = useState<CoachingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proBrief, setProBrief] = useState<ProCoachingBrief | null>(null);
  const [proGenerating, setProGenerating] = useState(false);
  const [proError, setProError] = useState<string | null>(null);
  const [proMatchId, setProMatchId] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [latestResp, historyResp] = await Promise.all([
        fetchLatestCoachingReport(),
        fetchCoachingReports(8)
      ]);
      setLatest(latestResp.report);
      setHistory(historyResp.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await generateCoachingReport(recentWindow);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate coaching");
    } finally {
      setGenerating(false);
    }
  }

  async function onGenerateProBrief() {
    setProGenerating(true);
    setProError(null);
    try {
      const parsedMatchId = Number(proMatchId);
      const hasMatchId = Number.isFinite(parsedMatchId) && parsedMatchId > 0;
      const result = await generateProCoachingBrief(
        recentWindow,
        hasMatchId ? parsedMatchId : undefined
      );
      setProBrief(result);
    } catch (err) {
      setProError(err instanceof Error ? err.message : "Failed to generate pro coaching brief");
    } finally {
      setProGenerating(false);
    }
  }

  const topIssues = useMemo(() => {
    const raw = latest?.supporting_data?.top_recurring_issues;
    return Array.isArray(raw) ? raw : [];
  }, [latest]);

  const assessmentDimensions = useMemo(() => {
    const maybeAssessment = latest?.supporting_data?.assessment;
    if (!maybeAssessment || typeof maybeAssessment !== "object") return {};
    const dimensions = (maybeAssessment as { dimensions?: Record<string, unknown> }).dimensions;
    if (!dimensions || typeof dimensions !== "object") return {};
    const cleaned: Record<string, number> = {};
    Object.entries(dimensions).forEach(([key, value]) => {
      if (typeof value === "number") cleaned[key] = value;
    });
    return cleaned;
  }, [latest]);

  const aiMetadata = useMemo(() => {
    const value = latest?.supporting_data?.ai_metadata;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  }, [latest]);
  const generationMode = useMemo(() => {
    const mode = latest?.supporting_data?.generation_mode;
    return typeof mode === "string" ? mode : "deterministic";
  }, [latest]);

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Coaching Layer"
        title="Coach"
        description="Generate professional-grade coaching from your match history, including direct feedback, role fit, and optional single-game deep dissection."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
        <label className="text-sm text-stone-300" htmlFor="recent-window">
          Coaching window
        </label>
        <select
          id="recent-window"
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={recentWindow}
          onChange={(event) => setRecentWindow(Number(event.target.value))}
        >
          {windows.map((value) => (
            <option key={value} value={value}>
              Last {value} matches
            </option>
          ))}
        </select>
        <button
          className="rounded bg-amber-200/20 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30 disabled:opacity-50"
          disabled={generating}
          onClick={() => void onGenerate()}
          type="button"
        >
          {generating ? "Generating..." : "Generate Coaching Report"}
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-cyan-100" htmlFor="pro-match-id">
            Optional specific match ID
          </label>
          <input
            id="pro-match-id"
            className="w-28 rounded border border-cyan-300/30 bg-slate-900/60 px-3 py-2 text-sm text-cyan-50"
            placeholder="e.g. 42"
            value={proMatchId}
            onChange={(event) => setProMatchId(event.target.value)}
          />
          <button
            className="rounded bg-cyan-200/20 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-200/30 disabled:opacity-50"
            disabled={proGenerating}
            onClick={() => void onGenerateProBrief()}
            type="button"
          >
            {proGenerating ? "Generating Pro Brief..." : "Generate Pro Coaching Brief"}
          </button>
        </div>
        <p className="text-xs text-cyan-50/80">
          Creates a personal, direct coaching breakdown: strengths, role fit, harsh truths,
          priority improvements, and optional one-game deep dissection.
        </p>
      </div>

      {error && <StatePanel variant="error" title="Coaching Error" description={error} />}
      {proError && <StatePanel variant="error" title="Pro Coaching Error" description={proError} />}

      {loading && (
        <StatePanel
          variant="loading"
          title="Loading Coaching Reports"
          description="Reading latest recommendations and recent report history."
        />
      )}

      {!loading && !latest && (
        <StatePanel
          variant="empty"
          title="No Coaching Report Yet"
          description="Generate your first report to unlock priority issue, stop/keep actions, and weekly plan."
        />
      )}

      {!loading && latest && (
        <>
          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-stone-400">Latest Report</p>
            <p className="mt-2 text-sm text-stone-300">
              Generated: {formatDate(latest.generated_at)} | Window:{" "}
              {formatDate(latest.time_window_start)} {" -> "} {formatDate(latest.time_window_end)}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextBlock title="Priority Issue" value={latest.priority_issue} />
            <TextBlock title="Stop Doing" value={latest.stop_doing} />
            <TextBlock title="Keep Doing" value={latest.keep_doing} />
            <TextBlock title="Improve Next" value={latest.improve_next} />
            <TextBlock title="Next Session Focus" value={latest.next_session_focus} />
            <TextBlock title="Weekly Plan" value={latest.weekly_plan} />
          </div>

          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <h3 className="text-lg font-medium">Top Recurring Issues Used In Coaching</h3>
            {topIssues.length === 0 && (
              <p className="mt-2 text-sm text-stone-400">No recurring issue tags found.</p>
            )}
            {topIssues.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded border border-stone-700/60">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-stone-900/70 text-stone-300">
                    <tr>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Occurrences</th>
                      <th className="px-3 py-2 font-medium">High Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topIssues.map((issue, index) => (
                      <tr key={index} className="border-t border-stone-800">
                        <td className="px-3 py-2">{String((issue as { category?: string }).category ?? "N/A")}</td>
                        <td className="px-3 py-2">
                          {String((issue as { occurrences?: number }).occurrences ?? 0)}
                        </td>
                        <td className="px-3 py-2">
                          {String(
                            (issue as { high_severity_occurrences?: number })
                              .high_severity_occurrences ?? 0
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <h3 className="text-lg font-medium">Smart Assessment Vector</h3>
            {Object.keys(assessmentDimensions).length === 0 && (
              <p className="mt-2 text-sm text-stone-400">Assessment data unavailable in this report.</p>
            )}
            {Object.keys(assessmentDimensions).length > 0 && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {Object.entries(assessmentDimensions).map(([label, score]) => (
                  <ScoreBar key={label} label={label} score={score} />
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-stone-500">
              Generation mode: {generationMode} | AI used:{" "}
              {Boolean(aiMetadata?.used_ai) ? "yes" : "no"}
            </p>
          </div>
        </>
      )}

      {!loading && history.length > 0 && (
        <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
          <h3 className="text-lg font-medium">Coaching History</h3>
          <div className="mt-3 overflow-x-auto rounded border border-stone-700/60">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-900/70 text-stone-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Report</th>
                  <th className="px-3 py-2 font-medium">Generated</th>
                  <th className="px-3 py-2 font-medium">Priority Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {history.map((report) => (
                  <tr key={report.id} className="border-t border-stone-800">
                    <td className="px-3 py-2">#{report.id}</td>
                    <td className="px-3 py-2">{formatDate(report.generated_at)}</td>
                    <td className="px-3 py-2">{report.priority_issue ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {proBrief && (
        <div className="space-y-4 rounded-lg border border-cyan-300/40 bg-slate-900/50 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-cyan-200">Pro Coaching Brief</p>
            <p className="mt-1 text-sm text-stone-300">
              Generated: {formatDate(proBrief.generated_at)} | Window: last{" "}
              {proBrief.recent_window} matches
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextBlock title="Profile Focus" value={proBrief.profile_focus} />
            <TextBlock title="Best Role Fit" value={proBrief.best_role_fit} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ListBlock title="What You Do Well" items={proBrief.what_you_do_well} />
            <ListBlock title="What Is Holding You Back" items={proBrief.what_is_holding_you_back} />
            <ListBlock title="Harsh Truths" items={proBrief.harsh_truths} />
            <ListBlock title="Priority Improvements" items={proBrief.priority_improvements} />
            <ListBlock title="Next Match Plan" items={proBrief.next_match_plan} />
            <ListBlock title="Weekly Program" items={proBrief.weekly_program} />
          </div>

          <ListBlock title="Evidence Points" items={proBrief.evidence_points} />

          {proBrief.specific_game_breakdown && (
            <div className="rounded-lg border border-cyan-300/35 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-cyan-200">
                Specific Game Breakdown (Match #{proBrief.specific_game_breakdown.match_id})
              </p>
              <p className="mt-2 text-sm text-stone-200">
                {proBrief.specific_game_breakdown.summary}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <ListBlock title="Did Well" items={proBrief.specific_game_breakdown.did_well} />
                <ListBlock
                  title="Cost You Rounds"
                  items={proBrief.specific_game_breakdown.cost_you_rounds}
                />
                <ListBlock
                  title="Fix Next Time"
                  items={proBrief.specific_game_breakdown.fix_next_time}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
