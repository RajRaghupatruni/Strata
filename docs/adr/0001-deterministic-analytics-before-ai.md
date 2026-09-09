# ADR 0001: Deterministic Analytics Before AI

## Status

Accepted for first public release.

## Context

Strata computes Valorant performance facts and then turns those facts into review and
coaching guidance. The application must work without OpenAI credentials, and public
release claims need to be auditable by engineers reviewing the system.

AI-generated coaching can improve phrasing, prioritization, and explanation quality,
but it is not a reliable source of statistical truth.

## Decision

Statistics and factual performance evidence are computed deterministically by Strata.
AI may interpret, summarize, or refine guidance from supplied evidence, but it cannot
invent statistics, unseen review observations, match facts, or progress outcomes.

## Consequences

- The demo and core product work without AI credentials.
- Analytics outputs remain reproducible and testable.
- Coaching can cite the same evidence used by the UI and progress workflows.
- AI provider failures do not invalidate deterministic operation.
- AI prompts and outputs must be designed around a bounded evidence package.
- Features that depend on unobserved gameplay facts must wait for a real data source or
  explicit user review input.
