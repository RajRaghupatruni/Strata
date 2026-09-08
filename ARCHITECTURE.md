# Strata Architecture

## Overview

Strata is a local-first Valorant Performance Intelligence and Coaching Platform.
The first public release runs as a single-user local application with supported
deterministic synthetic data. Hosted multi-user infrastructure is outside this baseline.

The architecture prioritizes local execution, modular boundaries, clear data ownership,
and separation between ingestion, persistence, analytics, coaching, and UI.

## Implemented ingestion boundary

```text
SyntheticMatchProvider (checked-in fictional payloads) ─┐
                                                      ├─ normalize_riot_match
fetch_riot_matches_by_riot_id (optional Riot adapter) ──┘
    → consumed-payload validation
    → timestamp, result, scoreline, ACS, ADR, and headshot normalization
    → MatchImportItem
    → insert_match_items (shared duplicate-skipping persistence)
    → durable Match rows
    → existing deterministic analytics, review, coaching, and progress
```

`python -m app.seed_demo` is the guarded local entry point. It loads fixed payloads
without network calls and requires no Riot or AI credentials. The normalized manual
JSON import endpoint remains supported and uses the same persistence service.

There is no extra provider hierarchy: the existing Riot adapter function and a small
synthetic adapter share a normalizer. Full Riot DTO validation and content-ID catalog
resolution are not claimed; see [fixture documentation](backend/seeds/README.md).

## Application layers

### Frontend application

React, TypeScript, and Tailwind render Home, Matches, Insights, Review, Coach,
Progress, and Settings. The frontend collects input, triggers backend workflows,
and owns local UI state. Business-critical analytics belong in backend services.
Visual quality, accessible interactions, and focused content are product requirements.

### Application backend

FastAPI coordinates match management, review notes and issue tags, analytics queries,
coaching generation, progress measurement, and local profile context. Route domains
are separate modules under `backend/app/api/routes`. Schemas define the API contracts.

### Local persistence

SQLAlchemy stores normalized matches, parsed metadata, review notes, issue tags,
coaching reports, progress snapshots, and profile context in SQLite. Local database
files are generated state and must never be committed. Current startup creates tables;
there is no migration system or multi-user identity/ownership layer yet.

PostgreSQL and user-aware ownership may be considered for a future hosted product.
They are architecture directions, not implemented features of this release.

### Analysis and coaching

Deterministic analysis computes recent/baseline comparisons, map/agent/role breakdowns,
streaks, volatility, and before/after metrics from stored history. It owns statistical facts.

Coaching consumes those facts, recurring review tags, and optional profile context to
generate a priority issue, what to stop/keep/improve, next-session focus, and a weekly
plan. Deterministic mode is the default. Hybrid refinement and AI-first mode remain
optional and require explicit configuration. AI must remain grounded in supplied evidence.

Progress snapshots compare stored match windows and assess available recommendation
evidence. The demo creates no historical coaching/progress records. A newly generated
recommendation has no future matches yet; insufficient evidence is the expected result.
Recommendation/effectiveness semantics are a separate backend workstream.

### Ingestion

The initial supported source is deterministic synthetic Riot-like data. Approved Riot
API access is an optional future-facing source; manual normalized imports also remain
available. Replay references and broader file inputs are product directions.

External payloads must be validated and normalized before analytics or UI consume them.
Unknown/unavailable metrics remain null. The synthetic fixture uses the same consumed
payload schema and normalization rules as the real adapter.

## Module structure

```text
backend/
  app/
    main.py
    seed_demo.py
    api/routes/       # matches, insights, review, coach, progress, settings, home
    core/             # configuration and database sessions
    models/           # SQLAlchemy entities
    schemas/          # Pydantic API contracts
    services/
      ingestion/      # payload validation, adapters, normalization, persistence
      analysis/
      coaching/
      progress/
      review/
    repositories/     # reserved package; current queries live in routes/services
  seeds/
  scripts/
  tests/
frontend/
  src/
    app/
    components/
    features/         # home, matches, insights, review, coach, progress, settings
    services/api/
    types/
```

Each feature owns its page-level UI. Backend services own domain operations and routes
orchestrate them. Shared ingestion persistence keeps provider behavior consistent.

## Internal domain model

| Entity | Responsibility and principal fields |
| --- | --- |
| UserProfile | Local context: display name, target rank, preferred agents/roles, notes, timestamps |
| Match | External ID, time, map, mode, agent, role, result, scoreline, K/D/A, ADR, ACS, headshot percentage, optional RR/rank, session, metadata |
| ReviewNote | Match/replay context, note type, summary, full note, timestamps |
| IssueTag | Review/match association, category, severity, round reference, description |
| CoachingReport | Evidence window, priority issue, stop/keep/improve guidance, next-session focus, weekly plan, supporting data |
| ProgressSnapshot | Snapshot date, metric window, summary, issue trends, performance changes, recommendation effectiveness |

Issue categories can include positioning, utility, early death, overpeek, trade failure,
tilt, timeout decisions, and entry pathing. Review observations are entered through
the app, not inferred as observed facts from aggregate match metrics.

## Service boundaries

- Ingestion converts provider payloads into normalized internal records.
- Match routes handle retrieval, filtering, import, and detail composition.
- Review routes manage notes, tags, and recurring issue grouping.
- Analysis computes deterministic summaries and breakdowns.
- Coaching consumes analysis outputs and creates guidance with supporting evidence.
- Progress compares match windows and available recommendation periods.

The coaching layer receives structured recent history, baselines, weak segments,
review tags, and profile context. It never reads raw UI state directly. Structured
outputs keep it independently testable and allow optional provider replacement.

## Engineering direction

Maintain stable internal schemas as external sources evolve. Prefer the existing
modular monolith and mature libraries over speculative services. Run locally without
cloud infrastructure or paid APIs. Keep ingestion methods, optional coaching providers,
and frontend surfaces replaceable through narrow boundaries.

The current packaging is a local web application: React frontend and FastAPI backend.
A desktop wrapper, hosted deployment, authentication, user isolation, and additional
database infrastructure require separate decisions; none is necessary for this demo.

Do not equate working local workflows with validated production scalability or
recommendation effectiveness. Document observed behavior and limitations honestly.
