import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { fetchInsights } from "../../services/api/client";
import type { BreakdownEntry, InsightsResponse } from "../../types/insights";

const windows = [5, 10, 15, 20];

const metricLabels: Record<string, string> = {
  win_rate: "Win Rate",
  avg_acs: "Avg ACS",
  avg_adr: "Avg ADR",
  avg_kda: "Avg KDA",
  avg_hs_percent: "Avg HS%",
  avg_rr_change: "Avg RR Change"
};

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(2)}${suffix}`;
}

function directionColor(direction: string): string {
  if (direction === "up") return "text-emerald-300";
  if (direction === "down") return "text-red-300";
  return "text-stone-300";
}

function directionPrefix(value: number | null): string {
  if (value === null) return "";
  return value > 0 ? "+" : "";
}

function BreakdownTable({ title, rows }: { title: string; rows: BreakdownEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="mt-2 text-sm text-stone-400">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-700/60">
      <h3 className="border-b border-stone-700/60 bg-stone-900/70 px-4 py-3 text-lg font-medium">
        {title}
      </h3>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-stone-900/60 text-stone-300">
          <tr>
            <th className="px-3 py-2 font-medium">Label</th>
            <th className="px-3 py-2 font-medium">Matches</th>
            <th className="px-3 py-2 font-medium">Win Rate</th>
            <th className="px-3 py-2 font-medium">Avg ACS</th>
            <th className="px-3 py-2 font-medium">Avg ADR</th>
            <th className="px-3 py-2 font-medium">Avg KDA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-stone-800">
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2">{row.matches}</td>
              <td className="px-3 py-2">{formatNumber(row.win_rate, "%")}</td>
              <td className="px-3 py-2">{formatNumber(row.avg_acs)}</td>
              <td className="px-3 py-2">{formatNumber(row.avg_adr)}</td>
              <td className="px-3 py-2">{formatNumber(row.avg_kda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        if (active) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
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

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Analysis Engine"
        title="Insights"
        description="Track recent form, trend deltas, and stable strengths across maps, agents, and roles."
      />

      <div className="flex items-center gap-3">
        <label className="text-sm text-stone-300" htmlFor="window">
          Recent window
        </label>
        <select
          id="window"
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={recentWindow}
          onChange={(event) => setRecentWindow(Number(event.target.value))}
        >
          {windows.map((windowSize) => (
            <option key={windowSize} value={windowSize}>
              Last {windowSize} matches
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <StatePanel
          variant="loading"
          title="Crunching Match Insights"
          description="Computing trends, volatility, and breakdowns from your local match data."
        />
      )}

      {error && <StatePanel variant="error" title="Insights Error" description={error} />}

      {!loading && !error && insights && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-stone-400">Recent Win Rate</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatNumber(insights.recent_form.win_rate, "%")}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                {insights.recent_form.wins}W / {insights.recent_form.losses}L /{" "}
                {insights.recent_form.draws}D
              </p>
            </div>
            <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-stone-400">Recent Avg ACS</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatNumber(insights.recent_form.avg_acs)}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Baseline: {formatNumber(insights.baseline_form.avg_acs)}
              </p>
            </div>
            <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-stone-400">Current Streak</p>
              <p className="mt-2 text-2xl font-semibold">
                {insights.streaks.current_streak_length} {insights.streaks.current_streak_type}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Longest W/L: {insights.streaks.longest_win_streak} /{" "}
                {insights.streaks.longest_loss_streak}
              </p>
            </div>
            <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-stone-400">Volatility</p>
              <p className="mt-2 text-2xl font-semibold capitalize">{insights.volatility.level}</p>
              <p className="mt-1 text-xs text-stone-400">
                Result switch rate: {formatNumber(insights.volatility.result_switch_rate, "%")}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-4">
            <h3 className="text-lg font-medium">Trend Summary</h3>
            <p className="mt-1 text-xs text-stone-400">
              Recent window: {insights.trend_summary.recent_window} matches vs baseline:{" "}
              {insights.trend_summary.baseline_window} matches
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {trendRows.map((row) => (
                <div
                  key={row.metric}
                  className="rounded border border-stone-700/60 bg-stone-950/30 p-3"
                >
                  <p className="text-sm text-stone-300">{metricLabels[row.metric] ?? row.metric}</p>
                  <p className={`mt-1 text-sm font-medium ${directionColor(row.direction)}`}>
                    {directionPrefix(row.delta)}
                    {formatNumber(row.delta)}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    Recent {formatNumber(row.recent)} vs Baseline {formatNumber(row.baseline)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <BreakdownTable title="Map Breakdown" rows={insights.map_breakdowns} />
            <BreakdownTable title="Agent Breakdown" rows={insights.agent_breakdowns} />
            <BreakdownTable title="Role Breakdown" rows={insights.role_breakdowns} />
          </div>
        </>
      )}
    </section>
  );
}
