# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plan 1 of 4 EXECUTED and merged to main (CI green). Match-3 logic core complete: 68 tests, deterministic, pure TS. Next: write plan 2 (headless simulator + level calibration). Plans 2-4 not yet written.
- **Plan 2 must-dos (from final review):** findValidMoves + deadlock shuffle as first task (promote game.test.ts helper into core); RNG getState/setState; barrel export src/core/match3/index.ts; batch runner playLevel(level, policy). Plan 3: surface swap-rejection reason in MoveOutcome. Plan 4: scoring/stars metric.
- **Luana narrative skin:** famous influencer managed by brother Charles (personal layer only; decision #19).
- **Spec:** `docs/superpowers/specs/2026-07-01-omnigame-match3-design.md`
- **Code:** src/core/ (rng + match3: types, board, matches, swap, gravity, boosters, resolve, goals, level, game) + levels/kitchen/001.json. npm test / npm run typecheck. CI runs both on push.

## How Charles works

- Concise communication. Decisions + playable builds — he doesn't read code.
- Full superpowers discipline: spec → plan → TDD → code review.
- Two-layer principle in everything: Luana's personal/simple layer on top, generic/configurable public layer built underneath (theme packs, text tiers, profiles).

## Key constraints

- Logic cores are pure TypeScript, zero Phaser imports. Presentation is a thin, swappable Phaser layer.
- All randomness through a seeded RNG (deterministic core). Levels are JSON data, calibrated by a headless simulator.
- MVP cut: kitchen chapter + one furnishable room. Assets: CC0 (tracked in LICENSES.md). Perf target: mid-range Android 2022+.
- Not