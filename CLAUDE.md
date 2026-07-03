# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase:** plans 1-6.5 EXECUTED and merged. Plan 6.5: dance/gym/vanity chapters (unlock at influencer level 3/4/5) x 10 calibrated levels each (50 total), rooms (360/420/460 coins; +5 coins/win per chapter index), music piece-pack on dance, wardrobe fashion sink (6 outfits 80-220, equipped outfit feeds video+dance-break), progress/furnishing v2 with verified silent v1 migration, boot-rule fix, newly-unlocked-chapter pulse cue, vanity threshold 1150. 254 tests. NEXT: plan 7 (design/feel pass — needs Charles's visual references; manager panel; real theme-pack art). Plan 6 (meta-layer core): 4-currency wallet (coins/followers/hearts/influencer level, decisions #34-38), CareerScene hub with kitchen furnishing (6 slots x 3 styles, 440 coins total, affordable ~level 11 at 2-star pace), film-a-video milestone (outfit/pose choices + never-fail tap-beat), dance breaks every 5th win (procedural beat), adaptive difficulty tier ±2 (moves-tier floor 5, #24 v1), parent-corner currencies+tier. 199 tests. NEXT: plan 6.5 (dance/gym/makeup chapters + level sets + theme packs + leftover-coin sinks: groceries/shopping/fashion) then plan 7 (design/feel pass with Charles's references, #33; manager panel #plan7+). PWA LIVE: https://charlesdefarias.github.io/OmniGame/ — 20 kitchen levels (011-020 with crates/ice at 15-24 move budgets), boosters+combos, real star scoring, chapter-complete screen, tutorial hand, hidden parent stats corner (5 taps top-left), mute + wake-lock, visual polish. 165 tests. Charles playtested through plan 4: 'so far so good'. Luana playtest deferred (her call). Next: plan 6.
- **Plan 7 carry-forwards:** sustained-1-star players hit a grind gate at kitchen exhaust (unlikely under adaptive tier; replay path exists); vanity 045/048/050 above soft greedy ceiling (random floor binds first — documented); wardrobe check mark is a text glyph (design pass); storage keys say .v1 but carry v2 payloads (intentional migration artifact). RESOLVED in 6.5: coin sink absent post-room-complete; chapter-replay reload boots play not career (boot rule levelIndex>0); dead avatar-0 texture; parent-corner list overflows past ~15 level rows; level-20 dance-break deferral (harmless). Resolved: confetti-outlives-replay (replay scene-restarts now). Older: renderer damage handler assumes box hp <= 2 (layout charset guarantees); goalHud.color field dead — remove opportunistically; confetti pips can briefly outlive a fast chapter-replay tap (cosmetic); clear particles share depth with HUD text band (cosmetic); journal is per-tab in-memory cache (single-player OK).
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