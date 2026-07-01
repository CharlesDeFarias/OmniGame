# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plans 1 AND 2 of 4 EXECUTED and merged to main (CI green). Logic core + simulator complete: 94 tests. Kitchen levels 001-010 authored and calibrated (see docs/superpowers/calibration/). Next: write plan 3 (Phaser presentation + PWA).
- **Plan 3 must-dos (from reviews):** render the `shuffle` ResolveEvent (fires in 12-17% of runs on 6-color levels — load-bearing); handle escaped ShuffleError as level-regenerate (never strand the player); surface swap-rejection reason in MoveOutcome for wiggle feedback; startLevel's opening shuffle is silent (just render resulting board). Plan 4: scoring/stars metric.
- **Calibration caveats:** current 7-10-move budgets are an artifact of collect-only goals — valid ONLY until obstacles land, then re-author longer levels. giftMoves 5 is proportionally huge (~60% of budget): most level endings are decided in gift territory — deliberate comeback mechanic, confirm feel with Charles/Luana playtest. Levels 004/010 sit at the random-band floor (fragile to any engine change). Lever hierarchy: colorCount > moves; 4-color levels cannot satisfy both win-rate bands.
- **Simulator CLI:** `npm run simulate -- <level.json> [runs]`.
- **Luana narrative skin:** famous influencer managed by brother Charles (personal layer only; decision #19).
- **Spec:** `docs/superpowers/specs/2026-07-01-omnigame-match3-design.md`
- **Code:** src/core/ (rng + match3 incl. moves/shuffle + barrel index.ts) + src/sim/ (policies, run, simulate) + scripts/simulate.ts + levels/kitchen/001-010.json. npm test / npm run typecheck / npm run simulate. CI runs typecheck+tests on push.

## How Charles works

- Concise communication. Decisions + playable builds — he doesn't read code.
- Full superpowers discipline: spec → plan → TDD → code review.
- Two-layer principle in everything: Luana's personal/simple layer on top, generic/configurable public layer built underneath (theme packs, text tiers, profiles).

## Key constraints

- Logic cores are pure TypeScript, zero Phaser imports. Presentation is a thin, swappable Phaser layer.
- All randomness through a seeded RNG (deterministic core). Levels are JSON data, calibrated by a headless simulator.
- MVP cut: kitchen chapter + one furnishable room. Assets: CC0 (tracked in LICENSES.md). Perf target: mid-range Android 2022+.
- Not