import { usePublicDemoReadOnly } from "../../services/api/demoMode";
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
  const readOnly = usePublicDemoReadOnly();
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
    <section className="page-stack">
      <PageHeader
        eyebrow="Player context"
        title="Settings"
        description="Keep recommendations aligned with your rank goal, agent pool, role identity, and known improvement constraints."
      />

      {loading && (
        <StatePanel
          variant="loading"
          title="Loading player context"
          description="Fetching saved preferences and ranked goals."
        />
      )}

      {error && <StatePanel variant="error" title="Settings need attention" description={error} />}
      {success && <StatePanel variant="success" title="Settings saved" description={success} />}

      {!loading && (
        <form className="surface panel-padding" onSubmit={onSubmit}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="eyebrow">Identity</p>
              <h2 className="section-title mt-3">The coaching lens</h2>
              <p className="section-copy">
                This context stays lightweight and player-owned. It shapes recommendations without replacing match evidence.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="field-label">
                  Display name
                  <input
                    className="field"
                    value={form.displayName}
                    onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Target rank
                  <input
                    className="field"
                    placeholder="Ascendant 2"
                    value={form.targetRank}
                    onChange={(event) => setForm((prev) => ({ ...prev, targetRank: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field-label">
                Preferred agents
                <input
                  className="field"
                  placeholder="Omen, Sova"
                  value={form.preferredAgentsRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, preferredAgentsRaw: event.target.value }))}
                />
              </label>

              <label className="field-label">
                Preferred roles
                <input
                  className="field"
                  placeholder="Controller, Initiator"
                  value={form.preferredRolesRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, preferredRolesRaw: event.target.value }))}
                />
              </label>

              <label className="field-label">
                Known weak areas
                <input
                  className="field"
                  placeholder="first death control, utility timing"
                  value={form.knownWeakAreasRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, knownWeakAreasRaw: event.target.value }))}
                />
              </label>

              <label className="field-label">
                Improvement priorities
                <input
                  className="field"
                  placeholder="late round discipline, retake spacing"
                  value={form.improvementPrioritiesRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, improvementPrioritiesRaw: event.target.value }))}
                />
              </label>

              <label className="field-label">
                Personal notes
                <textarea
                  className="textarea"
                  placeholder="Add context about habits, goals, constraints, or current training focus."
                  value={form.personalNotes}
                  onChange={(event) => setForm((prev) => ({ ...prev, personalNotes: event.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="button button-primary" disabled={saving || readOnly} type="submit">
              {saving ? "Saving settings" : "Save settings"}
            </button>
            <p className="microcopy">Comma-separated values are converted into structured profile lists.</p>
          </div>
        </form>
      )}
    </section>
  );
}
