# Strata Threat Model

This is a concise first-release threat model for the public demo and near-term hosted
application. It is not a formal security certification.

## Assets

| Asset | Why it matters |
| --- | --- |
| Application integrity | Users and reviewers need the demo, analytics, and coaching outputs to reflect real application behavior. |
| Player data | Real Riot data, if later enabled, may identify players and match history. |
| Review/coaching history | Notes, issue tags, recommendations, and progress records can contain sensitive performance context. |
| Database | Stores normalized match history and user-created review/coaching state. |
| Riot credentials | Future approved Riot API keys or OAuth/RSO credentials would allow provider access. They are not present in the initial demo. |
| Optional AI credentials | OpenAI or other provider keys enable paid external calls and must remain private. |
| Deployment secrets | Database URLs, signing keys, hosting tokens, and observability credentials control production infrastructure. |

Synthetic demo data is entirely fictional and contains no real player information.

## Trust Boundaries

| Boundary | Main risks |
| --- | --- |
| Browser -> frontend | Tampered client state, automated use, stale assets, misleading local-only assumptions. |
| Frontend -> FastAPI | Invalid input, unauthenticated writes, CORS mistakes, request flooding. |
| FastAPI -> PostgreSQL | SQL/database failure, unsafe migrations, leaked connection strings, accidental data mixing. |
| FastAPI -> future Riot API | Credential exposure, provider outage, rate limits, malformed or changing payloads. |
| FastAPI -> optional AI provider | Prompt/data leakage, cost spikes, provider failure, ungrounded generated text. |
| Public internet -> hosted demo | Scraping, automated writes, abuse of unauthenticated endpoints, exposure of debug behavior. |

## Abuse and Failure Cases

| Case | Impact |
| --- | --- |
| Exposed API keys | Riot, AI, database, or hosting credentials could be abused outside Strata. |
| Unauthenticated writes in a public demo | Shared state could be defaced, spammed, or contaminated with offensive or personal content. |
| Malicious or invalid input | Bad payloads could trigger errors, corrupt demo state, or exploit weak validation. |
| CORS abuse | Overbroad origins could allow untrusted browser contexts to call write endpoints. |
| Scraping/automation | Public endpoints could be scraped or flooded, especially if hosted without rate limits. |
| Excessive generation/API calls | Optional AI or future Riot calls could create cost, quota, or rate-limit issues. |
| External provider failure | Riot or AI outages should not break deterministic local/demo workflows. |
| Sensitive logging | Request bodies, player identifiers, credentials, or generated content could leak into logs. |
| Demo-data contamination | Real player data or user-created offensive content could be mistaken for official demo data. |
| SQL/database failure | Application state could be unavailable, partially migrated, or inconsistent. |

## Mitigations

| Risk | Mitigation |
| --- | --- |
| Secrets in source control | No secret belongs in source control. Keep `.env`, local databases, dependency caches, and generated state ignored. Use blank placeholders in examples. |
| Real player exposure | The initial public demo uses deterministic synthetic data only. It contains no real player information and needs no Riot credentials. |
| Public shared writes | Restrict or disable public shared write access until authentication, authorization, and session isolation exist. A hosted read-only demo is safer than a shared mutable demo. |
| Invalid input | Keep Pydantic/API validation at boundaries and reject malformed provider/import payloads before persistence. |
| SQL safety | Use SQLAlchemy query construction rather than interpolated SQL. Run migrations deliberately once Alembic lands. |
| CORS | Keep allowed origins explicit for local and deployed hosts. Do not use wildcard origins with credentials. |
| Scraping/automation | Add hosting-level rate limiting, request size limits, and abuse monitoring before exposing mutable endpoints publicly. |
| AI abuse/cost | Keep AI optional. Deterministic coaching must remain the default/core path. Add quotas or disable AI in public demos unless authenticated and budgeted. |
| Riot dependency | Do not include Riot credentials in the initial demo. Treat Riot access as future approved-provider functionality. |
| Provider failure | Return clear errors for configured external provider failures and preserve deterministic/offline workflows. |
| Sensitive logs | Avoid logging secrets, full request bodies, provider tokens, or personal match/player payloads. Prefer request IDs and concise error categories. |
| Demo reset | Maintain a deterministic seed path so demo state can be restored from fictional fixtures after testing or contamination. |

## Residual Risk

The first release should not be described as hardened multi-user infrastructure. Until
authentication, session isolation, rate limiting, hosted observability, and migration
operations are merged and exercised, the safest public demo posture is deterministic,
synthetic, and tightly controlled.
