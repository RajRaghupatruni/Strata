# Strata MVP Roadmap

> First-publication scope: a local, single-user demo with supported synthetic Riot-like data and deterministic coaching. No Riot or AI credentials are required. The private-user wording below records the original product direction; it does not imply bundled personal player data or a hosted service.

## Goal

Build the first complete private local-first version of Strata for one user.

This MVP is not a tiny throwaway prototype.
It is the first usable version of the real product, built privately and locally, without public-user infrastructure.

The MVP should include the core product experience:

- ingest match data
- store and browse match history
- analyze meaningful patterns
- support review notes and mistake tagging
- generate coaching summaries
- track progress over time

The MVP should exclude only public-product layers like auth, multi-user support, billing, and hosted infrastructure.

---

## MVP Definition

The Strata MVP is successful when the user can:

- load and persist their match history
- view meaningful performance insights
- add review notes and issue tags
- receive useful coaching output
- track progress across time
- use the app repeatedly as a private improvement system

---

## Build Philosophy

### 1. Build the real workflow first
Avoid fake placeholder product behavior where possible.

### 2. Keep the scope focused
Do not add social or decorative features early.

### 3. Ship vertically
Each phase should produce something visible and usable.

### 4. Preserve future extensibility
The MVP should not create dead-end architecture.

---

## MVP Phases

## Phase 1: Foundation

### Objective
Create the project structure and local app foundation.

### Deliverables
- frontend project scaffold
- backend project scaffold
- local database setup
- base routing structure
- shared config
- base design tokens and theme direction
- app shell and navigation skeleton

### Outcome
A running local app with real structure but minimal business features.

---

## Phase 2: Match Data Hub

### Objective
Create the first working version of the match ingestion and storage flow.

### Deliverables
- match schema
- local persistence for matches
- import or ingestion pathway
- match list endpoint
- match detail endpoint
- frontend match history screen
- filtering by basic fields such as map, agent, result, date

### Outcome
The user can load and browse their match history locally.

---

## Phase 3: Insights Engine

### Objective
Turn stored match data into useful analysis.

### Deliverables
- recent form calculations
- map performance breakdowns
- agent performance breakdowns
- role performance breakdowns
- trend summaries
- streak and volatility calculations
- insights API responses
- insights screen in frontend

### Outcome
The user can see meaningful patterns rather than raw records only.

---

## Phase 4: Review Workspace

### Objective
Allow structured review and note-taking for matches.

### Deliverables
- review note schema
- issue tag schema
- add, edit, delete review note flow
- issue tagging flow
- review page UI
- match detail integration for notes
- recurring issue grouping

### Outcome
The user can attach meaningful review history to gameplay.

---

## Phase 5: Coaching Engine v1

### Objective
Generate useful recommendations from analysis and review data.

### Deliverables
- structured coaching input contract
- coaching output schema
- first coaching generation service
- stored coaching reports
- coach page UI
- home screen coaching summary
- clear sections:
  - priority issue
  - stop doing
  - keep doing
  - improve next
  - next-session focus

### Outcome
The app starts acting like a personal performance coach.

---

## Phase 6: Progress Tracking

### Objective
Measure whether the user's patterns and recommendations are improving over time.

### Deliverables
- progress snapshot schema
- before-vs-after comparisons
- issue recurrence tracking
- recommendation effectiveness view
- progress page UI
- trend comparison modules

### Outcome
The app becomes a closed-loop improvement system instead of a one-time analyzer.

---

## Phase 7: Personal Context Layer

### Objective
Store user-specific goals and persistent preferences.

### Deliverables
- user profile schema
- preferred agents and roles
- target rank
- personal notes
- known weak areas
- settings page support
- context-aware coaching inputs

### Outcome
The coaching and analysis become more personalized.

---

## Phase 8: Home Command Center

### Objective
Create a polished front page that ties the product together.

### Deliverables
- high-level summary widgets
- recent form section
- strongest and weakest pattern cards
- coaching summary card
- next action card
- progress highlights
- quick links into matches, review, and coach

