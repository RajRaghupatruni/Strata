# Strata

> First-publication scope: a local, single-user demo with supported synthetic Riot-like data and deterministic coaching. No Riot or AI credentials are required. The private-user wording below records the original product direction; it does not imply bundled personal player data or a hosted service.

## Name

Strata is the product name for this app.

### Why Strata
The name suggests layers, structure, intelligence, depth, and perspective.

That fits the product because Strata is not meant to be a shallow stat tracker. It is meant to work across multiple layers of player improvement:

- raw match data
- performance patterns
- review history
- coaching logic
- progress over time

The name feels modern, stylish, intelligent, and premium without sounding cliché, robotic, or overly gamer-branded.

### Naming intent
Strata should evoke:
- layered understanding
- analytical depth
- clear structure
- quiet confidence
- a modern and polished dark product aesthetic

---

## Product Vision

Strata is a private, local-first Valorant improvement operating system built for one player.

It is not just a stat tracker, a match history viewer, or a one-time analyzer. It is a complete personal performance and coaching system that ingests match data, organizes gameplay history, detects patterns across maps, agents, roles, and sessions, supports replay and review workflows, and generates actionable improvement plans over time.

The first version of Strata is built for a single private user running locally. It is designed with the full long-term product vision in mind, so that later it can be extended into a public multi-user platform without changing the core product identity.

---

## Core Idea

Most Valorant tools describe performance.  
Strata is designed to improve performance.

Instead of only showing numbers like win rate, K/D, ADR, or HS%, Strata should answer questions such as:

- What is costing me the most games right now?
- Which maps and agents are actually helping me climb?
- What patterns are improving and what patterns are getting worse?
- What should I stop doing immediately?
- What should I focus on in my next session?
- Is the advice I followed actually working?

Strata acts as a private analyst, review workspace, and coaching system in one product.

---

## Product Definition

Strata is a private local-first Valorant coaching and improvement OS that:

- stores and organizes match history
- analyzes player performance over time
- supports replay and match review
- tracks recurring strengths and weaknesses
- generates coaching insights and session plans
- measures whether improvement actions are working

The product should feel like a personal performance operating system rather than a generic stat dashboard.

---

## End Goal

The end goal is a full personal coaching system that turns Valorant data into:

- a clear picture of actual performance
- pattern detection across maps, agents, roles, sessions, and trends
- concrete advice on what to stop, keep, and improve
- replay and match review workflows
- weekly and session-based improvement plans
- progress tracking over time

When fully built, Strata should function as a single private app that acts like the user's:

- stats analyst
- ranked performance coach
- session reviewer
- improvement planner
- progress tracker

The first build should already represent the real product vision. The only major capabilities intentionally deferred are public scale capabilities such as:

- multiple users
- public authentication
- hosted infrastructure
- billing
- public deployment
- collaboration features

---

## What We Are Building Now

We are building the complete product vision, but for:

- one user
- local and private usage
- one machine
- no public accounts
- no billing
- no multi-user backend
- no mandatory cloud dependency

The intention is to build the real product now, privately, with the same feature set and architecture mindset. Later, the main changes for public release should be infrastructure-oriented rather than a total product rewrite.

---

## What the Finished Private Version Should Feel Like

When finished, the app should feel like a complete personal performance console.

The user should be able to open the app and see:

### Home
- current rank or climb context
- recent trend
- strongest and weakest maps
- strongest and weakest agents
- current focus area
- next review suggestion

### Matches
- full match history
- filtering and browsing
- match-level inspection
- note attachment

### Insights
- what is improving
- what is getting worse
- what is costing games
- strongest and weakest patterns

### Review
- replay notes
- match notes
- round tags
- recurring mistake tagging

### Coach
- this week's focus
- what to stop
- what to keep
- what to practice next

### Progress
- whether actual performance is improving
- whether issues are decreasing
- whether coaching actions are helping

---

## Target User

### Initial User
A single serious ranked Valorant player using the app privately on their own machine.

### Future Users
- solo ranked grinders
- duos
- Premier players and teams
- amateur teams and coaches
- small competitive communities

