import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatePanel } from "../../components/StatePanel";
import { AgentAvatar, GameLabel, MetricIcon } from "../../components/GameVisual";
import { fetchHomeSummary, fetchLatestProgressSnapshot, fetchMatches, fetchRecommendations, fetchRecurringIssues } from "../../services/api/client";
import type { HomeSummary } from "../../types/home";
import type { Match } from "../../types/match";
import type { Recommendation } from "../../types/recommendation";
import type { ProgressSnapshot } from "../../types/progress";
import type { RecurringIssue } from "../../types/review";

function dateLabel(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function resultLabel(value?: string | null) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unscored"; }
function resultClass(value?: string | null) { return value === "win" ? "status-pill status-pill-positive" : value === "loss" ? "status-pill status-pill-negative" : "status-pill"; }
function metric(value: number | null | undefined, digits = 0) { return value === null || value === undefined || Number.isNaN(value) ? "—" : value.toFixed(digits); }
function titleCase(value: string) { return value.replace(/[_:-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function TrendChart({ matches }: { matches: Match[] }) {
  const points = [...matches].reverse().filter((match) => typeof match.acs === "number");
  if (points.length < 2) return <div className="chart-empty">Trend appears once two scored matches are available.</div>;
  const max = Math.max(...points.map((match) => match.acs ?? 0), 1);
  const min = Math.min(...points.map((match) => match.acs ?? 0));
  const range = Math.max(1, max - min);
  const xAt = (index: number) => 36 + (index * 688) / Math.max(points.length - 1, 1);
  const yAt = (value: number) => 154 - ((value - min) / range) * 112;
  const line = points.map((match, index) => `${xAt(index)},${yAt(match.acs ?? min)}`).join(" ");
  return <div className="trend-chart" role="img" aria-label="Average combat score over recent matches"><svg viewBox="0 0 760 190" preserveAspectRatio="none">{[42, 82, 122, 162].map((y) => <line key={y} x1="36" x2="724" y1={y} y2={y} className="chart-grid" />)}{points.map((match, index) => { const height = ((match.acs ?? 0) / max) * 82; return <rect key={`bar-${match.id}`} x={xAt(index) - 8} y={164 - height} width="16" height={height} rx="3" className={match.result === "win" ? "chart-bar chart-bar-win" : "chart-bar chart-bar-loss"}><title>{dateLabel(match.played_at)} · ACS {match.acs} · {resultLabel(match.result)}</title></rect>; })}<polyline points={line} className="chart-line" />{points.map((match, index) => <circle key={match.id} cx={xAt(index)} cy={yAt(match.acs ?? min)} r="3.5" className="chart-dot"><title>{dateLabel(match.played_at)} · ACS {match.acs} · {resultLabel(match.result)}</title></circle>)}</svg><div className="chart-axis"><span>{dateLabel(points[0].played_at)}</span><span>ACS · wins and losses</span><span>{dateLabel(points[points.length - 1].played_at)}</span></div></div>;
}

function Kpi({ label, value, delta, note, tone = "", icon }: { label: string; value: string; delta?: string; note: string; tone?: string; icon: "win" | "acs" | "kd" | "rr" }) {
  return <article className="kpi-card"><MetricIcon metric={icon} /><div><p className="label">{label}</p><p className={`kpi-value ${tone}`}>{value}</p>{delta && <span className={`delta-pill ${tone === "tone-negative" ? "delta-negative" : ""}`}>{delta}</span>}<p className="kpi-note">{note}</p></div></article>;
}

function TopAgents({ matches }: { matches: Match[] }) {
  const grouped = new Map<string, { matches: number; wins: number; acs: number[] }>();
  matches.forEach((match) => { const name = match.agent?.trim(); if (!name) return; const current = grouped.get(name) ?? { matches: 0, wins: 0, acs: [] }; current.matches += 1; if (match.result === "win") current.wins += 1; if (typeof match.acs === "number") current.acs.push(match.acs); grouped.set(name, current); });
  const agents = [...grouped.entries()].map(([name, value]) => ({ name, ...value, winRate: value.matches ? (value.wins / value.matches) * 100 : 0, averageAcs: value.acs.length ? value.acs.reduce((a, b) => a + b, 0) / value.acs.length : null })).sort((a, b) => b.winRate - a.winRate || (b.averageAcs ?? 0) - (a.averageAcs ?? 0)).slice(0, 4);
  if (!agents.length) return null;
  return <section className="dashboard-card top-agents-card"><div className="card-heading"><div><p className="eyebrow">Agent pool</p><h2>Top agents</h2></div><span className="chip">Recent</span></div><div className="top-agents-list">{agents.map((agent) => <div className="top-agent-row" key={agent.name}><AgentAvatar agent={agent.name} /><div className="top-agent-copy"><strong>{agent.name}</strong><small>{agent.matches} match{agent.matches === 1 ? "" : "es"} · {agent.averageAcs === null ? "ACS N/A" : `ACS ${agent.averageAcs.toFixed(0)}`}</small><span className="agent-meter"><i style={{ width: `${Math.max(8, Math.min(agent.winRate, 100))}%` }} /></span></div><b>{agent.winRate.toFixed(0)}%</b></div>)}</div></section>;
}

function MatchTable({ matches }: { matches: Match[] }) {
  return <div className="match-table" role="table" aria-label="Recent matches"><div className="match-table-head" role="row"><span>Result</span><span>Map</span><span>Agent</span><span>ACS</span><span>K / D / A</span><span>RR</span><span>Date</span></div>{matches.slice(0, 5).map((match) => <Link to={`/matches?match_id=${match.id}`} className="match-table-row" key={match.id} role="row"><span><b className={resultClass(match.result)}>{resultLabel(match.result)}</b></span><span><GameLabel kind="map" value={match.map_name} /></span><span><GameLabel kind="agent" value={match.agent} /></span><span className="numeric">{metric(match.acs)}</span><span className="numeric">{match.kills ?? "—"} / {match.deaths ?? "—"} / {match.assists ?? "—"}</span><span className={match.rr_change && match.rr_change > 0 ? "tone-positive" : match.rr_change && match.rr_change < 0 ? "tone-negative" : ""}>{match.rr_change === null || match.rr_change === undefined ? "—" : `${match.rr_change > 0 ? "+" : ""}${match.rr_change}`}</span><span className="muted">{dateLabel(match.played_at)}</span></Link>)}</div>;
}

export function HomePage() {
  const [data, setData] = useState<HomeSummary | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [issues, setIssues] = useState<RecurringIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchHomeSummary(10), fetchMatches({ limit: 10, offset: 0 }), fetchRecommendations({ status: "active", limit: 1 }), fetchLatestProgressSnapshot(), fetchRecurringIssues()]).then(([summary, matchResponse, recommendationResponse, progressResponse, issueResponse]) => {
      setData(summary); setMatches(matchResponse.matches); setRecommendation(recommendationResponse.recommendations[0] ?? null); setProgress(progressResponse.snapshot); setIssues(issueResponse.issues ?? []);
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load the command center")).finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const scored = matches.filter((match) => match.result === "win" || match.result === "loss");
    const wins = scored.filter((match) => match.result === "win").length;
    const acs = matches.filter((match) => typeof match.acs === "number").map((match) => match.acs as number);
    const deaths = matches.reduce((sum, match) => sum + (match.deaths ?? 0), 0);
    const kills = matches.reduce((sum, match) => sum + (match.kills ?? 0), 0);
    const rr = matches.reduce((sum, match) => sum + (match.rr_change ?? 0), 0);
    return { winRate: scored.length ? `${((wins / scored.length) * 100).toFixed(1)}%` : "—", acs: acs.length ? `${(acs.reduce((a, b) => a + b, 0) / acs.length).toFixed(0)}` : "—", kd: deaths ? (kills / deaths).toFixed(2) : "—", rr: matches.some((match) => match.rr_change !== null && match.rr_change !== undefined) ? `${rr > 0 ? "+" : ""}${rr}` : "—" };
  }, [matches]);

  if (loading) return <section className="page-stack"><StatePanel variant="loading" title="Assembling your performance view" description="Reading recent matches, coaching focus, and recommendation evidence." /></section>;
  if (error || !data) return <section className="page-stack"><StatePanel variant={error ? "error" : "empty"} title={error ? "Home data is unavailable" : "No home signal yet"} description={error ?? "Seed the local demo dataset to build your first evidence loop."} /></section>;

  const rawPriority = data.coaching_summary?.priority_issue || data.current_focus_area || "Build the next evidence loop";
  const priority = rawPriority.replace(/`/g, "").replace(/^Assessment flags\s+(.+?)\s+as your weakest performance dimension right now\.?$/i, "$1 is your biggest performance gap right now.");
  const rationale = (data.coaching_summary?.next_action || data.next_review_suggestion || data.recent_trend).replace(/`/g, "");
  const primaryIssue = issues[0];
  const evidence = progress?.recommendation_effectiveness;
  const level = evidence?.evidence_level ?? "insufficient_data";
  const outcome = evidence?.outcome ?? "inconclusive";
  return <section className="home-page page-stack">
    <header className="home-topbar"><div><p className="home-kicker">Performance intelligence</p><h1 className="page-title">Home</h1><p className="page-description">Your performance. Sharper decisions. Real improvement.</p></div><div className="home-topbar-meta"><span className="range-control">Last 30 days⌄</span><span className="updated"><i />Demo dataset · {dateLabel(data.generated_at)}</span></div></header>
    <section className="priority-hero surface-strong"><div className="priority-copy"><p className="eyebrow accent-label">Current priority</p><h2><span className="accent-word">{priority.split(" ")[0]}</span>{priority.split(" ").slice(1).length ? ` ${priority.split(" ").slice(1).join(" ")}` : ""}</h2><p>{rationale}</p><div className="hero-actions"><Link className="button button-primary" to="/insights">View evidence <span aria-hidden="true">→</span></Link><Link className="button button-secondary" to="/review">Review plan</Link></div></div><div className="priority-visual" aria-hidden="true"><span className="visual-grid" /><span className="visual-shard shard-one" /><span className="visual-shard shard-two" /><span className="visual-shard shard-three" />{data.strongest_agent && <div className="hero-agent"><AgentAvatar agent={data.strongest_agent.label} size="md" /><span>{data.strongest_agent.label} · strongest recent fit</span></div>}<span className="visual-caption">Consistency turns good players into great ones.</span></div></section>
    <div className="kpi-grid"><Kpi icon="win" label="Win Rate" value={kpis.winRate} delta="Recent form" note="Across recent scored matches" tone="tone-positive" /><Kpi icon="acs" label="ACS" value={kpis.acs} delta="Combat score" note="Average recent ACS" /><Kpi icon="kd" label="K / D" value={kpis.kd} delta="Kill efficiency" note="Kills divided by deaths" tone={kpis.kd !== "—" ? (Number(kpis.kd) >= 1 ? "tone-positive" : "tone-negative") : ""} /><Kpi icon="rr" label="RR Change" value={kpis.rr === "—" ? "N/A" : kpis.rr} delta={kpis.rr === "—" ? undefined : "Recent total"} note={kpis.rr === "—" ? "Not available in this demo dataset" : "Sum of available RR changes"} tone={kpis.rr.startsWith("+") ? "tone-positive" : kpis.rr.startsWith("-") ? "tone-negative" : ""} /></div>
    <div className="home-dashboard-grid"><div className="home-primary-column"><section className="dashboard-card chart-card"><div className="card-heading"><div><p className="eyebrow">Performance trend</p><h2>Match performance over time</h2></div><span className="chip chip-accent">ACS</span></div><TrendChart matches={matches} /><div className="chart-legend"><span><i className="legend-line" />ACS</span><span><i className="legend-win" />Win</span><span><i className="legend-loss" />Loss</span></div></section><section className="dashboard-card recent-card"><div className="card-heading"><div><p className="eyebrow">Recent matches</p><h2>Latest evidence entering the loop</h2></div><Link className="text-link" to="/matches">View all →</Link></div><MatchTable matches={matches} /></section></div>
      <div className="home-support-column"><section className="dashboard-card issue-card"><div className="card-heading"><div><p className="eyebrow">Recurring issue</p><h2>{primaryIssue ? titleCase(primaryIssue.category) : data.current_focus_area ?? "No recurring issue"}</h2></div><span className="chip chip-negative">Most frequent</span></div><p className="section-copy">{primaryIssue ? `Detected across ${primaryIssue.occurrences} reviewed occurrences.` : "Review notes will surface recurring issues here."}</p><Link className="text-link" to="/review">View evidence →</Link></section>
      <TopAgents matches={matches} />
      <section className="dashboard-card recommendation-card-home">{recommendation ? <><div className="card-heading"><div><p className="eyebrow">Active recommendation</p><h2>{recommendation.title}</h2></div><span className="chip chip-accent">{titleCase(recommendation.status)}</span></div><p className="section-copy">{recommendation.action}</p>{recommendation.target_issue_category && <p className="microcopy">Target issue · {titleCase(recommendation.target_issue_category)}</p>}<Link className="button button-primary compact-button" to="/coach">View in Coach <span aria-hidden="true">→</span></Link></> : <><p className="eyebrow">Active recommendation</p><h2 className="empty-card-title">No active recommendation</h2><p className="section-copy">Generate a coaching report to create a persisted action for the next session.</p><Link className="text-link" to="/coach">Open Coach →</Link></>}</section>
      <section className="dashboard-card effectiveness-card"><div className="card-heading"><div><p className="eyebrow">Recommendation effectiveness</p><h2>{evidence?.recommendation ?? recommendation?.title ?? "Evidence checkpoint"}</h2></div><Link className="text-link" to="/progress">Details →</Link></div>{evidence ? <><div className="evidence-flow"><div><span>Before</span><strong>{evidence.before_value === null ? "—" : metric(evidence.before_value, 1)}</strong><small>{evidence.before_sample_size} matches</small></div><b>→</b><div><span>After</span><strong className="tone-positive">{evidence.after_value === null ? "—" : metric(evidence.after_value, 1)}</strong><small>{evidence.after_sample_size} matches</small></div><div className="effect-delta"><strong>{evidence.delta === null ? "—" : `${evidence.delta > 0 ? "+" : ""}${metric(evidence.delta, 1)}`}</strong><small>delta</small></div></div><div className="chip-row"><span className={`chip ${level === "supported" ? "chip-positive" : level === "directional" ? "chip-accent" : ""}`}>{titleCase(level)}</span><span className={`chip ${outcome === "effective" ? "chip-positive" : outcome === "ineffective" ? "chip-negative" : ""}`}>{titleCase(outcome)}</span></div></> : <p className="section-copy">Generate a recommendation progress snapshot to compare before and after evidence.</p>}</section>
      <section className="dashboard-card insights-card"><div className="card-heading"><div><p className="eyebrow">Insights</p><h2>Signals worth your attention</h2></div><Link className="text-link" to="/insights">Explore →</Link></div><div className="insight-list"><p><span className="insight-mark">↗</span>{data.recent_trend}</p>{data.strongest_map && <p><span className="insight-mark">◈</span>{data.strongest_map.label} is your strongest map ({data.strongest_map.matches} matches).</p>}{data.weakest_map && <p><span className="insight-mark">!</span>{data.weakest_map.label} is the clearest map-level opportunity.</p>}</div></section></div></div>
  </section>;
}
