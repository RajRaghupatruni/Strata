import { useEffect, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import {
  fetchLatestProgressSnapshot,
  fetchProgressSnapshots,
  generateProgressSnapshot
} from "../../services/api/client";
import type { MetricChange, ProgressSnapshot, RecommendationEffectiveness } from "../../types/progress";

const windows = [5, 10, 15, 20];

type RecommendationLifecycleProps = {
  recommendation: string;
  rationale: string;
  beforeEvidence: string;
  actionStatus: string;
  afterEvidence: string;
  outcome: string;
  details: MetricChange[];
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
  const changed = metric.delta !== null && metric.delta !== 0;

  return (
    <article className="surface-subtle p-4">
      <p className="label">{metricName(metric.metric)}</p>
      <p className={`metric-value metric-md mt-3 ${directionClass(metric.direction)}`}>
        {formatDelta(metric.delta)}
      </p>
      <p className="section-copy">
        Recent {metric.recent ?? "N/A"} vs previous {metric.previous ?? "N/A"}
      </p>
      <div className="mt-4 progress-track">
        <div className="progress-fill" style={{ width: changed ? "74%" : "42%" }} />
      </div>
    </article>
  );
}

function RecommendationLifecycle({
  recommendation,
  rationale,
  beforeEvidence,
  actionStatus,
  afterEvidence,
  outcome,
  details
}: RecommendationLifecycleProps) {
  const steps = [
    ["Recommendation", recommendation],
    ["Why it was recommended", rationale],
    ["Before evidence", beforeEvidence],
    ["Player action / status", actionStatus],
    ["After evidence", afterEvidence],
    ["Outcome", outcome]
  ];

  return (
    <section className="surface-strong panel-padding">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Recommendation lifecycle</p>
          <h2 className="section-title mt-2">From coaching idea to measured outcome</h2>
        </div>
        <span className="chip chip-accent">Future contract ready</span>
      </div>

      <div className="workflow-line mt-6">
        {steps.map(([title, body]) => (
          <article key={title} className="workflow-step">
            <p className="label">{title}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{body}</p>
          </article>
        ))}
      </div>

      {details.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {details.map((metric) => (
            <MetricDeltaCard key={metric.metric} metric={metric} />
          ))}
        </div>
      )}
    </section>
  );
}

function lifecycleFromEffectiveness(effectiveness?: RecommendationEffectiveness | null): RecommendationLifecycleProps {
  return {
    recommendation: effectiveness?.report_id ? `Legacy coaching report #${effectiveness.report_id}` : "Awaiting first-class recommendation data",
    rationale: "Current UI reserves this step for the backend recommendation rationale once the final contract lands.",
    beforeEvidence: `${effectiveness?.before_window_matches ?? 0} matches in the before window`,
    actionStatus: effectiveness?.status ?? "Not evaluated",
    afterEvidence: `${effectiveness?.after_window_matches ?? 0} matches in the after window`,
    outcome: effectiveness?.note ?? "Generate more evidence to evaluate effectiveness.",
    details: effectiveness?.details ?? []
  };
}

export function ProgressPage() {
  const [recentWindow, setRecentWindow] = useState(10);
  const [previousWindow, setPreviousWindow] = useState(10);
  const [latest, setLatest] = useState<ProgressSnapshot | null>(null);
  const [history, setHistory] = useState<ProgressSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [latestResp, historyResp] = await Promise.all([
        fetchLatestProgressSnapshot(),
        fetchProgressSnapshots(10)
      ]);
      setLatest(latestResp.snapshot);
      setHistory(historyResp.snapshots);
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
      await generateProgressSnapshot(recentWindow, previousWindow);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate snapshot");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Progress loop"
        title="Progress"
        description="Measure whether coaching changed actual performance, issue recurrence, and evidence quality over time."
      />

      <div className="control-bar">
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
        <button className="button button-primary" disabled={generating} onClick={() => void onGenerate()} type="button">
          {generating ? "Generating snapshot" : "Generate snapshot"}
        </button>
      </div>

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
          description="Generate a snapshot once there is enough before and after evidence to compare."
        />
      )}

      {!loading && latest && (
        <>
          <div className="surface panel-padding">
            <p className="eyebrow">Latest snapshot</p>
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

          <RecommendationLifecycle {...lifecycleFromEffectiveness(latest.recommendation_effectiveness)} />

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
                        <p className={`metric-value text-xl ${directionClass(trend.direction)}`}>
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

      {!loading && history.length > 0 && (
        <section className="surface panel-padding">
          <p className="eyebrow">Snapshot history</p>
          <h2 className="section-title mt-2">Evidence checkpoints</h2>
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
                {history.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>#{snapshot.id}</td>
                    <td>{formatDate(snapshot.snapshot_date)}</td>
                    <td>{snapshot.metric_window ?? "N/A"}</td>
                    <td>{snapshot.summary ?? "N/A"}</td>
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
