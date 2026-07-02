# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plans 1, 2 AND 3 of 4 EXECUTED and merged to main (CI + deploy green). PLAYABLE PWA LIVE: https://charlesdefarias.github.io/OmniGame/ (kitchen 001-010, boosters, procedural art/sound, offline-capable). 111 tests. Next: write plan 4 (meta-layer: apartment furnishing, stars/scoring, profiles/text tiers/theme packs, stats screen, obstacles + re-authored levels, adaptive difficulty #24).
- **Plan 4 must-dos (from reviews):** scoring/stars metric (win screen currently shows a FIXED 3 stars — placeholder); wiggle path un-gated by busy flag (drift-proofed by snap-sync, cosmetic); chapter-end replays last level with identical seed (needs chapter-complete screen); mid-move ShuffleError restarts level silently (consider a friendly cue); gift pips fly AFTER counter already updated (reorder for feel); journal is per-tab in-memory cache (single-player OK). Playtest with Luana before obstacle work: gift-territory feel (decision #22 caveat), short-level feel, wiggle clarity.
- **Calibration caveats:** current 7-10-move budgets are an artifact of collect-only goals — valid ONLY until obstacles land, then re-author longer levels. giftMoves 5 is proportionally huge (~60% of budget): most level endings are decided in gift territory — deliberate comeback mechanic, confirm feel with Charles/Luana playtest. Levels 004/010 sit at the random-band floor (fragile to any engine change). Lever hierarchy: colorCount > moves; 4-color levels cannot satisfy both win-rate bands.
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