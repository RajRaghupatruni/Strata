import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatePanel } from "../../components/StatePanel";
import { fetchHomeSummary, fetchMatches } from "../../services/api/client";
import type { HomeSummary, PatternHighlight } from "../../types/home";
import type { Match } from "../../types/match";

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

function formatWinRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatResult(result?: string | null): string {
  if (!result) return "Unscored";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function resultTone(result?: string | null): string {
  if (result === "win") return "chip-positive";
  if (result === "loss") return "chip-negative";
  return "";
}

function PatternReadout({
  label,
  pattern,
  tone = "neutral"
}: {
  label: string;
  pattern?: PatternHighlight | null;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass = tone === "positive" ? "tone-positive" : tone === "negative" ? "tone-negative" : "";

  return (
    <div className="surface-subtle p-4">
      <p className="label">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${toneClass}`}>{pattern?.label ?? "Insufficient data"}</p>
      <p className="section-copy">
        {pattern?.matches ?? 0} matches, {formatWinRate(pattern?.win_rate)} win rate
      </p>
    </div>
  );
}

function MatchRow({ match }: { match: Match }) {
  return (
    <article className="data-row p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="chip-row">
            <span className={`chip ${resultTone(match.result)}`}>{formatResult(match.result)}</span>
            <span className="chip">{match.map_name ?? "Unknown map"}</span>
            <span className="chip">{match.agent ?? "Unknown agent"}</span>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{formatDate(match.played_at)}</p>
        </div>
        <div className="flex items-end gap-5 text-right">
          <div>
            <p className="label">KDA</p>
            <p className="metric-value text-lg">
              {match.kills ?? "-"} / {match.deaths ?? "-"} / {match.assists ?? "-"}
            </p>
          </div>
          <div>
            <p className="label">ACS</p>
            <p className="metric-value text-lg">{match.acs ?? "N/A"}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuickLink({ to, children, primary = false }: { to: string; children: string; primary?: boolean }) {
  return (
    <Link to={to} className={`button ${primary ? "button-primary" : "button-secondary"}`}>
      {children}
    </Link>
  );
}

export function HomePage() {
  const [data, setData] = useState<HomeSummary | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summary, matchResponse] = await Promise.all([
          fetchHomeSummary(10),
          fetchMatches({ limit: 5, offset: 0 })
        ]);
        setData(summary);
        setRecentMatches(matchResponse.matches);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load home summary");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const reviewBacklog = useMemo(
    () => recentMatches.filter((match) => !match.review_note_count || match.review_note_count <= 0),
    [recentMatches]
  );

  if (loading) {
    return (
      <section className="page-stack">
        <StatePanel
          variant="loading"
          title="Assembling your command center"
          description="Pulling recent form, coaching focus, match history, and progress evidence into one view."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-stack">
        <StatePanel variant="error" title="Home data is unavailable" description={error} />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="page-stack">
        <StatePanel
          variant="empty"
          title="No home signal yet"
          description="Import matches or seed the local demo data to unlock the Strata command center."
        />
      </section>
    );
  }

  const currentPriority = data.coaching_summary?.priority_issue || data.current_focus_area || "Build the next evidence loop";
  const nextAction = data.coaching_summary?.next_action || data.next_review_suggestion || "Review the most recent match and tag one repeated issue.";
  const progressStatus = data.progress_highlight?.effectiveness_status || "Awaiting snapshot";

  return (
    <section className="page-stack">
      <div className="surface-strong panel-padding">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div>
            <p className="eyebrow">Current priority</p>
            <h1 className="mt-4 max-w-4xl text-[clamp(2.8rem,7vw,6.8rem)] font-[720] leading-[0.9] tracking-[0] text-[var(--text)]">
              {currentPriority}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-soft)]">
              {nextAction}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <QuickLink to="/review" primary>
                Start review
              </QuickLink>
              <QuickLink to="/coach">Open coaching plan</QuickLink>
              <QuickLink to="/matches">Browse matches</QuickLink>
            </div>
          </div>

          <div className="grid content-end gap-3">
            <div className="surface-subtle p-4">
              <p className="label">Recent form</p>
              <p className="mt-3 text-xl leading-8 text-[var(--text-soft)]">{data.recent_trend}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="surface-subtle p-4">
                <p className="label">Matches</p>
                <p className="metric-value metric-md mt-2">{data.counters.total_matches}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="label">Reviews</p>
                <p className="metric-value metric-md mt-2">{data.counters.total_review_notes}</p>
              </div>
            </div>
            <p className="microcopy">Updated {formatDate(data.generated_at)}</p>
          </div>
        </div>
      </div>

      <div className="two-column">
        <div className="surface panel-padding">
          <p className="eyebrow">Strongest positive trend</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PatternReadout label="Map edge" pattern={data.strongest_map} tone="positive" />
            <PatternReadout label="Agent edge" pattern={data.strongest_agent} tone="positive" />
          </div>
        </div>

        <div className="surface panel-padding">
          <p className="eyebrow">Biggest concern</p>
          <div className="mt-4 grid gap-3">
            <PatternReadout label="Map risk" pattern={data.weakest_map} tone="negative" />
            <PatternReadout label="Agent risk" pattern={data.weakest_agent} tone="negative" />
          </div>
        </div>
      </div>

      <div className="two-column">
        <div className="surface panel-padding">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Recent matches</p>
              <h2 className="section-title mt-2">Latest evidence entering the loop</h2>
            </div>
            <QuickLink to="/matches">View all</QuickLink>
          </div>
          <div className="data-list mt-5">
            {recentMatches.length === 0 && (
              <StatePanel
                variant="empty"
                title="No matches imported"
                description="Use the match import workflow to begin building deterministic performance history."
              />
            )}
            {recentMatches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="surface panel-padding">
            <p className="eyebrow">Review backlog</p>
            <p className="metric-value metric-lg mt-4">{reviewBacklog.length}</p>
            <p className="section-copy">
              Recent matches without notes. Strata gets sharper when each session leaves a trail of tagged decisions.
            </p>
            <div className="mt-5">
              <QuickLink to="/review">Tag issues</QuickLink>
            </div>
          </div>

          <div className="surface panel-padding">
            <p className="eyebrow">Progress status</p>
            <h2 className="section-title mt-3">{progressStatus}</h2>
            <p className="section-copy">
              {data.progress_highlight?.summary || "Generate a progress snapshot once you have before and after evidence."}
            </p>
            <p className="microcopy mt-4">
              Snapshot {data.progress_highlight?.snapshot_id ?? "N/A"} | {formatDate(data.progress_highlight?.snapshot_date)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