### Outcome
The app feels cohesive and operational as a daily-use product.

---

## Phase 9: UX Refinement

### Objective
Upgrade the app from functional to polished.

### Deliverables
- visual hierarchy tuning
- empty states
- loading states
- error states
- transitions and responsiveness
- dark premium UI refinements
- clearer copywriting
- keyboard and flow improvements

### Outcome
The app feels premium and intentional.

---

## MVP Feature Checklist

## Must-Have
- local-first architecture
- match storage
- match browsing
- filtering and searching
- insights and pattern detection
- review notes
- issue tags
- coaching report generation
- progress tracking
- persistent local context

## Nice-to-Have if time permits
- import helpers
- session grouping
- richer charts
- recommendation history timeline
- custom issue categories
- compare two time windows directly

## Not Included in MVP
- multi-user accounts
- public hosting
- cloud sync as requirement
- team collaboration
- social features
- billing
- public profile pages
- in-game overlay functionality

---

## Recommended Build Order

### Step 1
Foundation and app shell

### Step 2
Database schema and backend models

### Step 3
Match ingestion and match history screen

### Step 4
Insights calculations and insights screen

### Step 5
Review notes and issue tags

### Step 6
Coaching engine v1

### Step 7
Progress tracking

### Step 8
User context and settings

### Step 9
Home dashboard and polish

This order ensures that the coaching engine is built on real stored data and review behavior.

---

## MVP Screens

### 1. Home
Summary and current priorities

### 2. Matches
List and detail view of match history

### 3. Insights
Breakdowns, trends, and summaries

### 4. Review
Notes and issue tagging workspace

### 5. Coach
Generated recommendations and action plan

### 6. Progress
Before-vs-after and improvement tracking

### 7. Settings
User context and local preferences

---

## Data Requirements for MVP

At minimum, the MVP should be able to work with:

- match-level data
- basic performance stats
- map, agent, role, result metadata
- user-authored notes
- structured issue tags
- generated coaching outputs

Round-level detail and replay-linked metadata can be incremental additions if not available immediately.

---

## Coaching v1 Expectations

The first coaching engine does not need to behave like a fully autonomous super-agent.

It only needs to do these things well:

- read structured performance summaries
- read recent issue tags
- identify the main current weakness
- identify one or two strengths worth preserving
- generate a focused recommendation set
- keep outputs grounded and actionable

This is enough for a strong first version.

---

## Progress v1 Expectations

The first version of progress tracking should answer:

- Is the player's recent form better or worse?
- Are repeated issues happening less often?
- Did the last coaching focus help?
- Is the player trending toward their stated goal?

This can be simple at first as long as it is accurate and understandable.

---

## Design Direction

The MVP should visually feel:

- dark
- premium
- focused
- clean
- analytical
- modern
- restrained

Avoid:
- flashy esports clichés
- cluttered card spam
- neon overload
- noisy gamer dashboard aesthetics

---

## Technical Direction for MVP

### Frontend
React + TypeScript + Tailwind

### Backend
FastAPI + Python

### Database
SQLite

### Analysis
Python services

### Coaching
Structured service layer with LLM support

### Packaging
Run locally as a web app first

---

## Exit Criteria for MVP

The MVP is complete when:

1. the user can run the app locally
2. the user can persist and browse matches
3. the user can review and annotate matches
4. the app can generate useful insights
5. the app can generate a coaching report
6. the app can track progress over time
7. the product feels coherent enough for repeated real use

---

## What Happens After MVP

After the MVP is stable and personally useful, the next stage can include:

- richer ingestion
- replay integrations
- automation improvements
- better visualizations
- public-user infrastructure
- multi-user accounts
- cloud sync
- team mode
- coach collaboration mode

These are growth stages, not prerequisites for the MVP.

---

## Final Roadmap Summary

The Strata MVP is a complete private local-first first version of the real product.

It is not a demo.
It is the foundation of the full Valorant Improvement OS.

The only major capabilities intentionally deferred are those related to public scale:
- multiple users
- hosted infrastructure
- auth
- billing
- collaboration
