import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { StatePanel } from "../../components/StatePanel";
import { fetchHomeSummary } from "../../services/api/client";
import type { HomeSummary, PatternHighlight } from "../../types/home";

const productPillars = [
  {
    title: "Data Integrity",
    description: "Official Riot match ingestion with deterministic mapping for repeatable analysis."
  },
  {
    title: "Coaching Brain",
    description: "Weighted local algorithm scores consistency, mechanics, discipline, and impact."
  },
  {
    title: "Privacy by Default",
    description: "Runs local-first. Optional AI layer is off until you explicitly enable it."
  }
];

const roadmapNow = [
  "Live Riot import by player Riot ID",
  "Smart assessment vector and recurring issue scoring",
  "Progress snapshots and recommendation tracking",
  "Modern app shell with responsive product navigation"
];

const roadmapNext = [
  "Matchup-specific drill recommendations per map + role",
  "Session templates with auto-generated warmup plans",
  "Trend overlays and richer interactive charts"
];

function formatDate(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatWinRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function PatternCard({
  title,
  pattern
}: {
  title: string;
  pattern?: PatternHighlight | null;
}) {
  return (
    <div className="strata-glass p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.19em] text-stone-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-stone-100">{pattern?.label ?? "N/A"}</p>
      <p className="mt-1 text-xs text-stone-400">
        {pattern?.matches ?? 0} matches | {formatWinRate(pattern?.win_rate)} win rate
      </p>
    </div>
  );
}

function CounterTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="strata-stat-tile">
      <p className="text-[0.66rem] uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-100">{value}</p>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-stone-200 transition hover:-translate-y-[1px] hover:border-amber-300/30 hover:bg-amber-300/10"
    >
      {label}
    </Link>
  );
}

export function HomePage() {
  const [data, setData] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchHomeSummary(10);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load home summary");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const counters = data?.counters;

  return (
    <section className="space-y-5">
      {loading && (
        <StatePanel
          variant="loading"
          title="Loading Command Center"
          description="Collecting your latest match, coaching, and progress signals."
        />
      )}

      {error && <StatePanel variant="error" title="Home Data Error" description={error} />}

      {!loading && data && (
        <>
          <div className="strata-glass strata-hero p-5 md:p-6">
            <div className="relative z-[1] grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Session Context</p>
                <p className="mt-2 text-lg font-medium text-stone-100">{data.current_rank_context}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-300">{data.recent_trend}</p>
                <p className="mt-3 text-xs text-stone-400">Updated: {formatDate(data.generated_at)}</p>
                <div className="strata-chip-row mt-4">
                  <span className="strata-chip">Focus: {data.current_focus_area ?? "N/A"}</span>
                  <span className="strata-chip">
                    Next Review: {data.next_review_suggestion ?? "Generate review signals"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <QuickLink to="/matches" label="Import & Explore Matches" />
                  <QuickLink to="/coach" label="Generate Coaching" />
                  <QuickLink to="/progress" label="Track Improvement" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CounterTile label="Matches" value={counters?.total_matches ?? 0} />
                <CounterTile label="Review Notes" value={counters?.total_review_notes ?? 0} />
                <CounterTile
                  label="Coaching Reports"
                  value={counters?.total_coaching_reports ?? 0}
                />
                <CounterTile
                  label="Progress Snapshots"
                  value={counters?.total_progress_snapshots ?? 0}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <PatternCard title="Strongest Map" pattern={data.strongest_map} />
            <PatternCard title="Weakest Map" pattern={data.weakest_map} />
            <PatternCard title="Strongest Agent" pattern={data.strongest_agent} />
            <PatternCard title="Weakest Agent" pattern={data.weakest_agent} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="strata-glass p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-400">Coaching Summary</p>
                <p className="mt-2 text-sm text-stone-200">
                  Priority: {data.coaching_summary?.priority_issue ?? "No report yet."}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  Next action: {data.coaching_summary?.next_action ?? "Generate a coaching report."}
                </p>
                <p className="mt-2 text-xs text-stone-400">
                  Generated: {formatDate(data.coaching_summary?.generated_at)}
                </p>
              </div>

              <div className="strata-glass p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-400">Progress Highlight</p>
                <p className="mt-2 text-sm text-stone-200">
                  {data.progress_highlight?.summary ?? "No progress snapshot yet."}
                </p>
                <p className="mt-2 text-xs text-stone-400">
                  Status: {data.progress_highlight?.effectiveness_status ?? "N/A"} | Snapshot: #
                  {data.progress_highlight?.snapshot_id ?? "N/A"} | Date:{" "}
                  {formatDate(data.progress_highlight?.snapshot_date)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="strata-glass p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-400">
                  Product Pillars
                </p>
                <div className="mt-3 space-y-3">
                  {productPillars.map((pillar) => (
                    <div key={pillar.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-sm font-semibold text-stone-100">{pillar.title}</p>
                      <p className="mt-1 text-xs text-stone-300">{pillar.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="strata-glass p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-400">Quick Links</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.quick_links.map((link) => (
                    <QuickLink
                      key={link}
                      to={link}
                      label={link.replace("/", "").replace(/^./, (char) => char.toUpperCase())}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="strata-glass p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-400">Live Now</p>
              <div className="mt-3 space-y-2">
                {roadmapNow.map((item) => (
                  <p
                    key={item}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="strata-glass p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-stone-400">Planned Upgrades</p>
              <div className="mt-3 space-y-2">
                {roadmapNext.map((item) => (
                  <p
                    key={item}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
