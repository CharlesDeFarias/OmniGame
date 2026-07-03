# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plans 1-5 of 6 EXECUTED. Plan 5: boxes (hp1/hp2, adjacency+booster damage, gravity floors) + ice plates + clearBoxes/clearIce goals + segmented gravity + sim support; kitchen 011-020 calibrated at 15-24 move budgets (decision #22 confirmed); crate/ice rendering. 165 tests; levels 001-010 sim-verified byte-identical (RNG stream untouched). Next: plan 6 (meta-layer). OLD phase line: plans 1-4 of 6 EXECUTED and merged (replan: 4=polish+stars done, 5=obstacles+re-authored levels, 6=meta-layer: apartment/profiles/stats screen/adaptive difficulty #24). PWA LIVE: https://charlesdefarias.github.io/OmniGame/ — real star scoring, chapter-complete screen, shuffle cue, gift staging, visual polish (backdrop/particles/panels/vignette). 119 tests. Plan 4.5 (playtest-readiness) also done: zero-text tutorial hand on level 1, hidden parent stats corner (5 taps top-left corner within 2.5s — shows plays/wins/win%/gifts/retries/shuffles + per-level stars from the local journal), screen wake-lock, mute toggle (top-right). Charles playtested plan-3 build: 'plays smoothly, clearly unpolished' → plans 4/4.5 addressed. Next: Luana playtest, then plan 5.
- **Plan 6 carry-forwards:** renderer damage handler assumes box hp <= 2 (guaranteed by layout charset b/B); goalHud.color field dead — remove opportunistically. Older items: confetti pips can briefly outlive a fast chapter-replay tap (cosmetic); clear particles share depth 2 with HUD text (cosmetic). OLD plan-4 must-dos (all DONE in plan 4): scoring/stars metric (win screen currently shows a FIXED 3 stars — placeholder); wiggle path un-gated by busy flag (drift-proofed by snap-sync, cosmetic); chapter-end replays last level with identical seed (needs chapter-complete screen); mid-move ShuffleError restarts level silently (consider a friendly cue); gift pips fly AFTER counter already updated (reorder for feel); journal is per-tab in-memory cache (single-player OK). Playtest with Luana before obstacle work: gift-territory feel (decision #22 caveat), short-level feel, wiggle clarity.
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