# ADR 0002: Synthetic and Riot Provider Boundary

## Status

Accepted for first public release.

## Context

Riot production access requires approval of the finished application. The first public
demo must therefore be fully usable before real Riot credentials are available.

The application still needs credible ingestion architecture. A demo that hardcodes fake
finished domain objects directly into the UI or database would bypass the most
important system boundaries: provider validation, normalization, persistence,
analytics, review, and coaching.

## Decision

The initial application operates from deterministic Riot-compatible synthetic data.
Synthetic and real Riot adapters feed a shared validation, normalization, and domain
pipeline before persistence.

```text
synthetic or Riot payload -> validation -> normalization -> persistence -> analytics
```

## Why Not Hardcode Finished Domain Objects

Hardcoded UI/database objects would be easier in the short term, but they would prove
less:

- They would not exercise provider payload validation.
- They would not test normalization rules for dates, outcomes, scorelines, ACS, ADR,
  headshot percentage, map, agent, or role.
- They would make the frontend look complete while leaving ingestion risk hidden.
- They would create a separate demo path that could drift from the real Riot path.
- They would encourage invented review/coaching outcomes instead of deriving behavior
  from persisted match history.

## Consequences

- The public demo is usable without Riot credentials.
- Fixture provenance can be documented honestly as fictional.
- The retained Riot adapter can evolve behind the same boundary when approved access is
  available.
- Provider-specific changes should be isolated from deterministic analytics and UI
  workflows.
- The synthetic projection must remain clearly labeled and must not be mistaken for full
  official Riot DTO coverage.
