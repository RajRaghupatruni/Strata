# Strata

A local-first Valorant Performance Intelligence and Coaching Platform.

The initial public release runs entirely on supported, deterministic synthetic data.
Riot production access requires project approval; neither Riot nor OpenAI credentials
are needed for the demo, startup, analytics, review, coaching, or progress workflows.

Design references:
- `PRODUCT_VISION.md`
- `MVP_ROADMAP.md`
- `ARCHITECTURE.md`

## Current Status

Implemented foundation:
- backend scaffold (`FastAPI`, modular route domains, SQLite wiring, core models)
- frontend scaffold (`React + TypeScript + Tailwind`, app shell + feature routes)
- local-first monorepo layout ready for MVP vertical slices
- Match workflows:
  - `POST /api/v1/matches/import` (validated JSON import + duplicate skip by `external_match_id`)
  - `GET /api/v1/matches` (filters: `map`, `agent`, `role`, `result`, `start_date`, `end_date`)
  - `GET /api/v1/matches/{match_id}`
  - `Matches` page wired to live backend data
  - 40 fictional Riot-like payloads, guarded demo seed command, and smoke test script
- Insights workflows:
  - deterministic insights service for recent form, map/agent/role breakdowns, streaks, trends, and volatility
  - `GET /api/v1/insights?recent_window=10`
  - Insights page wired to live API output
- Review workflows:
  - review note CRUD (`add`, `edit`, `delete`)
  - issue tag flow (embedded tags on notes + standalone add/delete tag endpoints)
  - recurring issue grouping endpoint
  - Review page wired to live API (note editor + match filter + recurring issue table)
  - match detail integration via `review_note_count` on `GET /api/v1/matches/{match_id}`
- Coaching workflows:
  - multi-mode coaching engine (`deterministic`, `hybrid`, `ai_first`)
  - `POST /api/v1/coach/generate`
  - `GET /api/v1/coach/latest`
  - `GET /api/v1/coach/reports`
  - Coach page wired to generate/view latest report + history
- Progress workflows:
  - deterministic progress snapshot generator (`before-vs-after metrics`, `issue recurrence deltas`, `recommendation effectiveness`)
  - `POST /api/v1/progress/generate`
  - `GET /api/v1/progress/latest`
  - `GET /api/v1/progress`
  - Progress page wired to generate/view latest snapshot + history
- Personal context workflows:
  - persistent user profile context (`display name`, `target rank`, `preferred agents/roles`, `known weak areas`, `improvement priorities`, `notes`)
  - `GET /api/v1/settings/profile`
  - `PUT /api/v1/settings/profile`
  - Settings page wired to load/edit/save profile context
- Home command center workflows:
  - consolidated home summary endpoint (`matches + insights + coaching + progress + review gap`)
  - `GET /api/v1/home/summary`
  - Home page wired to:
    - rank/climb context
    - recent trend
    - strongest/weakest map + agent
    - current focus + next review suggestion
    - coaching summary
    - progress highlight
    - counters + quick links
- UX refinement workflows:
  - consistent page header hierarchy across all feature surfaces
  - standardized loading/error/empty/success state panels
  - improved shell navigation styling with keyboard shortcuts (`Alt+1..7`)
  - copywriting clarity pass for session-oriented guidance
  - motion/focus/scrollbar polish and responsive nav behavior
- Smart upgrade workflows:
  - optional Riot ingestion endpoint by Riot ID (`game_name#tag_line`)
  - advanced deterministic performance assessment vector for coaching
  - AI-first real-time coaching mode and hybrid refinement mode
  - optional live Riot import form (requires approved access)
  - richer coaching UI signal visualization (assessment bars + AI usage marker)

Not implemented yet:
- optional advanced UX extras (command palette, chart animations, accessibility audit)
- fully automated Riot OAuth/RSO consent flow for public multi-user deployment

## Project Structure

```text
backend/
  app/
    api/routes/
    core/
    models/
    schemas/
    services/
    repositories/
frontend/
  src/
    app/
    features/
      home/
      matches/
      insights/
      review/
      coach/
      progress/
      settings/
```

## Run Locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Configuration defaults are sufficient; no .env file or API keys needed.
python -m app.seed_demo
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Frontend default URL: `http://localhost:5173`  
Backend health check: `http://127.0.0.1:8000/health`

### Docker Compose stack

Docker Desktop provides the recommended local stack on Windows. From the repository
root in PowerShell:

```powershell
docker compose up --build
```

This starts PostgreSQL, runs `alembic upgrade head` in the backend before Uvicorn,
and serves the Vite production build through nginx. Open `http://localhost:5173`;
the API is available at `http://localhost:8000` and the database is persisted in the
`strata-postgres-data` named volume. No Riot or OpenAI key is required.

In a second PowerShell window, seed the containerized PostgreSQL database:

```powershell
docker compose run --rm backend python -m app.seed_demo --allow-nonlocal
```

Useful commands are `docker compose down`, `docker compose logs -f`,
`docker compose run --rm backend alembic upgrade head`, and
`docker compose down -v` for a disposable clean database reset. The explicit
`--allow-nonlocal` is required because the seed guard protects non-file databases.
The focused production-schema check, including a repeat seed, is:

```powershell
docker compose run --rm backend python scripts/smoke_test_postgres.py --repeat-seed
```

The same commands are available through `.\scripts\strata.ps1` (for example,
`.\scripts\strata.ps1 validate-postgres`). Compose defaults map the frontend to
port 5173, the API to 8000, and PostgreSQL to 5432; set `FRONTEND_PORT`,
`BACKEND_PORT`, or `POSTGRES_PORT` in the PowerShell environment if a port is busy.
If changing the frontend port, also configure that origin in the backend CORS policy.

