# ADR 0004: Background Sync Deferred From First Release

## Status

Accepted deferral for first public release.

## Context

The initial release supports synchronous/provider-driven ingestion paths. Synthetic
seeding is deterministic and local. The retained Riot adapter can import when a key and
approved access are available, but Riot production access is not available for the
initial public demo.

Background synchronization would eventually be valuable for long-running Riot imports,
scheduled refreshes, retry handling, and user-visible sync status. However, claiming
distributed background execution before it exists would create operational and product
risk.

## Decision

Do not include Redis, Celery, or equivalent background synchronization in the first
release claims. Eventual Riot synchronization belongs in a background SyncJob workflow,
implemented as P1 after the core release path is stable.

The first release should describe ingestion as synchronous/provider-driven.

## Required Future Semantics

A future SyncJob design should define:

| Concern | Required behavior |
| --- | --- |
| Idempotency | Repeated sync requests for the same player/window should not duplicate matches or corrupt status. |
| Bounded retry | Transient provider failures should retry a limited number of times with visible terminal failure. |
| 429 handling | Riot rate limits should back off according to provider guidance and avoid tight retry loops. |
| Stale jobs | Jobs stuck beyond a threshold should become recoverable and visible to operators/users. |
| Duplicate sync requests | Concurrent requests should coalesce, reject, or queue deterministically. |
| Partial success | Imported matches should remain durable, while failed pages/windows are reported clearly. |
| Observability | Job IDs, request IDs, provider status, and retry counts should be inspectable. |

## Consequences

- The first release avoids false distributed-systems claims.
- Public demo behavior remains simpler and easier to operate.
- Future sync work has explicit correctness requirements before implementation begins.
- Documentation must continue to avoid depicting Redis/Celery as implemented until that
  work lands.
