import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { fetchInsights } from "../../services/api/client";
import type { BreakdownEntry, InsightsResponse, MetricDelta } from "../../types/insights";

const windows = [5, 10, 15, 20];

const metricLabels: Record<string, string> = {
  win_rate: "Win rate",
  avg_acs: "Average ACS",
  avg_adr: "Average ADR",
  avg_kda: "Average KDA",
  avg_hs_percent: "Headshot rate",
  avg_rr_change: "RR change"
};

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(2)}${suffix}`;
}

function formatCompact(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return value.toFixed(value >= 100 ? 0 : 1);
}

function directionClass(direction: string): string {
  if (direction === "up") return "tone-positive";
  if (direction === "down") return "tone-negative";
  return "";
}

function directionCopy(row: MetricDelta): string {
  if (row.direction === "up") return "Improving";
  if (row.direction === "down") return "Declining";
  return "Stable";
}

function deltaPrefix(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "+" : "";
}

function InsightMetric({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div className="surface-subtle p-4">
      <p className="label">{label}</p>
      <p className="metric-value metric-md mt-3">{value}</p>
      <p className="section-copy">{subtext}</p>
    </div>
  );
}

function TrendCard({ row }: { row: MetricDelta }) {
  const width = row.recent === null || row.baseline === null ? 50 : Math.min(100, Math.max(8, (row.recent / Math.max(row.baseline, row.recent, 1)) * 100));

  return (
    <article className="surface-subtle p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">{metricLabels[row.metric] ?? row.metric}</p>
          <p className={`mt-2 text-xl font-semibold ${directionClass(row.direction)}`}>{directionCopy(row)}</p>
        </div>
        <p className={`metric-value text-2xl ${directionClass(row.direction)}`}>
          {deltaPrefix(row.delta)}{formatCompact(row.delta)}
        </p>
      </div>
      <div className="mt-4 progress-track" aria-label={`${metricLabels[row.metric] ?? row.metric} trend`}>
        <div className="progress-fill" style={{ width: `${width}%` }} />
      </div>
      <p className="section-copy">
        Recent {formatCompact(row.recent)} vs baseline {formatCompact(row.baseline)}
      </p>
    </article>
  );
}

function BreakdownSection({ title, question, rows }: { title: string; question: string; rows: BreakdownEntry[] }) {
  const sortedRows = [...rows].sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0)).slice(0, 8);

  return (
    <section className="surface panel-padding">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{title}</p>
          <h2 className="section-title mt-2">{question}</h2>
        </div>
        <span className="chip">{rows.length} groups</span>
      </div>

      {sortedRows.length === 0 && (
        <div className="mt-5">
          <StatePanel variant="empty" title="Not enough evidence" description="Import more matches to make this breakdown useful." />
        </div>
      )}

      {sortedRows.length > 0 && (
        <div className="mt-5 data-list">
          {sortedRows.map((row) => (
            <article key={row.label} className="data-row p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_120px_120px_120px] md:items-center">
                <div>
                  <p className="text-base font-semibold text-[var(--text)]">{row.label}</p>
                  <p className="section-copy">{row.matches} matches</p>
                  <div className="mt-3 progress-track" aria-label={`${row.label} win rate ${formatNumber(row.win_rate, "%")}`}>
                    <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, row.win_rate ?? 0))}%` }} />
                  </div>
                </div>
                <div>
                  <p className="label">Win rate</p>
                  <p className="metric-value text-xl">{formatNumber(row.win_rate, "%")}</p>
                </div>
                <div>
                  <p className="label">ACS</p>
                  <p className="metric-value text-xl">{formatCompact(row.avg_acs)}</p>
                </div>
                <div>
                  <p className="label">KDA</p>
                  <p className="metric-value text-xl">{formatCompact(row.avg_kda)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function InsightsPage() {
  const [recentWindow, setRecentWindow] = useState(10);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInsights(recentWindow);
        if (active) setInsights(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [recentWindow]);

  const trendRows = useMemo(() => insights?.trend_summary.comparisons ?? [], [insights]);
  const strongestTrend = useMemo(
    () => trendRows.find((row) => row.direction === "up") ?? trendRows[0],
    [trendRows]
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Deterministic analytics"
        title="Insights"
        description="Every visualization answers a practical question about improvement, map cost, agent fit, or stability."
        rightSlot={
          <div className="segmented" aria-label="Recent match window">
            {windows.map((windowSize) => (
              <button
                key={windowSize}
                className={`segment ${recentWindow === windowSize ? "segment-active" : ""}`}
                type="button"
                onClick={() => setRecentWindow(windowSize)}
              >
                {windowSize}
              </button>
            ))}
          </div>
        }
      />

      {loading && (
        <StatePanel
          variant="loading"
          title="Computing insight signals"
          description="Comparing recent performance against baseline, then grouping evidence by map, agent, and role."
        />
      )}

      {error && <StatePanel variant="error" title="Insights are unavailable" description={error} />}

      {!loading && !error && insights && (
        <>
          <div className="surface-strong panel-padding">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
              <div>
                <p className="eyebrow">Am I actually improving recently?</p>
                <p className="metric-value metric-xl mt-5">{formatNumber(insights.recent_form.win_rate, "%")}</p>
                <p className="section-copy">
                  {insights.recent_form.wins} wins, {insights.recent_form.losses} losses, {insights.recent_form.draws} draws over the selected window.
                </p>
                {strongestTrend && (
                  <p className="mt-5 text-lg leading-8 text-[var(--text-soft)]">
                    Strongest signal: {metricLabels[strongestTrend.metric] ?? strongestTrend.metric} is {directionCopy(strongestTrend).toLowerCase()} against baseline.
                  </p>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InsightMetric label="Recent ACS" value={formatCompact(insights.recent_form.avg_acs)} subtext={`Baseline ${formatCompact(insights.baseline_form.avg_acs)}`} />
                <InsightMetric label="Recent ADR" value={formatCompact(insights.recent_form.avg_adr)} subtext={`Baseline ${formatCompact(insights.baseline_form.avg_adr)}`} />
                <InsightMetric label="Current streak" value={`${insights.streaks.current_streak_length} ${insights.streaks.current_streak_type}`} subtext={`Longest W/L ${insights.streaks.longest_win_streak} / ${insights.streaks.longest_loss_streak}`} />
                <InsightMetric label="Volatility" value={insights.volatility.level} subtext={`Switch rate ${formatNumber(insights.volatility.result_switch_rate, "%")}`} />
              </div>
            </div>
          </div>

          <section className="surface panel-padding">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">What changed?</p>
                <h2 className="section-title mt-2">
                  Recent {insights.trend_summary.recent_window} vs baseline {insights.trend_summary.baseline_window}
                </h2>
              </div>
              <span className="chip">Trend deltas</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {trendRows.map((row) => (
                <TrendCard key={row.metric} row={row} />
              ))}
            </div>
          </section>

          <BreakdownSection title="Map cost" question="Which map is costing results?" rows={insights.map_breakdowns} />
          <BreakdownSection title="Agent fit" question="Which agent profile is strongest?" rows={insights.agent_breakdowns} />
          <BreakdownSection title="Role stability" question="Which role produces reliable impact?" rows={insights.role_breakdowns} />
        </>
      )}
    </section>
  );
}
