# README Release Packaging Status

The root `README.md` has been rewritten for the public portfolio release. It now leads
with the live Render demo, API health/readiness links, CI status, product thesis,
closed-loop recommendation effectiveness, architecture, validation evidence, local
startup, security posture, and future work.

## Current Public Demo

| Item | Status |
| --- | --- |
| Frontend | `https://strata-s41v.onrender.com` |
| API | `https://strata-apii.onrender.com` |
| Runtime database | Ephemeral SQLite, reseeded deterministically on startup |
| Demo mode | Read-only with `PUBLIC_DEMO_MODE=true` |
| Data source | Synthetic Riot-like fixture through the normal provider/normalization path |
| AI dependency | Disabled for the public demo |

## Validated Architecture

PostgreSQL 16 remains the validated durable database architecture. Docker and GitHub
Actions exercise Alembic migrations, SQLAlchemy, JSONB, foreign keys, external match
uniqueness, deterministic seeding, persisted recommendations, and progress evidence.

The public SQLite demo is an intentional cost and operations tradeoff. It should not be
described as the durable production database architecture.

## Screenshots

The README is ready to use these files when they exist:

- `docs/assets/strata-home.png`
- `docs/assets/strata-matches.png`
- `docs/assets/strata-coach.png`
- `docs/assets/strata-progress.png`

Do not add broken image references or mock placeholders. Home should remain the primary
README screenshot once captures are added.

## Claims To Preserve

- Deterministic analytics calculate factual metrics.
- AI may interpret facts only when explicitly configured.
- Recommendation outcomes are backend-owned.
- Evidence strength and effectiveness outcome are separate concepts.
- `supported` is not a statistical-significance claim.
- Riot production access remains future work pending approval.
- Redis/Celery background sync, OpenTelemetry traces, Grafana dashboards, and
  authenticated multi-user deployment remain future work.

## Validation Claims

The README may cite the completed local Docker PostgreSQL 16 validation:

- migration head `20260908_0001`
- 8 tables
- 17 indexes
- 40 seeded matches
- 1 persisted recommendation
- 1 persisted progress record
- persisted progress evidence
- JSONB verified
- external match uniqueness verified
- foreign keys verified
- repeat-safe seeding verified

Do not call this production load testing.
