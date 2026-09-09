# Supported synthetic fixture

`sample_matches.json` v1 is entirely fictional. It is generated from fixed constants
and a fixed PRNG seed by `scripts/generate_demo_fixture.py`; that script never reads
existing player data. Runtime loading reads only the checked-in values, not the clock
or a random generator. To reproduce the file, run from `backend`:

```powershell
python -B scripts/generate_demo_fixture.py
```

The fixture contains 40 competitive matches from August 10–29, 2026, over 20
two-match sessions. IDs are explicitly fictional (`demo-na-match-0001`, etc.).
Ascent/Omen, Haven/Sova, and Lotus/Killjoy improve over time; Bind/Jett declines.
Wins/losses, scorelines, combat scores, and K/D/A vary. These are constructed scenarios,
not recorded gameplay, population benchmarks, rank history, or observed coaching results.
Map and agent are paired deliberately; the demo cannot isolate their causal effects.

## Pipeline

`SyntheticMatchProvider` loads the fixture and calls the real adapter's
`normalize_riot_match` function. Both providers validate the consumed payload projection
with Pydantic before deriving a `MatchImportItem`. The seed CLI and API imports use
`insert_match_items` to persist normalized `Match` rows. Existing analytics operate on
those rows; the fixture contains no precomputed analytics or coaching outputs.

ACS is rounded score / rounds played. ADR is summed round damage / rounds played.
Headshot percentage is head hits / all landed hits. Round metrics are calculated only
when every played round has focal-player damage evidence; missing evidence stays null.
Win/loss and scoreline come from team results; UTC timestamps come from start milliseconds.
Stored metadata includes `source=synthetic`, `is_demo=true`, and `dataset_version=1`.

## Projection limitations

This is a reduced Riot-like payload, not a complete official match response. It includes
ten fictional participant identifiers, focal-player match stats and per-round damage,
team outcomes, and match information. Other players' combat statistics, detailed kill
events, economy, ability casts, and round positioning are omitted. Synthetic damage
and landed hits model aggregate variation, not a weapon-level simulation.

Agent identifiers are readable names and map identifiers use readable resource paths.
The existing real adapter still lacks a full content-ID/catalog resolver: raw UUIDs or
internal map aliases may display as identifiers. Known fixture agents map to their four
roles; unresolved real agents retain unknown roles. This limitation predates production
access and must be addressed/tested against approved payloads when real integration resumes.
The shared validator covers fields Strata consumes, not full Riot DTO conformance.

RR changes and rank are unavailable in this projection and remain null; no personal rank
inference is included. The seed adds no profile, review notes, recommendation history, or
progress snapshots. Use the existing UI to create those records. New recommendations
have no future evidence yet, so effectiveness should remain insufficient/unevaluated.

## Seed

From `backend`, with dependencies installed: `python -m app.seed_demo`.
Repeated runs skip existing external match IDs and retain other state. The command
validates the whole fixture before writing, permits only the default local SQLite
target/environment unless explicitly overridden, and never calls Riot or OpenAI.
Concurrent import serialization is not a substitute for the database constraint: external
match IDs are enforced unique in the schema, while duplicate skipping still provides
clear idempotent behavior for sequential runs and duplicates within a batch. This remains
a local single-user command.
