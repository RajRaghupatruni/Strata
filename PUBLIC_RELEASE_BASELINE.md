# First-publication baseline

Initial repository hygiene and release baseline completed September 8, 2026. The
portfolio deployment is now public at `https://strata-s41v.onrender.com`, with the API
at `https://strata-apii.onrender.com`.

## A. Observations before edits

- Git was already initialized on `main`, with no commits; project files were untracked.
- FastAPI/SQLAlchemy/SQLite and React/TypeScript/Vite already supported match history,
  analytics, review, coaching, progress, settings, and home summaries.
- Configuration already defaulted to local execution and deterministic coaching.
- The Riot adapter normalized raw payloads, but the old 27-match seed entered through
  the already-normalized manual import endpoint, bypassing that normalization.
- Local credentials, dependency directories, a personal database, and generated caches
  were present. No Git-history repair was needed.

## B. Deleted files and directories

- `backend/.env`
- `backend/.venv/` (including its dependencies and generated files)
- `frontend/node_modules/`
- `backend/strata.db` (original local state and subsequently generated validation state)
- `frontend/tsconfig.tsbuildinfo`
- `frontend/dist/` (produced by validation, then removed)
- All 13 application `__pycache__/` directories under `backend/app`, including bytecode.

The final tree contains no local databases, virtual environments, dependency trees,
bytecode, build output, tool caches, coverage output, or temporary logs. No legitimate
source, fixture path, test, or configuration example was deleted. The old fixture's
contents were replaced in full, without deriving new values from them.

## C. Created and changed files

Created:

- `AGENTS.md`
- `backend/app/seed_demo.py`
- `backend/app/services/ingestion/payloads.py`
- `backend/app/services/ingestion/synthetic.py`
- `backend/app/services/ingestion/persistence.py`
- `backend/scripts/generate_demo_fixture.py`
- `backend/seeds/README.md`
- `backend/tests/test_demo.py`
- `PUBLIC_RELEASE_BASELINE.md`

Changed:

- `.gitignore`: credentials, dependencies, databases, builds, bytecode/caches, coverage,
  logs, operating-system artifacts, and IDE-local files; `.env.example` remains permitted.
- `backend/.env.example`: empty credential placeholders and deterministic local defaults.
- `backend/seeds/sample_matches.json`: 40 entirely fictional Riot-like payloads.
- `backend/app/services/ingestion/riot.py`: shared validation/normalization, round-derived
  ADR/headshot metrics, synthetic provenance, known demo roles, and object-form history IDs.
- `backend/app/api/routes/matches.py`: delegates persistence to the shared service.
- Backend smoke script: checks seeded history without bypassing ingestion.
- `README.md`, `ARCHITECTURE.md`, `PRODUCT_VISION.md`, `MVP_ROADMAP.md`: supported demo
  workflow, current implementation, and original/future product direction distinguished.

Frontend source, dependencies manifests, analytics, review, coaching, progress models,
and existing configuration defaults were preserved. No new runtime package was added.

## D. Synthetic provider/data architecture

The synthetic adapter loads fixed checked-in values. The retained real adapter is
`fetch_riot_matches_by_riot_id`; no redundant provider hierarchy was introduced.

Both adapters use:

```text
Riot-like payload → Pydantic validation → normalize_riot_match → MatchImportItem
    → insert_match_items → persistent Match rows → existing deterministic analytics
```

The fixture spans 20 sessions/days, four maps, four agents, and four roles. Improving
segments coexist with a declining Bind/Jett segment. Metadata explicitly marks demo
provenance. Round damage and hits produce ADR/headshot metrics; combat score produces ACS.
Rank/RR stay unavailable rather than being inferred. No historical recommendations,
review observations, or progress results are seeded.

## E. Exact demo command

From `backend`, after installing `requirements.txt`:

```powershell
python -m app.seed_demo
```

No `.env`, Riot key, or OpenAI key is needed. First run inserts 40 matches; subsequent
runs skip the same 40 external IDs and preserve other local state. Default execution
permits only local/development/test environments and `backend/strata.db` or in-memory
SQLite. Other targets require an explicit `--allow-nonlocal` override.

## F. Secret/personal-data audit

No credential values were printed, reused, validated against a provider, or retained.