### Demo data

From `backend`, with dependencies installed:

```powershell
python -m app.seed_demo
```

This creates the schema and imports 40 fictional matches from the checked-in fixture.
Repeat runs skip existing external IDs, preserving reviews and other local work.
It makes no network calls and does not generate historical recommendations or progress.
By default it only permits `environment=local`, `development`, or `test`, and the
SQLite file `backend/strata.db` (or in-memory SQLite). Other targets require the
explicit `--allow-nonlocal` override. Never use that flag casually on a shared database.
For a clean demo, stop the backend, remove your disposable local `strata.db`, and seed again.

Explore Matches and Insights, add a note in Review, generate a report in Coach,
and generate a snapshot in Progress. New recommendations have no future evidence yet;
insufficient evidence is expected, not a precomputed success claim. Review tags are
entered through the application; the fixture does not invent review observations.

See [fixture provenance and limitations](backend/seeds/README.md). The raw fixture
is a Riot-like payload collection and is **not** the normalized JSON import body.

### Environment setup (optional)

`backend/.env.example` contains safe local defaults and blank credential placeholders.
Copy it to `.env` only if you need overrides. The default coaching mode is
`deterministic` and AI is disabled. No paid service is required.

Live Riot imports require approved Riot access and `riot_api_key`. AI modes are
optional: set `coaching_ai_enabled=true`, `openai_api_key`, and `coaching_mode=hybrid`
or `ai_first` only when deliberately enabling an external service. Do not publish
local `.env` files or databases. Never put usable credentials in examples.

## Match import contract

`POST /api/v1/matches/import` accepts `{ "matches": [...] }` with normalized
`MatchImportItem` objects (see `backend/app/schemas/match.py` or `/docs`). This
manual import remains supported. Synthetic and live Riot adapters instead share
raw payload validation and normalization before using the same persistence service.

### Optional Riot live import

Endpoint:
- `POST /api/v1/matches/import/riot`

Body:

```json
{
  "game_name": "PlayerName",
  "tag_line": "NA1",
  "region": "na",
  "max_matches": 10
}
```

Requirements:
- `riot_api_key` configured in `backend/.env`
- valid Riot region: `na`, `eu`, `ap`, `kr`, `latam`, `br`, `esports`

## Local API Smoke Test

After seeding, with the backend running:

```powershell
cd backend
python scripts/smoke_test_phase2.py
```

This script:
1. checks `/health`
2. verifies populated match history without modifying it
3. reads back `GET /api/v1/matches?limit=10`

## Insights API

Endpoint:

`GET /api/v1/insights?recent_window=10`

Returns:
- `recent_form`
- `baseline_form`
- `trend_summary`
- `streaks`
- `volatility`
- `map_breakdowns`
- `agent_breakdowns`
- `role_breakdowns`

Open in browser while backend is running:

`http://127.0.0.1:8000/api/v1/insights?recent_window=10`

## Review API

Endpoints:
- `GET /api/v1/review/notes?match_id=1`
- `GET /api/v1/review/notes/{note_id}`
- `POST /api/v1/review/notes`
- `PUT /api/v1/review/notes/{note_id}`
- `DELETE /api/v1/review/notes/{note_id}`
- `POST /api/v1/review/notes/{note_id}/tags`
- `DELETE /api/v1/review/tags/{tag_id}`
- `GET /api/v1/review/issues/recurring`

## Coach API

Endpoints:
- `POST /api/v1/coach/generate` with body `{ "recent_window": 10 }`
- `POST /api/v1/coach/pro-brief` with body `{ "recent_window": 10, "match_id": 42 }` (`match_id` optional)
- `GET /api/v1/coach/latest`
- `GET /api/v1/coach/reports?limit=10`

The coaching engine supports deterministic-only, hybrid, and AI-first modes.

### Coaching Intelligence Modes

1. Deterministic (default, zero-cost):
- Uses local insights + recurring review tags + weighted assessment scoring.
- Produces stable, explainable coaching outputs.

2. Hybrid AI refinement:
- Enable by setting `coaching_ai_enabled=true` and `openai_api_key`.
- Set `coaching_mode=hybrid`.
- Deterministic output is generated first, then optionally refined by LLM.
- If AI call fails, it safely falls back to deterministic output.

3. AI-first (real-time AI as primary engine):
- Enable `coaching_ai_enabled=true`, set `openai_api_key`, and `coaching_mode=ai_first`.
- `/api/v1/coach/generate` uses LLM-generated coaching content as the main output.
- If API key/config is missing, generation returns an error until AI is configured.

### Pro Coaching Brief Endpoint

`POST /api/v1/coach/pro-brief`

Purpose:
- Returns personalized, direct, professional-style coaching guidance.
- Includes strengths, role fit, limiting patterns, harsh truths, priority improvements, and a weekly program.
- Optional `match_id` triggers one-game deep breakdown.

## Progress API

Endpoints:
- `POST /api/v1/progress/generate` with body `{ "recent_window": 10, "previous_window": 10 }`
- `GET /api/v1/progress/latest`
- `GET /api/v1/progress?limit=10`

## Settings API

Endpoints:
- `GET /api/v1/settings/profile`
- `PUT /api/v1/settings/profile`

## Home API

Endpoints:
- `GET /api/v1/home/summary?recent_window=10`

## Validation

From `backend` (uses the standard-library test runner and installed backend requirements):

```powershell
python -B -m unittest discover -s tests -v
```

Tests cover normalization, malformed input, offline operation, duplicate imports,
seed target guards, fixture trends, and existing review/coaching/progress services.
From `frontend`: `npm ci` then `npm run build`.

## Guiding Principle

Build each capability vertically so every step becomes usable in the UI, not just structurally complete.
