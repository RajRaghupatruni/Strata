import { FormEvent, useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { fetchMatches, importMatchesFromRiot } from "../../services/api/client";
import type { Match, MatchFilters } from "../../types/match";

const resultOptions = ["", "win", "loss", "draw"];
const riotRegions = ["na", "eu", "ap", "kr", "latam", "br"];
const pageSize = 12;

function formatPlayedAt(value?: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatShortResult(result?: string | null): string {
  if (!result) return "Unscored";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function resultChip(result?: string | null): string {
  if (result === "win") return "chip-positive";
  if (result === "loss") return "chip-negative";
  return "";
}

function hasValue(value: string | number | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "number") return true;
  return value.trim() !== "";
}

function MatchSkeleton() {
  return (
    <div className="data-list">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="surface-subtle p-4">
          <div className="skeleton h-5 w-44" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  selected,
  onSelect
}: {
  match: Match;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`data-row w-full p-4 text-left ${selected ? "data-row-selected" : ""}`}
      onClick={onSelect}
      aria-label={`Inspect match #${match.id}${selected ? ", currently selected" : ""}`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="chip-row">
            <span className={`chip ${resultChip(match.result)}`}>{formatShortResult(match.result)}</span>
            <span className="chip chip-accent">{match.map_name ?? "Unknown map"}</span>
            <span className="chip">{match.agent ?? "Unknown agent"}</span>
            <span className="chip">{match.role ?? "No role"}</span>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{formatPlayedAt(match.played_at)}</p>
        </div>

        <div className="grid grid-cols-4 gap-4 text-right max-sm:text-left">
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
          <div>
            <p className="label">ADR</p>
            <p className="metric-value text-lg">{match.adr ?? "N/A"}</p>
          </div>
          <div>
            <p className="label">Review</p>
            <p className="metric-value text-lg">{match.review_note_count ?? 0}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function MatchInspector({ match }: { match?: Match }) {
  if (!match) {
    return (
      <div className="surface panel-padding">
        <p className="eyebrow">Match inspector</p>
        <h2 className="section-title mt-3">Select a match</h2>
        <p className="section-copy">Use the list to inspect scoreline, session, rank context, and review readiness.</p>
      </div>
    );
  }

  return (
    <aside className="surface panel-padding lg:sticky lg:top-5">
      <p className="eyebrow">Match inspector</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`chip ${resultChip(match.result)}`}>{formatShortResult(match.result)}</span>
        <span className="chip chip-accent">Match #{match.id}</span>
      </div>
      <h2 className="section-title mt-5">
        {match.map_name ?? "Unknown map"} with {match.agent ?? "unknown agent"}
      </h2>
      <p className="section-copy">{formatPlayedAt(match.played_at)}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="surface-subtle p-3">
          <p className="label">Scoreline</p>
          <p className="metric-value text-xl">{match.scoreline ?? "N/A"}</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">Rank</p>
          <p className="metric-value text-xl">{match.rank_at_time ?? "N/A"}</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">Headshot</p>
          <p className="metric-value text-xl">{match.hs_percent ?? "N/A"}%</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">RR</p>
          <p className="metric-value text-xl">{match.rr_change ?? "N/A"}</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">Session</p>
          <p className="metric-value text-xl">{match.session_id ?? "N/A"}</p>
        </div>
        <div className="surface-subtle p-3">
          <p className="label">Mode</p>
          <p className="metric-value text-xl">{match.mode ?? "N/A"}</p>
        </div>
      </div>

      <div className="mt-5 surface-subtle p-4">
        <p className="label">Review status</p>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          {(match.review_note_count ?? 0) > 0
            ? `${match.review_note_count} note${match.review_note_count === 1 ? "" : "s"} captured.`
            : "No review notes yet. This match can still teach you something."}
        </p>
      </div>
    </aside>
  );
}

export function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riotError, setRiotError] = useState<string | null>(null);
  const [riotSuccess, setRiotSuccess] = useState<string | null>(null);
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotGameName, setRiotGameName] = useState("");
  const [riotTagLine, setRiotTagLine] = useState("");
  const [riotRegion, setRiotRegion] = useState("na");
  const [riotMaxMatches, setRiotMaxMatches] = useState(10);
  const [filters, setFilters] = useState<MatchFilters>({
    map: "",
    agent: "",
    role: "",
    result: "",
    start_date: "",
    end_date: ""
  });

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => hasValue(value)).length,
    [filters]
  );

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? matches[0],
    [matches, selectedMatchId]
  );

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function cleanedFilters(nextOffset = offset): MatchFilters {
    const cleaned: MatchFilters = { limit: pageSize, offset: nextOffset };
    if (filters.map?.trim()) cleaned.map = filters.map.trim();
    if (filters.agent?.trim()) cleaned.agent = filters.agent.trim();
    if (filters.role?.trim()) cleaned.role = filters.role.trim();
    if (filters.result?.trim()) cleaned.result = filters.result.trim();
    if (filters.start_date?.trim()) cleaned.start_date = filters.start_date.trim();
    if (filters.end_date?.trim()) cleaned.end_date = filters.end_date.trim();
    return cleaned;
  }

  async function load(currentFilters: MatchFilters) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatches(currentFilters);
      setMatches(data.matches);
      setTotal(data.total);
      setSelectedMatchId(data.matches[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({ limit: pageSize, offset: 0 });
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    void load(cleanedFilters(0));
  }

  async function onImportRiot(event: FormEvent) {
    event.preventDefault();
    setRiotError(null);
    setRiotSuccess(null);

    if (!riotGameName.trim() || !riotTagLine.trim()) {
      setRiotError("Riot Game Name and Tag Line are required.");
      return;
    }

    setRiotLoading(true);
    try {
      const result = await importMatchesFromRiot({
        game_name: riotGameName.trim(),
        tag_line: riotTagLine.trim(),
        region: riotRegion,
        max_matches: riotMaxMatches
      });
      setRiotSuccess(
        `Imported ${result.inserted} matches (${result.skipped_duplicates} duplicates skipped) for ${result.game_name}#${result.tag_line}.`
      );
      setOffset(0);
      await load({ limit: pageSize, offset: 0 });
    } catch (err) {
      setRiotError(err instanceof Error ? err.message : "Failed to import from Riot.");
    } finally {
      setRiotLoading(false);
    }
  }

  function goToPage(nextOffset: number) {
    setOffset(nextOffset);
    void load(cleanedFilters(nextOffset));
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Match intelligence"
        title="Matches"
        description="Scan sessions quickly, spot review gaps, and inspect the match evidence behind every Strata recommendation."
      />

      <form className="surface panel-padding" onSubmit={onImportRiot}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="field-label min-w-[220px] flex-1">
            Riot name
            <input className="field" placeholder="TenZ" value={riotGameName} onChange={(event) => setRiotGameName(event.target.value)} />
          </label>
          <label className="field-label w-32">
            Tag
            <input className="field" placeholder="NA1" value={riotTagLine} onChange={(event) => setRiotTagLine(event.target.value)} />
          </label>
          <label className="field-label w-28">
            Region
            <select className="select" value={riotRegion} onChange={(event) => setRiotRegion(event.target.value)}>
              {riotRegions.map((region) => (
                <option key={region} value={region}>{region.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label className="field-label w-28">
            Limit
            <input
              className="field"
              type="number"
              min={1}
              max={50}
              value={riotMaxMatches}
              onChange={(event) => setRiotMaxMatches(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={riotLoading}>
            {riotLoading ? "Importing" : "Import Riot"}
          </button>
        </div>
      </form>

      {riotError && <StatePanel variant="error" title="Riot import failed" description={riotError} />}
      {riotSuccess && <StatePanel variant="success" title="Riot import complete" description={riotSuccess} />}

      <form className="control-bar" onSubmit={onSubmit}>
        <label className="field-label min-w-[150px] flex-1">
          Map
          <input className="field" placeholder="Ascent" value={filters.map} onChange={(event) => setFilters((prev) => ({ ...prev, map: event.target.value }))} />
        </label>
        <label className="field-label min-w-[150px] flex-1">
          Agent
          <input className="field" placeholder="Jett" value={filters.agent} onChange={(event) => setFilters((prev) => ({ ...prev, agent: event.target.value }))} />
        </label>
        <label className="field-label min-w-[150px] flex-1">
          Role
          <input className="field" placeholder="Duelist" value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))} />
        </label>
        <label className="field-label min-w-[150px]">
          Result
          <select className="select" value={filters.result} onChange={(event) => setFilters((prev) => ({ ...prev, result: event.target.value }))}>
            {resultOptions.map((option) => (
              <option key={option || "all"} value={option}>{option || "All results"}</option>
            ))}
          </select>
        </label>
        <label className="field-label min-w-[150px]">
          From
          <input
            className="field"
            type="date"
            value={filters.start_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
          />
        </label>
        <label className="field-label min-w-[150px]">
          To
          <input
            className="field"
            type="date"
            value={filters.end_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
          />
        </label>
        <button className="button button-secondary" type="submit">Apply</button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            const reset = { map: "", agent: "", role: "", result: "", start_date: "", end_date: "" };
            setFilters(reset);
            setOffset(0);
            void load({ limit: pageSize, offset: 0 });
          }}
        >
          Reset
        </button>
        <span className="chip">{activeFilterCount} active</span>
      </form>

      {error && <StatePanel variant="error" title="Matches failed to load" description={error} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="surface panel-padding">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Match list</p>
              <p className="section-copy">
                {loading ? "Loading matches" : `Showing ${matches.length} of ${total} matches`}
              </p>
            </div>
            <div className="chip">Page {currentPage} of {totalPages}</div>
          </div>

          <div className="mt-5">
            {loading && <MatchSkeleton />}
            {!loading && !error && matches.length === 0 && (
              <StatePanel
                variant="empty"
                title="No matches found"
                description="Adjust filters or import matches to populate the performance history."
              />
            )}
            {!loading && !error && matches.length > 0 && (
              <div className="data-list">
                {matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    selected={selectedMatch?.id === match.id}
                    onSelect={() => setSelectedMatchId(match.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              className="button button-secondary"
              type="button"
              disabled={offset <= 0 || loading}
              onClick={() => goToPage(Math.max(0, offset - pageSize))}
            >
              Previous
            </button>
            <p className="microcopy">Fast list browsing keeps the review queue moving.</p>
            <button
              className="button button-secondary"
              type="button"
              disabled={offset + pageSize >= total || loading}
              onClick={() => goToPage(offset + pageSize)}
            >
              Next
            </button>
          </div>
        </div>

        <MatchInspector match={selectedMatch} />
      </div>
    </section>
  );
}