| Path | Category | Disposition |
| --- | --- | --- |
| `backend/.env` | OpenAI credential/local configuration | Removed |
| `backend/.env.example` | OpenAI credential | Removed; credential fields intentionally remain blank placeholders |
| `backend/seeds/sample_matches.json` | Personal/conversational seed material | Completely replaced with independent fictional data |
| `backend/strata.db` | Private local application state | Removed without reading its contents |

The source audit searched OpenAI/Riot/GitHub/AWS credential shapes, private-key headers,
credential assignments, conversational residue, email addresses, and machine-specific
home paths. It found no remaining obvious credential or personal-data candidates.
Broad password/secret/token matches were reviewed as configuration/code symbols,
documentation, tests, or the `js-tokens` package name in the frontend lockfile. These
contain no usable credentials. Generated/dependency directories and `.git` internals
were excluded from the source scan.

## G. Validation commands

From `backend`, while the existing virtual environment was still available:

```powershell
.venv/Scripts/python.exe -B -m unittest discover -s tests -v
.venv/Scripts/python.exe -B -m app.seed_demo
.venv/Scripts/python.exe -B -m app.seed_demo
```

From `frontend`:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

Additional checks used standard-library Python to parse/reproduce the fixture,
compile every Python source in memory, scan source without printing matching values,
and assert generated paths were absent. `git check-ignore --no-index` checked ignore
coverage and allowed examples/source files.

A temporary Uvicorn server on a loopback port exercised real HTTP endpoints with both
credential environment variables removed. The existing smoke test's `main()` ran
against that port. For normal local use its equivalent is:

```powershell
uvicorn app.main:app --port 8000
# In a second backend terminal:
python scripts/smoke_test_postgres.py --repeat-seed
```

## H. Results

- All 10 backend regression tests passed, including malformed input, provider parity,
  duplicate handling within/across batches, preservation of review state, target guards,
  reproducible fixture generation, real fixture trends, and review/coaching/progress behavior.
- Seeding produced `40 inserted / 0 skipped`, then `0 inserted / 40 skipped`.
- Backend imports, OpenAPI generation, startup, health, matches, insights, home, review,
  settings, coaching, pro brief, and progress HTTP workflows passed without either API key.
- Docker PostgreSQL 16 validation passed: all services became healthy, Alembic used
  `PostgresqlImpl` at `20260908_0001 (head)`, repeat seeding reached 40 matches with
  `0 inserted / 40 skipped`, and the dedicated smoke test confirmed 8 tables, 17
  indexes, JSONB support, uniqueness, foreign keys, one recommendation, and progress
  evidence. This is local container validation, not cloud production load validation.
- Offline unit tests rejected network calls. Live HTTP checks allowed loopback traffic
  only and observed zero external connections. Unconfigured Riot import returned HTTP 400.
- A clean frontend dependency install and TypeScript/Vite production build passed.
- All 51 Python source files compiled in memory; fixture JSON parsed and reproduced.
- Secret and artifact checks passed after cleanup. Dependencies and generated state were
  removed after validation, so rerunning application tests requires reinstalling dependencies.

Windows sandbox restrictions initially blocked temporary test files and Vite's esbuild
subprocess. Approved runs outside the sandbox passed. An initial live-test network guard
also blocked Windows asyncio's internal loopback socket pair; allowing loopback fixed
the harness, and the application checks passed. FastAPI emits its existing deprecated
`on_event` warning; it does not prevent startup.

## I. Manual actions remaining

- Recreate local dependencies and seed state using the README when resuming development.
- The frontend recommendation/effectiveness integration and the backend recommendation
  contract are merged and visible in the public demo.
- Pursue Riot approval only for the optional real adapter; the demo does not depend on it.

## J. Next P0 blockers and limitations

No blocker was found for the next local P0 integration. The following are documented
limits, not claims of production readiness:

- The fixture is a reduced consumed Riot-like projection, not full official DTO conformance.
- Real content UUID/map-alias resolution remains incomplete and needs approved payload testing.
- Map and agent are paired in the fixture, so their independent causal effects cannot be inferred.
- External match IDs are protected by a database-level uniqueness constraint as well as
  application-level duplicate handling.
- Recommendations persist as first-class records, with deterministic sample-aware
  effectiveness evidence (`insufficient_data`, `directional`, and `supported`).
- No authentication, multi-user isolation, durable hosted database, or scalability claims were added.
