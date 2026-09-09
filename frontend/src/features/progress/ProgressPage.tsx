import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAnalyticalStatus, statusLabel } from "../../components/RecommendationCard";
import { PublicDemoReadOnlyError, usePublicDemoReadOnly } from "../../services/api/demoMode";
import type { Recommendation } from "../../types/recommendation";

import { PageHeader } from "../../components/PageHeader";
import { GameVisual } from "../../components/GameVisual";
import { StatePanel } from "../../components/StatePanel";
import {
  fetchLatestProgressSnapshot,
  fetchProgressSnapshots,
  generateProgressSnapshot,
  fetchRecommendation,
  fetchRecommendations
} from "../../services/api/client";
import type { MetricChange, ProgressSnapshot, RecommendationEffectiveness } from "../../types/progress";

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

function formatDelta(value: number | null): string {
  if (value === null) return "N/A";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function directionClass(direction: string): string {
  if (direction === "up") return "tone-positive";
  if (direction === "down") return "tone-negative";
  return "";
}

function metricName(metric: string): string {
  return metric.replace(/_/g, " ");
}

function MetricDeltaCard({ metric }: { metric: MetricChange }) {

  return (
    <article className="surface-subtle p-4">
      <p className="label">{metricName(metric.metric)}</p>
      <p className={`metric-value metric-md mt-3 ${directionClass(metric.direction)}`}>
        {formatDelta(metric.delta)}
      </p>
      <p className="section-copy">
        Recent {metric.recent ?? "N/A"} vs previous {metric.previous ?? "N/A"}
      </p>
    </article>
  );
}

function evidenceValue(metric: string, value: number | null, delta = false): string {
  if (value === null) return delta ? "Not evaluated yet" : "Not available yet";
  const recurrence = metric.startsWith("issue_recurrence:");
  const percentage = recurrence || metric === "win_rate";
  const scaled = recurrence ? value * 100 : value;
  return `${delta && scaled > 0 ? "+" : ""}${scaled.toFixed(2)}${percentage ? (delta ? " percentage points" : "%") : ""}`;
}

function RecommendationLifecycle({ evidence, recommendation, contextLoading }: {
  evidence?: RecommendationEffectiveness | null;
  recommendation: Recommendation | null;
  contextLoading: boolean;
}) {
  if (contextLoading && !recommendation && !evidence?.recommendation_id) {
    return <StatePanel variant="loading" title="Loading recommendation" description="Reading the action and its original rationale." />;
  }
  if (!evidence?.recommendation_id && !recommendation) {
    return <StatePanel variant="empty" title="Start with a recommendation"
      description={evidence?.explanation || "Explore Coach to choose a persisted recommendation, then follow its evidence here."} />;
  }
  const metric = evidence?.evaluation_metric ?? (recommendation?.target_issue_category ? `issue_recurrence:${recommendation.target_issue_category}` : recommendation?.target_metric ?? "none");
  const recurrence = metric.startsWith("issue_recurrence:");
  const metricTitle = recurrence ? `Issue recurrence: ${metricName(metric.split(":")[1])}`
    : ["avg_kda", "kda", "kd", "kill_death_ratio"].includes(metric) ? "Average K/D" : metricName(metric);
  const level = evidence?.evidence_level ?? "insufficient_data";
  const evidenceLabel = level === "insufficient_data" ? "Insufficient data" : statusLabel(level);
  const strength: Record<string, string> = {
    insufficient_data: "The before/after sample is not ready for an outcome. More eligible evidence is needed.",
    directional: "An early signal from a limited sample. Continue collecting evidence.",
    supported: "Meets the backend's sample requirements. An observed change does not prove coaching caused it."
  };
  function sample(period: "before" | "after") {
    if (!evidence) return "No saved evaluation yet.";
    const size = period === "before" ? evidence.before_sample_size : evidence.after_sample_size;
    const value = period === "before" ? evidence.before_value : evidence.after_value;
    const occurrences = period === "before" ? evidence.before_occurrences : evidence.after_occurrences;
    return `${evidenceValue(metric, value)} · ${size} ${recurrence ? "reviewed" : "eligible"} matches${recurrence && occurrences !== null ? ` · ${occurrences} with this issue` : ""}`;
  }
  const steps = [
    ["Before evidence", sample("before")],
    ["Later evidence", sample("after")],
    ["Delta · after minus before", evidenceValue(metric, evidence?.delta ?? null, true)],
    ["Evidence strength", `${evidenceLabel}. ${strength[level] ?? "See the backend explanation below."}`],
    ["Outcome", statusLabel(evidence?.outcome ?? "insufficient_data")],
    ["Explanation", evidence?.explanation ?? "No saved evaluation yet. In the local app, generate a snapshot for this recommendation."]
  ];
  const stepIcons = ["◌", "◉", "↓", "◈", "✓", "·"];
  return (
    <section className="surface-strong panel-padding">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Recommendation #{evidence?.recommendation_id ?? recommendation?.id}</p>
          <h2 className="section-title mt-2">{evidence?.recommendation || recommendation?.title}</h2>
        </div>
        <span className="chip chip-accent">{evidenceLabel}{level === "insufficient_data" ? "" : " evidence"}</span>
      </div>
      {recommendation && <p className="mt-4 text-lg leading-8 text-[var(--text-soft)]">{recommendation.action}</p>}
      <p className="label mt-5">Why it exists</p>
      <p className="section-copy">{recommendation?.evidence_summary || (contextLoading ? "Loading recommendation context…" : "Recommendation context is unavailable; saved evaluation evidence is shown below.")}</p>
      <div className="chip-row mt-4">
        <span className="chip">{evidence ? "Evaluated metric" : "Target metric"}: {metricTitle}</span>
        {recommendation && <span className="chip">Current {isAnalyticalStatus(recommendation.status) ? "analytical status" : "lifecycle"}: {statusLabel(recommendation.status)}</span>}
      </div>
      <p className="microcopy mt-3">Evidence compares matches before and after this recommendation became active{recommendation ? ` on ${formatDate(recommendation.active_at)}` : ""}. Current status may differ from a historical snapshot's outcome.</p>
      <div className="workflow-line mt-6">
        {steps.map(([title, body], index) => (
          <article key={title} className="workflow-step">
            <div className="visual-inline"><GameVisual kind="metric" value={stepIcons[index]} /><p className="label">{title}</p></div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProgressPage() {
  const readOnly = usePublicDemoReadOnly();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryId = Number(searchParams.get("recommendation_id"));
  const requestedId = Number.isInteger(queryId) && queryId > 0 ? queryId : undefined;
  const loadVersion = useRef(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [recentWindow, setRecentWindow] = useState(10);
  const [previousWindow, setPreviousWindow] = useState(10);
  const [latest, setLatest] = useState<ProgressSnapshot | null>(null);
  const [history, setHistory] = useState<ProgressSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const [latestResp, historyResp, recommendationResp] = await Promise.all([
        fetchLatestProgressSnapshot(),
        fetchProgressSnapshots(200),
        fetchRecommendations({ limit: 200 })
      ]);
      if (version !== loadVersion.current) return;
      setLatest(requestedId ? historyResp.snapshots.find((snapshot) => snapshot.recommendation_effectiveness?.recommendation_id === requestedId) ?? null : latestResp.snapshot);
      setRecommendations(recommendationResp.recommendations);
      setHistory(historyResp.snapshots);
    } catch (err) {
      if (version === loadVersion.current) setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { loadVersion.current++; };
  }, [requestedId]);

  const contextId = latest?.recommendation_effectiveness?.recommendation_id ?? requestedId;
  useEffect(() => {
    let cancelled = false;
    setRecommendation(null);
    setContextError(null);
    setContextLoading(Boolean(contextId));
    if (contextId) {
      fetchRecommendation(contextId).then((value) => {
        if (!cancelled) setRecommendation(value);
      }).catch((err: unknown) => {
        if (!cancelled) setContextError(err instanceof Error ? err.message : "Unable to load recommendation context");
      }).finally(() => { if (!cancelled) setContextLoading(false); });
    }
    return () => { cancelled = true; };
  }, [contextId, latest?.id]);

  async function onGenerate() {
    if (readOnly) return;
    setGenerating(true);
    setError(null);
    try {
      await generateProgressSnapshot(recentWindow, previousWindow, requestedId);
      await load();
    } catch (err) {
      if (!(err instanceof PublicDemoReadOnlyError)) setError(err instanceof Error ? err.message : "Failed to generate snapshot");
    } finally {
      setGenerating(false);
    }
  }

  const visibleHistory = history.filter((snapshot) => !requestedId || snapshot.recommendation_effectiveness?.recommendation_id === requestedId);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Progress loop"
        title="Progress"
        description="Measure whether coaching changed actual performance, issue recurrence, and evidence quality over time."
      />

      <div className="control-bar">
        <label className="field-label min-w-0 flex-1">
          Recommendation
          <select className="select" value={requestedId ?? ""} onChange={(event) => setSearchParams(event.target.value ? { recommendation_id: event.target.value } : {})}>
            <option value="">Latest recommendation / all snapshots</option>
            {requestedId && !recommendations.some((item) => item.id === requestedId) && <option value={requestedId}>Recommendation #{requestedId}</option>}
            {recommendations.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.title}</option>)}
          </select>
        </label>
        <label className="field-label w-44">
          Recent window
          <select className="select" value={recentWindow} onChange={(event) => setRecentWindow(Number(event.target.value))}>
            {windows.map((value) => (
              <option key={`recent-${value}`} value={value}>Last {value} matches</option>
            ))}
          </select>
        </label>
        <label className="field-label w-44">
          Previous window
          <select className="select" value={previousWindow} onChange={(event) => setPreviousWindow(Number(event.target.value))}>
            {windows.map((value) => (
              <option key={`previous-${value}`} value={value}>Prior {value} matches</option>
            ))}
          </select>
        </label>
        <button className="button button-primary" disabled={generating || readOnly || loading} onClick={() => void onGenerate()} type="button">
          {generating ? "Generating snapshot" : "Generate snapshot"}
        </button>
      </div>

      <p className="microcopy">The recent window also sets the sample cap on each side of a recommendation. Previous window controls the separate overall performance comparison.</p>
      {contextError && <StatePanel variant="error" title="Recommendation context is unavailable" description={contextError} />}
      {error && <StatePanel variant="error" title="Progress is unavailable" description={error} />}

      {loading && (
        <StatePanel
          variant="loading"
          title="Loading progress evidence"
          description="Reading latest snapshot, effectiveness state, issue drift, and historical snapshots."
        />
      )}

      {!loading && !latest && (
        <StatePanel
          variant="empty"
          title="No snapshot yet"
          description="No saved snapshot is available for this selection. Local users can generate one now; insufficient evidence is a valid result."
        />
      )}

      {!loading && !latest && requestedId && <RecommendationLifecycle recommendation={recommendation} contextLoading={contextLoading} />}
      {!loading && latest && (
        <>
          <div className="surface panel-padding">
            <p className="eyebrow">Selected evidence checkpoint</p>
            <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(320px,1.2fr)]">
              <div>
                <p className="metric-value metric-lg">#{latest.id}</p>
                <p className="section-copy">{formatDate(latest.snapshot_date)} | {latest.metric_window ?? "N/A"}</p>
              </div>
              <p className="text-xl leading-9 text-[var(--text-soft)]">{latest.summary ?? "No summary generated."}</p>
            </div>
          </div>

          <div className="four-column">
            {latest.performance_change.map((metric) => (
              <MetricDeltaCard key={metric.metric} metric={metric} />
            ))}
          </div>

          <RecommendationLifecycle evidence={latest.recommendation_effectiveness} recommendation={recommendation} contextLoading={contextLoading} />

          <section className="surface panel-padding">
            <p className="eyebrow">Issue recurrence</p>
            <h2 className="section-title mt-2">Are the same mistakes appearing less often?</h2>
            {latest.issue_trends.length === 0 && (
              <p className="section-copy">No issue trend data yet.</p>
            )}
            {latest.issue_trends.length > 0 && (
              <div className="data-list mt-5">
                {latest.issue_trends.map((trend) => (
                  <article key={trend.category} className="data-row p-4">
                    <div className="grid gap-4 md:grid-cols-[1fr_100px_100px_100px] md:items-center">
                      <div>
                        <p className="text-base font-semibold text-[var(--text)]">{metricName(trend.category)}</p>
                        <p className="section-copy">Recent vs previous tagged issue count.</p>
                      </div>
                      <div>
                        <p className="label">Recent</p>
                        <p className="metric-value text-xl">{trend.recent_count}</p>
                      </div>
                      <div>
                        <p className="label">Previous</p>
                        <p className="metric-value text-xl">{trend.previous_count}</p>
                      </div>
                      <div>
                        <p className="label">Delta</p>
                        <p className={`metric-value text-xl ${trend.direction === "down" ? "tone-positive" : trend.direction === "up" ? "tone-negative" : ""}`}>
                          {trend.delta > 0 ? "+" : ""}{trend.delta}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {!loading && visibleHistory.length > 0 && (
        <section className="surface panel-padding">
          <p className="eyebrow">Snapshot history</p>
          <h2 className="section-title mt-2">Evidence checkpoints</h2>
          <p className="microcopy mt-2">Showing saved checkpoints from the 200 most recent snapshots.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="fine-table">
              <thead>
                <tr>
                  <th>Snapshot</th>
                  <th>Date</th>
                  <th>Window</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td><button className="button button-secondary" type="button" aria-pressed={latest?.id === snapshot.id}
                      onClick={() => setLatest(snapshot)}>View snapshot #{snapshot.id}</button></td>
                    <td>{formatDate(snapshot.snapshot_date)}</td>
                    <td>{snapshot.metric_window ?? "N/A"}</td>
<td>{snapshot.recommendation_effectiveness?.recommendation || "No recommendation"}<p className="microcopy">{statusLabel(snapshot.recommendation_effectiveness?.outcome ?? "insufficient_data")}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
