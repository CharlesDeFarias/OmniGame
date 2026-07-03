# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plans 1-5 of 6 EXECUTED and merged (6=meta-layer: apartment/profiles/stats screen UI/adaptive difficulty #24 — not yet written). PWA LIVE: https://charlesdefarias.github.io/OmniGame/ — 20 kitchen levels (011-020 with crates/ice at 15-24 move budgets), boosters+combos, real star scoring, chapter-complete screen, tutorial hand, hidden parent stats corner (5 taps top-left), mute + wake-lock, visual polish. 165 tests. Charles playtested through plan 4: 'so far so good'. Luana playtest deferred (her call). Next: plan 6.
- **Plan 6 carry-forwards:** renderer damage handler assumes box hp <= 2 (layout charset guarantees); goalHud.color field dead — remove opportunistically; confetti pips can briefly outlive a fast chapter-replay tap (cosmetic); clear particles share depth with HUD text band (cosmetic); journal is per-tab in-memory cache (single-player OK).
- **Calibration caveats:** 001-010 stay short (7-10 moves, collect-only; tutorial arc); 011-020 are the long-budget obstacle levels (15-24 moves; decision #22 resolved). Levels 004/010 sit at the random-band floor (fragile to engine changes — recalibrate if RNG stream ever shifts). Lever hierarchy: colorCount > obstacles > moves; ice is gentlest on the random floor; keep 6x6 movable area >= 2/3 or shuffle rates spike.
- **Simulator CLI:** `npm run simulate -- <level.json> [runs]`.
- **Luana narrative skin:** famous influencer managed by brother Charles (personal layer only; decision #19).
- **Spec:** `docs/superpowers/specs/2026-07-01-omnigame-match3-design.md`
- **Code:** src/core/ (match3 + barrel) + src/sim/ + src/render/ (PlayScene, layout, choreo, theme, audio, levels loader) + src/services/ (journal, progress) + scripts/. npm test / typecheck / simulate / build. Workflows: ci.yml (typecheck+tests) + deploy.yml (Pages). Phaser PINNED to v3 (npm latest = v4 — do not upgrade casually).

## How Charles works

- Concise communication. Decisions + playable builds — he doesn't read code.
- Full superpowers discipline: spec → plan → TDD → code review.
- Two-layer principle in everything: Luana's personal/simple layer on top, generic/configurable public layer built underneath (theme packs, text tiers, profiles).

## Key constraints

- Logic cores are pure TypeScript, zero Phaser imports. Presentation is a thin, swappable Phaser layer.
- All randomness through a seeded RNG (deterministic core). Levels are JSON data, calibrated by a headless simulator.
- MVP cut: kitchen chapter + one furnishable room. Assets: CC0 (tracked in LICENSES.md). Perf target: mid-range Android 2022+.
- Not