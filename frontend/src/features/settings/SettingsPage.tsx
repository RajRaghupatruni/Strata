import { FormEvent, useEffect, useState } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { fetchUserProfile, updateUserProfile } from "../../services/api/client";
import type { UserProfileInput } from "../../types/settings";

type FormState = {
  displayName: string;
  targetRank: string;
  preferredAgentsRaw: string;
  preferredRolesRaw: string;
  knownWeakAreasRaw: string;
  improvementPrioritiesRaw: string;
  personalNotes: string;
};

const emptyForm: FormState = {
  displayName: "",
  targetRank: "",
  preferredAgentsRaw: "",
  preferredRolesRaw: "",
  knownWeakAreasRaw: "",
  improvementPrioritiesRaw: "",
  personalNotes: ""
};

function csvToList(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function listToCsv(values: string[]): string {
  return values.join(", ");
}

export function SettingsPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchUserProfile();
        setForm({
          displayName: profile.display_name ?? "",
          targetRank: profile.target_rank ?? "",
          preferredAgentsRaw: listToCsv(profile.preferred_agents ?? []),
          preferredRolesRaw: listToCsv(profile.preferred_roles ?? []),
          knownWeakAreasRaw: listToCsv(profile.known_weak_areas ?? []),
          improvementPrioritiesRaw: listToCsv(profile.improvement_priorities ?? []),
          personalNotes: profile.personal_notes ?? ""
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    const payload: UserProfileInput = {
      display_name: form.displayName.trim(),
      target_rank: form.targetRank.trim(),
      preferred_agents: csvToList(form.preferredAgentsRaw),
      preferred_roles: csvToList(form.preferredRolesRaw),
      known_weak_areas: csvToList(form.knownWeakAreasRaw),
      improvement_priorities: csvToList(form.improvementPrioritiesRaw),
      personal_notes: form.personalNotes.trim()
    };

    setSaving(true);
    try {
      const updated = await updateUserProfile(payload);
      setSuccess(`Saved profile for ${updated.display_name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Personal Context"
        title="Settings"
        description="Set your profile context so all recommendations stay aligned with your ranked goals."
      />

      {loading && (
        <StatePanel
          variant="loading"
          title="Loading Profile"
          description="Fetching your saved personal context and preferences."
        />
      )}

      {error && <StatePanel variant="error" title="Settings Error" description={error} />}

      {success && <StatePanel variant="success" title="Saved" description={success} />}

      {!loading && (
        <form
          className="space-y-4 rounded-lg border border-stone-700/60 bg-stone-900/40 p-4"
          onSubmit={onSubmit}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
                Display Name
              </label>
              <input
                className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
                value={form.displayName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, displayName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
                Target Rank
              </label>
              <input
                className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
                placeholder="e.g. Ascendant 2"
                value={form.targetRank}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, targetRank: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
              Preferred Agents (comma-separated)
            </label>
            <input
              className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="Omen, Sova"
              value={form.preferredAgentsRaw}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, preferredAgentsRaw: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
              Preferred Roles (comma-separated)
            </label>
            <input
              className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="Controller, Initiator"
              value={form.preferredRolesRaw}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, preferredRolesRaw: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
              Known Weak Areas (comma-separated)
            </label>
            <input
              className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="early_death, utility_timing"
              value={form.knownWeakAreasRaw}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, knownWeakAreasRaw: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
              Improvement Priorities (comma-separated)
            </label>
            <input
              className="w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="first_death_control, late_round_comms"
              value={form.improvementPrioritiesRaw}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, improvementPrioritiesRaw: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.15em] text-stone-400">
              Personal Notes
            </label>
            <textarea
              className="min-h-[120px] w-full rounded border border-stone-700 bg-stone-800/70 px-3 py-2 text-sm"
              placeholder="Add context about habits, goals, or constraints."
              value={form.personalNotes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, personalNotes: event.target.value }))
              }
            />
          </div>

          <button
            className="rounded bg-amber-200/20 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-200/30 disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      )}
    </section>
  );
}
