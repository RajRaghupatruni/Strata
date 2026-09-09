import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { RecommendationCard } from "../../components/RecommendationCard";
import { PublicDemoReadOnlyError, usePublicDemoReadOnly } from "../../services/api/demoMode";
import type { UserRecommendationStatus } from "../../types/recommendation";
import { StatePanel } from "../../components/StatePanel";
import {
  fetchCoachingReports,
  fetchLatestCoachingReport,
  generateCoachingReport,
  generateProCoachingBrief,
  updateRecommendation
} from "../../services/api/client";
import type { CoachingReport, ProCoachingBrief } from "../../types/coach";

const windows = [5, 10, 15, 20];

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

function TextBlock({ title, value, emphasis = false }: { title: string; value?: string | null; emphasis?: boolean }) {
  return (
    <div className={emphasis ? "surface-strong panel-padding" : "surface-subtle p-4"}>
      <p className="label">{title}</p>
      <p className={`${emphasis ? "mt-4 text-2xl leading-9" : "mt-3 text-sm leading-6"} whitespace-pre-line text-[var(--text-soft)]`}>
        {value || "N/A"}
      </p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="surface-subtle p-4">
      <p className="label">{title}</p>
      {items.length === 0 && <p className="section-copy">No items generated.</p>}
      {items.length > 0 && (
        <div className="mt-3 grid gap-2">
          {items.map((item, index) => (
            <p key={`${title}-${index}`} className="rounded-[8px] border border-[var(--divider)] bg-black/10 px-3 py-2 text-sm leading-6 text-[var(--text-soft)]">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const width = `${Math.max(0, Math.min(score, 100))}%`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="label">{label.replace(/_/g, " ")}</p>
        <p className="metric-value text-lg">{score.toFixed(1)}</p>
      </div>
      <div className="progress-track mt-2">
        <div className="progress-fill" style={{ width }} />
      </div>
    </div>
  );
}

export function CoachPage() {
  const readOnly = usePublicDemoReadOnly();
  const [savingRecommendation, setSavingRecommendation] = useState<number | null>(null);
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

  async function onStatusChange(id: number, status: UserRecommendationStatus) {
    setSavingRecommendation(id);
    setError(null);
    try {
      const updated = await updateRecommendation(id, { status });
      const updateReport = (report: CoachingReport) => ({
        ...report, recommendations: report.recommendations.map((item) => item.id === id ? updated : item)
      });
      setLatest((report) => report ? updateReport(report) : null);
      setHistory((reports) => reports.map(updateReport));
    } catch (err) {
      if (!(err instanceof PublicDemoReadOnlyError)) setError(err instanceof Error ? err.message : "Unable to update lifecycle status");
    } finally {
      setSavingRecommendation(null);
    }
  }

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await generateCoachingReport(recentWindow);
      await load();
    } catch (err) {
      if (!(err instanceof PublicDemoReadOnlyError)) setError(err instanceof Error ? err.message : "Failed to generate coaching");
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
      const result = await generateProCoachingBrief(recentWindow, hasMatchId ? parsedMatchId : undefined);
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

  // Prefer an active action, retaining the backend's report order for ties.
  const recommendations = [...(latest?.recommendations ?? [])].sort(
    (a, b) => Number(b.status === "active") - Number(a.status === "active")
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Evidence-led coaching"
        title="Coach"
        description="Strata translates deterministic match and review signals into a clear next-session plan. AI refinement stays optional and secondary."
        rightSlot={
          <div className="segmented" aria-label="Coaching window">
            {windows.map((value) => (
              <button
                key={value}
                className={`segment ${recentWindow === value ? "segment-active" : ""}`}
                type="button"
                onClick={() => setRecentWindow(value)}
              >
                {value}
              </button>
            ))}
          </div>
        }
      />

      <div className="control-bar">
        <button className="button button-primary" disabled={generating || readOnly} onClick={() => void onGenerate()} type="button">
          {generating ? "Generating report" : "Generate coaching report"}
        </button>
        <span className="chip chip-accent">Window: last {recentWindow} matches</span>
        <span className="chip">Mode: {generationMode}</span>
        <span className="chip">AI used: {Boolean(aiMetadata?.used_ai) ? "yes" : "no"}</span>
      </div>

      {error && <StatePanel variant="error" title="Coaching is unavailable" description={error} />}
      {proError && <StatePanel variant="error" title="Pro brief failed" description={proError} />}

      {loading && (
        <StatePanel
          variant="loading"
          title="Reading coaching evidence"
          description="Loading priority issue, action plan, recurring tags, assessment vector, and report history."
        />
      )}

      {!loading && !latest && (
        <StatePanel
          variant="empty"
          title="No coaching report yet"
          description="Generate your first report to unlock priority issue, stop/keep/improve actions, and a next-session plan."
        />
      )}

      {!loading && latest && (
        <>
          {recommendations[0] && (
            <RecommendationCard recommendation={recommendations[0]} primary readOnly={readOnly}
              saving={savingRecommendation !== null} onStatusChange={(id, status) => void onStatusChange(id, status)} />
          )}
          {recommendations.length > 1 && (
            <details className="surface panel-padding">
              <summary className="cursor-pointer text-base font-semibold">{recommendations.length - 1} supporting recommendations</summary>
              <div className="mt-4 grid gap-4">
                {recommendations.slice(1).map((recommendation) => (
                  <RecommendationCard key={recommendation.id} recommendation={recommendation} readOnly={readOnly}
                    saving={savingRecommendation !== null} onStatusChange={(id, status) => void onStatusChange(id, status)} />
                ))}
              </div>
            </details>
          )}
          {recommendations.length === 0 && <p className="microcopy">This report has no persisted recommendations. Its original guidance is available below.</p>}
          <div className="surface-strong panel-padding">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
              <div>
                <p className="eyebrow">Report #{latest.id} · Coaching context</p>
                <h2 className="mt-4 max-w-4xl text-[clamp(2.4rem,5vw,5.3rem)] font-[720] leading-[0.95] tracking-[0] text-[var(--text)]">
                  {latest.priority_issue || "No priority issue generated"}
                </h2>
                <p className="section-copy mt-5">
                  Generated {formatDate(latest.generated_at)} from {formatDate(latest.time_window_start)} to {formatDate(latest.time_window_end)}.
                </p>
              </div>
              <TextBlock title="Next session plan" value={latest.next_session_focus} emphasis />
            </div>
          </div>

          <div className="three-column">
            <TextBlock title="Stop" value={latest.stop_doing} />
            <TextBlock title="Keep" value={latest.keep_doing} />
            <TextBlock title="Improve" value={latest.improve_next} />
          </div>

          <div className="two-column">
            <section className="surface panel-padding">
              <p className="eyebrow">Rationale</p>
              <h2 className="section-title mt-2">Evidence used by the report</h2>
              {topIssues.length === 0 && <p className="section-copy">No recurring issue tags were available for this report.</p>}
              {topIssues.length > 0 && (
                <div className="data-list mt-5">
                  {topIssues.map((issue, index) => (
                    <article key={index} className="data-row p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-[var(--text)]">
                            {String((issue as { category?: string }).category ?? "Unlabeled issue")}
                          </p>
                          <p className="section-copy">Recurring issue tag surfaced from review history.</p>
                        </div>
                        <div className="text-right">
                          <p className="metric-value text-2xl">{String((issue as { occurrences?: number }).occurrences ?? 0)}</p>
                          <p className="label">seen</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="surface panel-padding">
              <p className="eyebrow">Smart assessment vector</p>
              <h2 className="section-title mt-2">Where the profile is strong or fragile</h2>
              {Object.keys(assessmentDimensions).length === 0 && (
                <p className="section-copy">Assessment data unavailable in this report.</p>
              )}
              {Object.keys(assessmentDimensions).length > 0 && (
                <div className="mt-5 grid gap-4">
                  {Object.entries(assessmentDimensions).map(([label, score]) => (
                    <ScoreBar key={label} label={label} score={score} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <TextBlock title="Weekly plan" value={latest.weekly_plan} />
        </>
      )}

      {!loading && history.length > 0 && (
        <section className="surface panel-padding">
          <p className="eyebrow">History</p>
          <h2 className="section-title mt-2">Coaching reports over time</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="fine-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Generated</th>
                  <th>Priority snapshot</th>
                </tr>
              </thead>
              <tbody>
                {history.map((report) => (
                  <tr key={report.id}>
                    <td><button className="button button-secondary" type="button" aria-pressed={latest?.id === report.id}
                      onClick={() => { setLatest(report); setError(null); }}>View report #{report.id}</button></td>
                    <td>{formatDate(report.generated_at)}</td>
                    <td>{report.priority_issue ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="surface panel-padding">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Optional refinement</p>
            <h2 className="section-title mt-2">Pro coaching brief</h2>
            <p className="section-copy">
              A secondary layer for direct narrative coaching. The product still works without AI credentials.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="field-label w-36">
              Match ID
              <input className="field" placeholder="Optional" value={proMatchId} onChange={(event) => setProMatchId(event.target.value)} />
            </label>
            <button className="button button-secondary" disabled={proGenerating || readOnly} onClick={() => void onGenerateProBrief()} type="button">
              {proGenerating ? "Generating" : "Generate brief"}
            </button>
          </div>
        </div>
      </section>

      {proBrief && (
        <section className="surface panel-padding">
          <p className="eyebrow">Pro brief</p>
          <h2 className="section-title mt-2">Generated {formatDate(proBrief.generated_at)}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextBlock title="Profile focus" value={proBrief.profile_focus} />
            <TextBlock title="Best role fit" value={proBrief.best_role_fit} />
            <ListBlock title="What you do well" items={proBrief.what_you_do_well} />
            <ListBlock title="What is holding you back" items={proBrief.what_is_holding_you_back} />
            <ListBlock title="Harsh truths" items={proBrief.harsh_truths} />
            <ListBlock title="Priority improvements" items={proBrief.priority_improvements} />
            <ListBlock title="Next match plan" items={proBrief.next_match_plan} />
            <ListBlock title="Weekly program" items={proBrief.weekly_program} />
          </div>
          <div className="mt-4">
            <ListBlock title="Evidence points" items={proBrief.evidence_points} />
          </div>
          {proBrief.specific_game_breakdown && (
            <div className="mt-4 surface-subtle p-4">
              <p className="label">Specific game breakdown: match #{proBrief.specific_game_breakdown.match_id}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{proBrief.specific_game_breakdown.summary}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <ListBlock title="Did well" items={proBrief.specific_game_breakdown.did_well} />
                <ListBlock title="Cost rounds" items={proBrief.specific_game_breakdown.cost_you_rounds} />
                <ListBlock title="Fix next time" items={proBrief.specific_game_breakdown.fix_next_time} />
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
