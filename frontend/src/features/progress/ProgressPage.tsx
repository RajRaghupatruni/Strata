import { useEffect, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import {
  fetchLatestProgressSnapshot,
  fetchProgressSnapshots,
  generateProgressSnapshot
} from "../../services/api/client";
import type { MetricChange, ProgressSnapshot } from "../../types/progress";

const windows = [5, 10, 15, 20];

function formatDate(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatDelta(value: number | null): string {
  if (value === null) return "N/A";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function directionClass(direction: string): string {
  if (direction === "up") return "text-emerald-300";
  if (direction === "down") return "text-red-300";
  return "text-stone-300";
}

function MetricDeltaCard({ metric }: { metric: MetricChange }) {
  return (
    <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-stone-400">{metric.metric}</p>
      <p className={`mt-2 text-xl font-semibold ${directionClass(metric.direction)}`}>
        {formatDelta(metric.delta)}
      </p>
      <p className="mt-1 text-xs text-stone-400">
        Recent {metric.recent ?? "N/A"} vs Previous {metric.previous ?? "N/A"}
      </p>
    </div>
  );
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
    <section className="space-y-5">
      <PageHeader
        eyebrow="Feedback Loop"
        title="Progress"
        description="Measure before-vs-after performance, issue recurrence drift, and coaching effectiveness."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
        <label className="text-sm text-stone-300" htmlFor="recent-window">
          Recent window
        </label>
        <select
          id="recent-window"
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={recentWindow}
          onChange={(event) => setRecentWindow(Number(event.target.value))}
        >
          {windows.map((value) => (
            <option key={`recent-${value}`} value={value}>
              Last {value} matches
            </option>
          ))}
        </select>
        <label className="text-sm text-stone-300" htmlFor="previous-window">
          Previous window
        </label>
        <select
          id="previous-window"
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={previousWindow}
          onChange={(event) => setPreviousWindow(Number(event.target.value))}
        >
          {windows.map((value) => (
            <option key={`previous-${value}`} value={value}>
              Prior {value} matches
            </option>
          ))}
        </select>
        <button
          className="rounded bg-amber-200/20 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30 disabled:opacity-50"
          disabled={generating}
          onClick={() => void onGenerate()}
          type="button"
        >
          {generating ? "Generating..." : "Generate Progress Snapshot"}
        </button>
      </div>

      {error && <StatePanel variant="error" title="Progress Error" description={error} />}

      {loading && (
        <StatePanel
          variant="loading"
          title="Loading Progress Data"
          description="Reading latest snapshots and recalculating comparison windows."
        />
      )}

      {!loading && !latest && (
        <StatePanel
          variant="empty"
          title="No Snapshot Yet"
          description="Generate a snapshot to compare recent performance against prior matches."
        />
      )}

      {!loading && latest && (
        <>
          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-stone-400">Latest Snapshot</p>
            <p className="mt-2 text-sm text-stone-300">
              Snapshot #{latest.id} | {formatDate(latest.snapshot_date)} | Window{" "}
              {latest.metric_window ?? "N/A"}
            </p>
            <p className="mt-2 text-sm text-stone-200">{latest.summary ?? "N/A"}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {latest.performance_change.map((metric) => (
              <MetricDeltaCard key={metric.metric} metric={metric} />
            ))}
          </div>

          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <h3 className="text-lg font-medium">Issue Recurrence Trend</h3>
            {latest.issue_trends.length === 0 && (
              <p className="mt-2 text-sm text-stone-400">No issue trend data yet.</p>
            )}
            {latest.issue_trends.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded border border-stone-700/60">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-stone-900/70 text-stone-300">
                    <tr>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Recent</th>
                      <th className="px-3 py-2 font-medium">Previous</th>
                      <th className="px-3 py-2 font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.issue_trends.map((trend) => (
                      <tr key={trend.category} className="border-t border-stone-800">
                        <td className="px-3 py-2">{trend.category}</td>
                        <td className="px-3 py-2">{trend.recent_count}</td>
                        <td className="px-3 py-2">{trend.previous_count}</td>
                        <td className={`px-3 py-2 ${directionClass(trend.direction)}`}>
                          {trend.delta > 0 ? "+" : ""}
                          {trend.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <h3 className="text-lg font-medium">Recommendation Effectiveness</h3>
            <p className="mt-2 text-sm text-stone-300">
              Status: {latest.recommendation_effectiveness?.status ?? "N/A"} | Report: #
              {latest.recommendation_effectiveness?.report_id ?? "N/A"}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Before matches: {latest.recommendation_effectiveness?.before_window_matches ?? 0} |
              After matches: {latest.recommendation_effectiveness?.after_window_matches ?? 0}
            </p>
            <p className="mt-2 text-sm text-stone-400">
              {latest.recommendation_effectiveness?.note ?? "N/A"}
            </p>
          </div>
        </>
      )}

      {!loading && history.length > 0 && (
        <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
          <h3 className="text-lg font-medium">Snapshot History</h3>
          <div className="mt-3 overflow-x-auto rounded border border-stone-700/60">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-900/70 text-stone-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Snapshot</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Window</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {history.map((snapshot) => (
                  <tr key={snapshot.id} className="border-t border-stone-800">
                    <td className="px-3 py-2">#{snapshot.id}</td>
                    <td className="px-3 py-2">{formatDate(snapshot.snapshot_date)}</td>
                    <td className="px-3 py-2">{snapshot.metric_window ?? "N/A"}</td>
                    <td className="px-3 py-2">{snapshot.summary ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