---

## Initial Product Scope

The first build is private and single-user, but should still include the full feature set we want in the long-term product, except for public-user infrastructure.

This means the first version should include:

- full local data storage
- full match analysis workflows
- review and notes workflows
- coaching outputs
- progress tracking
- persistent history
- future-ready modular architecture

This first version should not include:

- public auth
- multiple user accounts
- billing
- team collaboration
- cloud sync as a requirement
- public deployment as a requirement

---

## Product Goals

### Primary Goal
Help the player improve more effectively by turning gameplay data into focused, actionable decisions.

### Secondary Goals
- reduce aimless queueing
- reduce repeated mistakes
- create a clear review habit
- build accountability around improvement
- track whether changes are leading to better outcomes
- create a future-ready product architecture that can scale later

---

## Product Principles

### 1. Action over information
The app should not stop at showing data. It should convert data into recommendations.

### 2. Pattern detection over stat dumping
The app should identify meaningful trends, not overwhelm the user with raw numbers.

### 3. Local-first privacy
The first version is personal and private. The user owns the workflow and data.

### 4. Review-driven improvement
Replay notes, match reviews, and tagged mistakes are first-class features.

### 5. Measurable progress
The app should track whether the player is actually improving, not just provide one-time advice.

### 6. Future-ready architecture
Even though the first version is private, the codebase should be structured so it can evolve into a hosted multi-user product later.

---

## What Strata Eventually Becomes

At maturity, Strata should function as a complete Valorant Improvement OS.

It should serve as the user's:

- match intelligence system
- performance analyst
- coaching assistant
- replay review workspace
- practice planner
- progress tracker

The app should answer both retrospective and forward-looking questions.

### Retrospective
- What happened?
- Where am I strong?
- Where am I weak?
- What patterns keep repeating?

### Forward-looking
- What should I focus on next?
- What should I practice?
- What should I avoid queueing?
- Is my recent approach working?

---

## Core Modules

## Module 1: Match Data Hub
Stores and organizes all gameplay data.

### Responsibilities
- match history storage
- metadata by map, mode, agent, role, date, session
- trend history
- rank and RR tracking where available
- local persistence

### Purpose
Create a reliable source of truth for all player performance data.

---

## Module 2: Performance Analyzer
Transforms raw match data into insights.

### Responsibilities
- recent form analysis
- long-term baseline analysis
- map performance breakdown
- agent performance breakdown
- role performance breakdown
- streaks, volatility, and consistency
- comparisons across time windows

### Purpose
Help the user understand what is actually driving performance.

---

## Module 3: Review Workspace
Supports replay and post-match review.

### Responsibilities
- review notes
- round tags
- mistake tags
- clutch and highlight tags
- utility errors
- positioning issues
- tilt or decision-making markers
- review queue for later

### Purpose
Turn raw match history into a meaningful improvement archive.

---

## Module 4: Coaching Engine
The intelligence layer of the product.

### Responsibilities
- identify the most important current weakness
- prioritize what matters most now
- generate coaching summaries
- recommend what to stop, keep, and improve
- produce short-term focus points
- update recommendations over time

### Purpose
Convert analysis into direction.

---

## Module 5: Practice Planner
Turns insights into concrete training actions.

### Responsibilities
- next-session focus
- warmup recommendation
- review checklist
- weekly focus plan
- session goal generation
- practical follow-up actions

### Purpose
Move from analysis to execution.

---

## Module 6: Progress Tracker
Measures whether changes are working.

### Responsibilities
- before-vs-after comparisons
- issue recurrence tracking
- trend tracking over time
- recommendation effectiveness tracking
- improvement milestones

### Purpose
Create a feedback loop between recommendations and real outcomes.

---

## Module 7: Personal Context Layer
Stores persistent player context.

### Responsibilities
- preferred roles and agents
- target rank goals
- known weak maps
- recurring issues
- subjective notes from the user
- personal improvement priorities

### Purpose
Make the system more personalized and consistent over time.

---

## What Makes Strata Different

