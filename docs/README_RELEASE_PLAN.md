# README Release Plan

Do not perform the final README rewrite until the backend persistence branch and public
hosting contracts are merged. This file defines the target README structure and the
claims that need cleanup before release.

## Target README Structure

1. Immediate product thesis
   - One short paragraph: Strata turns Valorant match history and review notes into
     deterministic analytics, coaching, recommendations, and progress tracking.
   - State that the public demo is fully usable with fictional synthetic data.

2. Screenshot/hero
   - Add a current product screenshot or short demo capture after frontend work settles.
   - Avoid mockups that imply unimplemented hosted/account behavior.

3. Why Strata is technically interesting
   - Shared synthetic/Riot ingestion boundary.
   - Deterministic analytics before AI.
   - Closed-loop progress/effectiveness design.
   - Offline-first demo behavior with optional external providers.

4. Closed-loop architecture
   - Show the loop: ingestion -> history -> analytics -> review -> coaching ->
     recommendations -> future evidence -> progress.

5. Deterministic vs AI responsibility
   - Deterministic services compute facts.
   - AI may refine interpretation only when configured.
   - Core operation does not require OpenAI credentials.

6. Synthetic Riot provider rationale
   - Explain Riot approval constraint.
   - Synthetic fixture is fictional and uses shared validation/normalization/domain paths.
   - It is superior to hardcoded UI state because it exercises ingestion and persistence.

7. Architecture diagram
   - Reuse or condense the Mermaid diagram from `ARCHITECTURE.md`.
   - Keep PostgreSQL/Alembic wording aligned with the backend merge state.

8. One-command local setup
   - Finalize after package/install expectations settle.
   - If true at release, provide a short path to seed and run backend/frontend.
   - Do not claim one-command setup unless a real command exists.

9. Demo workflow
   - Seed 40 fictional matches.
   - Explore Matches/Insights.
   - Add review notes/tags.
   - Generate deterministic coaching.
   - Generate progress after recommendations have future evidence.

10. Test/quality evidence
    - List actual backend and frontend checks run for the release.
    - Do not include benchmark numbers or coverage claims unless measured.

11. Observability
    - Pending until request IDs/logging/deployment logs are merged.
    - Document local troubleshooting now; production observability after hosting lands.

12. Deployment
    - Pending public hosting branch.
    - Include exact hosted URL, environment variables, migration sequence, and rollback
      concept only after implementation exists.

13. Tradeoffs
    - Riot access deferred pending approval.
    - Background sync deferred from first release.
    - Authentication/session isolation needed before shared public writes.
    - Synthetic projection is useful but not full official Riot DTO coverage.

14. Future work
    - Riot approval and production import validation.
    - Background SyncJob workflow.
    - Authentication/session isolation.
    - Hosted observability.
    - Recommendation/effectiveness refinement after backend workstream lands.

## Existing README Claims To Remove Or Update

| Current claim/theme | Release-plan action |
| --- | --- |
| "AI-first real-time coaching mode" | Avoid "real-time" unless the product supports live/streaming or in-session semantics. Prefer "AI-first coaching mode" and state it requires explicit credentials. |
| "Smart upgrade workflows" | Reframe as optional/current capabilities and planned directions. The phrase reads promotional and mixes implemented and future behavior. |
| Long phase-by-phase implementation history | Condense into current product capabilities and evidence. Senior reviewers need what exists now, not every phase label. |
| Riot import endpoint details | Keep only with clear caveat: requires approved Riot access and credentials, not available in the initial public demo. |
| Progress/recommendation effectiveness | Explain that effectiveness requires future evidence after recommendations. Do not imply seeded proof of coaching success. |
| PostgreSQL/Alembic | Add only after backend branch merges; until then describe as intended/active workstream. |
| Deployment | Add only after public hosting exists. Do not invent URLs, scaling behavior, or rollback commands. |
| Observability | Add exact request ID/logging behavior only after merged. |
| Test evidence | Refresh with actual commands and results from the release candidate. Do not invent coverage or performance numbers. |

## Claims To Avoid

- No benchmark, scalability, latency, or throughput numbers without measurement.
- No "enterprise-grade" or hardened security claims.
- No claim that Riot production access is available before approval.
- No claim that Redis/Celery/background sync exists in the first release.
- No claim that synthetic data proves real player outcomes or recommendation efficacy.
- No claim that public shared writes are safe before authentication/session isolation.

## Rewrite Timing

Wait for:

- PostgreSQL/Alembic merge and exact migration commands.
- Recommendation persistence/effectiveness contract stabilization.
- Public hosting choice and deployment/rollback details.
- Final frontend screenshot or demo capture.
- Final validation pass with backend tests and frontend build.
