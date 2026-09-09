# Strata Operational Runbook

This runbook covers the first public-release baseline and marks pending infrastructure
explicitly. Commands assume Windows PowerShell from `C:\Raj\Code\Strata`.

## Local Startup

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.seed_demo
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Default URLs:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend health | `http://127.0.0.1:8000/health` |
| OpenAPI docs | `http://127.0.0.1:8000/docs` |

No `.env`, Riot key, or OpenAI key is required for the deterministic demo.

## Demo Data Reset and Seeding

Seed from `backend`:

```powershell
python -m app.seed_demo
```

Expected baseline: 40 fictional matches from the checked-in synthetic fixture. Repeat
runs skip existing demo match IDs and preserve locally created review/coaching/progress
state.

Clean deterministic reset for local SQLite:

1. Stop the backend.
2. Remove only the disposable local database, `backend\strata.db`.
3. Run `python -m app.seed_demo` again.
4. Restart the backend and verify `/health`.

Do not use `--allow-nonlocal` casually. It exists only for deliberate non-default seed
targets and can affect shared state.

## Database Migration

Alembic is the schema migration path for PostgreSQL and other deployed database
environments. Local SQLite startup still creates its schema automatically for the
`local`, `development`, and `test` environments.

From `backend`, configure the target database without committing the connection string,
then apply migrations before starting the API:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://<user>:<password>@<host>:5432/<database>"
alembic upgrade head
uvicorn app.main:app --port 8000
```

The repository contains the migration configuration and initial schema revision. This
runbook does not claim that a live PostgreSQL instance has been validated.

Operational expectations for the merged migration path:

| Step | Expected behavior |
| --- | --- |
| Preflight | Confirm database URL points at the intended environment. |
| Upgrade | Apply Alembic migrations before serving new code. |
| Failure | Stop deployment, capture migration logs, do not reseed over production data. |
| Rollback | Use the deployment platform and migration policy defined for the release. |

## Health Check

Check backend health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

This only proves the FastAPI process is reachable. It does not prove the full frontend,
database, provider, or AI path is healthy.

## Frontend/Backend Connectivity

1. Start backend on port `8000`.
2. Start frontend on port `5173`.
3. Open `http://localhost:5173`.
4. Confirm pages such as Matches and Insights load seeded data.
5. If API calls fail, inspect the browser network tab for status code, request URL, and CORS errors.

Likely checks:

| Symptom | Check |
| --- | --- |
| Frontend blank or Vite error | Confirm `npm ci` completed and `npm run dev` is still running. |
| API 404 | Confirm the frontend is calling `/api/v1/...` routes on the expected backend host. |
| API connection refused | Confirm Uvicorn is running on `127.0.0.1:8000`. |
| CORS error | Confirm frontend origin is explicitly allowed by backend CORS configuration. |

## Database Unavailable

For local SQLite:

| Symptom | Action |
| --- | --- |
| Startup cannot open database | Confirm the backend working directory is `backend` and the path is writable. |
| Corrupt or unwanted demo state | Stop backend, remove `backend\strata.db`, reseed. |
| Missing tables | Rerun startup or `python -m app.seed_demo`; current local baseline creates tables automatically. |

For hosted PostgreSQL, do not invent credentials or connection strings. Check the
deployment provider's database status, connection limits, and application logs. Confirm
that the configured `DATABASE_URL` uses the supported PostgreSQL driver form before
rerunning `alembic upgrade head`.

## Migration Failure

If an Alembic migration fails:

| Failure point | Required response |
| --- | --- |
| Migration fails before deploy | Do not promote the build. Capture logs and fix forward on a branch. |
| Migration fails during deploy | Halt rollout and use the platform rollback procedure. |
| Data issue after migration | Preserve the database for investigation; do not run demo seeding against shared data. |

## Invalid Demo Fixture

If `python -m app.seed_demo` fails:

1. Read the validation error and identify the affected fixture field.
2. Check `backend\seeds\README.md` for supported fixture projection rules.
3. Regenerate only if intentionally updating the fixture:

```powershell
python -B scripts\generate_demo_fixture.py
```

4. Rerun backend tests:

```powershell
python -B -m unittest discover -s tests -v
```

The fixture must remain fictional and must not be derived from real player history.

## AI Unavailable

Default deterministic coaching does not require AI.

| Mode | Expected behavior |
| --- | --- |
| `deterministic` | Works without `openai_api_key`. |
| `hybrid` | Deterministic report is generated first; AI refinement may be skipped/fail and should not remove the base report. |
| `ai_first` | Requires explicit AI configuration and should error clearly when missing or failing. |

For public demos, prefer deterministic or tightly controlled hybrid behavior unless
authentication, quotas, and cost controls exist.

## Hosted Demo Read-Only Mode

Set `PUBLIC_DEMO_MODE=true` on the backend for a shared public demo. Protected mutation
endpoints return HTTP 403 with `Hosted demo is read-only.` while read endpoints remain
available. Set `VITE_PUBLIC_DEMO_MODE=true` when building the frontend so mutation
controls are disabled proactively and the read-only explanation is visible. The local
application keeps the mutable workflow when this setting is false.

## Riot Unavailable

Riot production access is unavailable until Riot approves the finished application. The
initial public demo should not depend on Riot credentials.

Expected behavior:

| Path | Behavior |
| --- | --- |
| Synthetic seed | Works offline with no Riot key. |
| Manual normalized import | Works without Riot if caller supplies valid normalized objects. |
| Live Riot import | Requires `riot_api_key` and approved access; otherwise returns a clear configuration/provider error. |

## Logs and Request IDs

OpenTelemetry instrumentation and Grafana dashboards are still pending P1 work.

Current local troubleshooting uses terminal output from Uvicorn, browser network
details, and API error responses. Once request ID middleware and structured logging are
implemented, update this section with:

| Item | Required detail |
| --- | --- |
| Request ID header | Header name and how to find it in browser/API responses. |
| Backend logs | Where logs are stored or streamed in each environment. |
| Deployment logs | Provider-specific command or console path. |
| Error correlation | How to search a request ID across frontend, backend, and provider logs. |

## CORS and Configuration Issues

Current backend CORS allows local Vite origins: `http://localhost:5173` and
`http://127.0.0.1:5173`.

For hosted release:

- Add only the deployed frontend origin(s).
- Do not use wildcard origins with credentials.
- Confirm `database_url`, Riot credentials, and AI credentials are environment secrets,
  not committed files.
- Keep the demo functional when Riot and AI secrets are absent.

## Deployment Rollback

Pending hosting implementation.

Public hosting will be added before release. Once selected, document:

| Area | Needed detail |
| --- | --- |
| Artifact/version | How a release is identified. |
| Rollback command | Exact platform command or console action. |
| Database policy | Whether schema rollbacks are supported or fixes are forward-only. |
| Secret rollback | How to restore prior environment variables safely. |
| Verification | Health, frontend smoke test, and seeded demo-state checks after rollback. |

## Restoring Deterministic Demo State

For local development:

```powershell
cd backend
Remove-Item .\strata.db
python -m app.seed_demo
uvicorn app.main:app --reload --port 8000
```

Only remove `strata.db` when it is disposable local demo state. Never run destructive
reset steps against shared PostgreSQL or production data.