Strata should not be another Valorant tracker.

It should not just say:
- your ADR is 148
- your Bind win rate is 41%
- your top agent is Sage

It should say:
- stop forcing this agent on this map for now
- your early-round deaths are hurting your defense halves
- your climb is strongest when you play these two agents
- review these three rounds tonight
- this should be your focus in the next five games

The goal is to create a product that prescribes action, not just displays statistics.

---

## User Experience Vision

The app should feel clean, premium, focused, and analytical.

It should feel like opening a personal performance console.

### Desired qualities
- minimal but rich
- modern and dark
- clear hierarchy
- focused dashboards
- intelligent summaries
- low clutter
- confidence-inspiring language

The UI should avoid looking like:
- a generic esports overlay
- a toy stats site
- a robotic analytics panel
- a noisy gamer app

The UI should feel more like a modern performance product than a gaming gimmick.

---

## Key Screens

## 1. Home
A high-level command center.

### Should show
- current rank or current climb context
- recent form
- strongest and weakest patterns
- current coaching focus
- next recommended action
- quick access to review and insights

---

## 2. Matches
A full match history view.

### Should support
- browsing all matches
- filtering by map, agent, role, date, outcome
- opening match-level detail
- attaching notes and review tags

---

## 3. Insights
A dedicated analysis surface.

### Should show
- trend summaries
- pattern breakdowns
- strongest and weakest maps
- strongest and weakest agents
- comparison windows
- session quality and volatility

---

## 4. Review
A workspace for post-match or replay notes.

### Should support
- adding structured notes
- tagging mistakes
- flagging rounds for later review
- marking recurring issues
- storing reflection history

---

## 5. Coach
The app's recommendation layer.

### Should show
- current priority weakness
- what to stop
- what to continue
- what to practice next
- next-session focus
- weekly action plan

---

## 6. Progress
A longitudinal view of improvement.

### Should show
- trend shifts
- issues reducing or worsening
- performance changes after recommendations
- progress toward target rank or goals

---

## Data Inputs

The product should be designed to support one or more of these inputs over time:

- official Riot match data
- manually entered match details if needed
- replay references
- user review notes
- imported history files if supported later

The system should be input-flexible, but should preserve a clean internal data model.

---

## Agent Role in the Product

The AI agent is not the entire product.  
It is the decision-making layer inside the product.

### The agent should be able to:
- inspect recent match history
- compare recent performance to longer baselines
- identify the biggest current issue
- determine what matters most now
- generate a short coaching summary
- recommend next-session actions
- update its recommendations as new data appears

This means Strata is an app that contains an agent-driven coaching workflow.

---

## Local-First Architecture Vision

The first version should be built for local use.

### Expected characteristics
- runs on the user's machine
- local database or local storage
- no mandatory cloud dependency
- no required public login
- private usage only
- modular backend and frontend structure

### Design principle
Build it as a real product, not as a throwaway prototype.

That way, later expansion to a public product mainly becomes an infrastructure change rather than a total rebuild.

---

## Future Public Version

The public version of Strata would add:

- user accounts
- authentication
- hosted backend
- cloud database
- multi-user support
- team workspaces
- sync across devices
- optional paid plans
- coach and team collaboration features

The core product vision remains the same.

The public version is not a different product.  
It is the same product with shared infrastructure and user management.

---

## Non-Goals for the First Version

The first version does not need:

- social features
- public profiles
- leaderboards
- in-game overlays
- ad-based monetization
- mass user onboarding
- enterprise infrastructure
- large-scale notifications
- unnecessary feature sprawl

The goal is depth, usefulness, and strong architecture.

---

## Success Criteria

The first private version is successful if the user can:

- load and persist match history
- review matches and store notes
- see meaningful insights across time
- receive useful coaching recommendations
- track whether those recommendations help
- use the app regularly as a personal improvement system

The long-term product is successful if it becomes a trusted system that meaningfully helps players improve.

---

## One-Sentence Summary

Strata is a private local-first Valorant Improvement OS that transforms match data and review history into actionable coaching, practice direction, and measurable progress over time.
