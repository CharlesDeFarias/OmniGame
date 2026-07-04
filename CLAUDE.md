# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plans 1-6.5 EXECUTED and merged; Plan 7 part 1 (design pass) DONE: studio-glam look (decision #43), app = 'Luana Studio'. NEXT: plan 8 (cooking game + hub), then manager panel (#50). Still open for later: real illustrated art, her-playlist music, serving mode. PWA LIVE: https://charlesdefarias.github.io/OmniGame/ — 4 chapters (kitchen/dance/gym/vanity, unlock at influencer level 1/3/4/5), 50 calibrated levels (obstacles from 011+), boosters+combos, star scoring, 4-currency economy (coins/followers/hearts/level; +5 coins/win per chapter index; rooms 440/360/420/460), furnishing + film-a-video milestones (choices + tap-beat) + wardrobe fashion sink, music piece-pack on dance chapter, dance breaks every 5th win, adaptive difficulty ±2, tutorial hand, hidden parent corner (5 taps top-left: stats/currencies/tier), mute + wake-lock. 254 tests. Progress/furnishing schemas at v2 (silent v1 migration, verified). Charles playtested through plan 4: 'so far so good'; Luana playtest still deferred.
- **Plan 7 carry-forwards:** sustained-1-star players hit a grind gate at kitchen exhaust (unlikely under adaptive tier; replay path exists); vanity 045/048/050 above soft greedy ceiling (random floor binds first — documented); wardrobe check mark is a text glyph (design pass); storage keys say .v1 but carry v2 payloads (intentional migration artifact). RESOLVED in 6.5: coin sink absent post-room-complete; chapter-replay reload boots play not career (boot rule levelIndex>0); dead avatar-0 texture; parent-corner list overflows past ~15 level rows; level-20 dance-break deferral (harmless). Resolved: confetti-outlives-replay (replay scene-restarts now). Older: renderer damage handler assumes box hp <= 2 (layout charset guarantees); goalHud.color field dead — remove opportunistically; confetti pips can briefly outlive a fast chapter-replay tap (cosmetic); clear particles share depth with HUD text band (cosmetic); journal is per-tab in-memory cache (single-player OK).
- **Calibration caveats:** 001-010 stay short (7-10 moves, collect-only; tutorial arc); 011-020 are the long-budget obstacle levels (15-24 moves; decision #22 resolved). Levels 004/010 sit at the random-band floor (fragile to engine changes — recalibrate if RNG stream ever shifts). Lever hierarchy: colorCount > obstacles > moves; ice is gentlest on the random floor; keep 6x6 movable area >= 2/3 or shuffle rates spike.
- **Simulator CLI:** `npm run simulate -- <level.json> [runs]`.
- **Luana narrative skin:** famous influencer managed by brother Charles (personal layer only; decision #19).
- **Spec:** `docs/superpowers/specs/2026-07-01-omnigame-match3-design.md`
- **Code:** src/core/ (match3 + barrel) + src/sim/ + src/render/ (PlayScene, layout, choreo, theme, audio, levels loader) + src/services/ (journal, progress) + scripts/. npm test / typecheck / simulate / build. Workflows: ci.yml (typecheck+tests) + deploy.yml (Pages). Phaser PINNED to v3 (npm latest = v4 — do not upgrade casually).

## Autonomous run (active, decision #45-46)

Charles is away; full autonomy granted. Order: plan 7 design pass -> plan 8 cooking+hub -> extras. Log EVERY judgment call in docs/REVIEW-QUEUE.md. If this session dies, a fresh session reads this ledger + the current plan doc and continues; greet Charles with a run summary + review queue.

## How Charles works

- Concise communication. Decisions + playable builds — he doesn't read code.
- Full superpowers discipline: spec → plan → TDD → code review.
- Two-layer principle in everything: Luana's personal/simple layer on top, generic/configurable public layer built underneath (theme packs, text tiers, profiles).

## Key constraints

- Logic cores are pure TypeScript, zero Phaser imports. Presentation is a thin, swappable Phaser layer.
- All randomness through a seeded RNG (deterministic core). Levels are JSON data, calibrated by a headless simulator.
- MVP cut: kitchen chapter + one furnishable room. Assets: CC0 (tracked in LICENSES.md). Perf target: mid-range Android 2022+.
- Not