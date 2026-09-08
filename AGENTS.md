# Strata

Strata is a portfolio-grade Valorant Performance Intelligence and Coaching Platform.

Primary loop: ingestion → durable normalized history → deterministic analytics →
review → issue detection → coaching → recommendations → future evidence →
progress/effectiveness.

## Engineering rules

- Inspect before editing; preserve good existing code. No large rewrite without a compelling reason.
- Optimize for credible senior-engineering signal per hour/dollar. Prioritize P0 before P1/P2.
- Use mature libraries. Avoid speculative abstractions and technology-count padding.
- The application must function without Riot credentials and without AI credentials.
- The synthetic provider is a supported initial data source. Synthetic and real Riot providers share normalization and domain paths.
- Deterministic analytics calculate facts. AI may interpret facts but cannot invent statistics.
- Never commit secrets or personal player data. Keep demo fixtures entirely fictional.
- Run relevant tests/builds. Do not overwrite unrelated concurrent-agent work.
- Document the current implementation honestly; no invented performance or scalability claims.

## UI principles

- UI quality is a first-class requirement: premium, modern, fluid, content-first visual design.
- Avoid a generic admin dashboard aesthetic.
- Interactions must remain accessible; animation must be purposeful, not distracting.

## Local demo and checks

From `backend`, install `requirements.txt`, then run `python -m app.seed_demo`.
No `.env` is needed. Seeding is local-only by default and skips existing demo IDs.
Run `python -B -m unittest discover -s tests -v` for backend regression checks.
From `frontend`, run `npm ci` and `npm run build` when frontend validation is needed.
See `backend/seeds/README.md` for fixture provenance and ingestion limitations.
