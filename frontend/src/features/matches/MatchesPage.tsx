import { FormEvent, useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { fetchMatches, importMatchesFromRiot } from "../../services/api/client";
import type { Match, MatchFilters } from "../../types/match";

const resultOptions = ["", "win", "loss", "draw"];
const riotRegions = ["na", "eu", "ap", "kr", "latam", "br"];

function formatPlayedAt(value?: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function hasValue(value: string | number | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "number") return true;
  return value.trim() !== "";
}

export function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
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

  async function load(currentFilters: MatchFilters) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatches(currentFilters);
      setMatches(data.matches);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({});
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned: MatchFilters = {};
    if (filters.map?.trim()) cleaned.map = filters.map.trim();
    if (filters.agent?.trim()) cleaned.agent = filters.agent.trim();
    if (filters.role?.trim()) cleaned.role = filters.role.trim();
    if (filters.result?.trim()) cleaned.result = filters.result.trim();
    if (filters.start_date?.trim()) cleaned.start_date = filters.start_date.trim();
    if (filters.end_date?.trim()) cleaned.end_date = filters.end_date.trim();
    void load(cleaned);
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
      await load({});
    } catch (err) {
      setRiotError(err instanceof Error ? err.message : "Failed to import from Riot.");
    } finally {
      setRiotLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Data Hub"
        title="Matches"
        description="Browse imported history with quick filters and use it as your base review queue."
      />

      <form
        className="grid gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 md:grid-cols-5"
        onSubmit={onImportRiot}
      >
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm md:col-span-2"
          placeholder="Riot Game Name (e.g. TenZ)"
          value={riotGameName}
          onChange={(event) => setRiotGameName(event.target.value)}
        />
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          placeholder="Tag (e.g. NA1)"
          value={riotTagLine}
          onChange={(event) => setRiotTagLine(event.target.value)}
        />
        <select
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={riotRegion}
          onChange={(event) => setRiotRegion(event.target.value)}
        >
          {riotRegions.map((region) => (
            <option key={region} value={region}>
              {region.toUpperCase()}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="w-20 rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
            type="number"
            min={1}
            max={50}
            value={riotMaxMatches}
            onChange={(event) => setRiotMaxMatches(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
          />
          <button
            className="rounded bg-amber-200/20 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30 disabled:opacity-50"
            type="submit"
            disabled={riotLoading}
          >
            {riotLoading ? "Importing..." : "Import Riot"}
          </button>
        </div>
      </form>

      {riotError && <StatePanel variant="error" title="Riot Import Error" description={riotError} />}
      {riotSuccess && (
        <StatePanel variant="success" title="Riot Import Complete" description={riotSuccess} />
      )}

      <form
        className="grid gap-3 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4 md:grid-cols-3"
        onSubmit={onSubmit}
      >
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          placeholder="Map (e.g. Ascent)"
          value={filters.map}
          onChange={(event) => setFilters((prev) => ({ ...prev, map: event.target.value }))}
        />
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          placeholder="Agent (e.g. Jett)"
          value={filters.agent}
          onChange={(event) => setFilters((prev) => ({ ...prev, agent: event.target.value }))}
        />
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          placeholder="Role (e.g. Duelist)"
          value={filters.role}
          onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
        />
        <select
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          value={filters.result}
          onChange={(event) => setFilters((prev) => ({ ...prev, result: event.target.value }))}
        >
          {resultOptions.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All results"}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          type="date"
          value={filters.start_date}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, start_date: event.target.value }))
          }
        />
        <input
          className="rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
          type="date"
          value={filters.end_date}
          onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
        />
        <div className="flex items-center gap-2 md:col-span-3">
          <button
            className="rounded bg-amber-200/20 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30"
            type="submit"
          >
            Apply Filters
          </button>
          <button
            className="rounded bg-stone-700 px-3 py-2 text-sm text-stone-100 transition hover:bg-stone-600"
            type="button"
            onClick={() => {
              const reset = {
                map: "",
                agent: "",
                role: "",
                result: "",
                start_date: "",
                end_date: ""
              };
              setFilters(reset);
              void load({});
            }}
          >
            Reset
          </button>
          <span className="text-xs text-stone-400">
            {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
          </span>
        </div>
      </form>

      <div className="text-sm text-stone-300">
        {loading ? "Loading matches..." : `Showing ${matches.length} of ${total} total matches`}
      </div>

      {error && <StatePanel variant="error" title="Matches Load Error" description={error} />}

      {!loading && !error && matches.length === 0 && (
        <StatePanel
          variant="empty"
          title="No Matches Found"
          description="Import matches with `POST /api/v1/matches/import` and then re-apply your filters."
        />
      )}

      {!loading && !error && matches.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-stone-700/60">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-900/70 text-stone-300">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Map</th>
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">K / D / A</th>
                <th className="px-3 py-2 font-medium">ACS</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr key={match.id} className="border-t border-stone-800">
                  <td className="px-3 py-2 text-stone-200">{formatPlayedAt(match.played_at)}</td>
                  <td className="px-3 py-2 text-stone-200">{match.map_name ?? "N/A"}</td>
                  <td className="px-3 py-2 text-stone-200">{match.agent ?? "N/A"}</td>
                  <td className="px-3 py-2 text-stone-200">{match.role ?? "N/A"}</td>
                  <td className="px-3 py-2 text-stone-200">{match.result ?? "N/A"}</td>
                  <td className="px-3 py-2 text-stone-200">
                    {match.kills ?? "-"} / {match.deaths ?? "-"} / {match.assists ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-stone-200">{match.acs ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
