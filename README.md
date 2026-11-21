# GRIDFALL — The World That Runs On Nothing

A pixel-art city of autonomous agents who work, scheme, vote, get rich, go broke and die — continuously, in front of everyone.

**No server runs it.** The world is a pure function of the UTC clock and one fixed seed:

```
state(T) = simulate(SEED, T)
```

Every visitor, on any device, computes the same city at the same instant, to the pixel. A short hash in the corner (`WORLD STATE #…`) proves it: two phones, one hash.

Consequences:

1. **Running cost: $0.** No LLM calls, no cron, no simulation backend.
2. **Every second has a permalink.** `/t/2026-12-03T21:14:00Z` replays the city at that moment, back to Genesis.
3. **The future is already computed.** Luna, the Oracle, can see it. So can you — ten minutes ahead, through static.

Season 1 (a seven-day social feed) is not erased: its ruins stand in the south-west of the map, and its 514 posts are readable at `/archive`.

## How it works

| Layer | What | Where |
| --- | --- | --- |
| Clock | 1 real minute = 12 world minutes; one macro step per world hour | `lib/sim/config.ts` |
| Macro-sim | economy, relations, moods, factions, elections, laws, deaths, births — integers only | `lib/sim/` |
| Storylets | 69 narrative rules with conditions, seeded odds, effects and lines | `lib/sim/storylets.ts` |
| Language | procedural grammars over a hand-written corpus, assembled at runtime | `data/lines/`, `lib/lines/` |
| Micro-sim | schedules → deterministic A* walks → fixed-point positions | `lib/micro/` |
| Rendering | Canvas 2D, integer zoom, procedural tiles and sprites, day/night | `lib/render/` |
| Checkpoints | one serialized state per real day, built at deploy time | `scripts/build-checkpoints.ts` |
| Observers | Supabase Realtime Presence → floating eyes (cosmetic only) | `lib/world/presence.ts` |

Determinism rules: seeded PRNG keyed by `(seed, hour, channel, …)`, money in cents, no transcendental math, no clock reads and no unordered iteration inside the simulation (enforced by ESLint).

## Develop

```bash
npm install
npm run dev
```

```bash
npm test
```

Tests cover: identical hashes for the same instant, checkpoint + replay equal to a full replay, a year of world under a time budget, invariants over a simulated month (no negative money, no agent inside a wall, an election every week), law effects, and that observers can never touch the state.

`npm run build` regenerates checkpoints and the Season 1 artefacts (`prebuild`).

## Environment

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | observer presence (optional — the world runs without it) |
| `SUPABASE_SERVICE_ROLE_KEY` | waitlist, server-side only |
| `ADMIN_KEY` | `/admin` waitlist export, checked server-side |
