# OmniGame — project ledger

Canonical state for any session working on this project. Keep this file and `docs/DECISIONS.md` current after every work session.

## What this is

A personal omnibus of ad-free, non-exploitative casual games. First MVP: a Royal Match-style match-3 for Charles's sister Luana (Down syndrome, ~2nd-grade reading, strong comprehension). Theme: an adult living their life and leveling up — subtle nudges toward independence. Fun first, always.

## Current state

- **Phase (2026-07-10, post runs 5-6):** PWA LIVE: https://charlesdefarias.github.io/OmniGame/ — the omnibus is: match-3 (saga map, 4 chapters, 50 calibrated levels, boosters/combos/assists/finale, adaptive ±2), the DINER cooking game (decision #62; order-stack shifts; recipe flow + serving mode preserved unrouted), the JETPACK runner (decision #62; hold-to-fly; gate-runner preserved unrouted), career rooms + furnishing + wardrobe + video milestones, manager panel (the brother/mayor, decision #61), dance breaks, hidden parent corner, mute/haptics/wake-lock. Look = ONE Kenney CC0 family (decision #60, docs/ART-BIBLE.md); textTier 'minimal'. 4-currency economy unchanged (coins/followers/hearts/level). 474 tests. Charles is live-iterating look+feel (queue 37-48 hold his open verdicts); Luana playtest still deferred. Backlog: tower game, city-builder + racing layers (queue #45), wardrobe-on-toon rebuild (#46), real illustrated art.
- **Plan 7 carry-forwards:** sustained-1-star players hit a grind gate at kitchen exhaust (unlikely under adaptive tier; replay path exists); vanity 045/048/050 above soft greedy ceiling (random floor binds first — documented); storage keys say .v1 but carry v2 payloads (intentional migration artifact). RESOLVED 2026-07-10: wardrobe check mark now the ui-check icon (was a text glyph); goalHud.color already gone (verified). RESOLVED in 6.5: coin sink absent post-room-complete; chapter-replay reload boots play not career (boot rule levelIndex>0); dead avatar-0 texture; parent-corner list overflows past ~15 level rows; level-20 dance-break deferral (harmless). Resolved: confetti-outlives-replay (replay scene-restarts now). Older: renderer damage handler assumes box hp <= 2 (layout charset guarantees); confetti pips can briefly outlive a fast chapter-replay tap (cosmetic); clear particles share depth with HUD text band (cosmetic); journal is per-tab in-memory cache (single-player OK).
- **Calibration caveats:** 001-010 stay short (7-10 moves, collect-only; tutorial arc); 011-020 are the long-budget obstacle levels (15-24 moves; decision #22 resolved). 2026-07-10 pass (queue #35): 010 recalibrated to 12+11+11 (random floor was 13.9% at n=2000, now 15.8%); 004/005 verified in band at n=2000. 004/010 remain the closest to the random floor (recalibrate if RNG stream ever shifts). Lever hierarchy: colorCount > obstacles > moves; ice is gentlest on the random floor; keep 6x6 movable area >= 2/3 or shuffle rates spike.
- **Simulator CLI:** `npm run simulate -- <level.json> [runs]`.
- **Luana narrative skin:** famous influencer managed by brother Charles (personal layer only; decision #19).
- **Spec:** `docs/superpowers/specs/2026-07-01-omnigame-match3-design.md`
- **Code:** src/core/ (match3 + barrel) + src/sim/ + src/render/ (PlayScene, layout, choreo, theme, audio, levels loader) + src/services/ (journal, progress) + scripts/. npm test / typecheck / simulate / build. Workflows: ci.yml (typecheck+tests) + deploy.yml (Pages). Phaser PINNED to v3 (npm latest = v4 — do not upgrade casually).

## Run 6 (COMPLETE) — mini-game rebuilds (decision #62)

Cooking is now the DINER (src/core/diner + DinerScene): Burger-Party-style picture-stack orders, tap-assemble, patience→tips, 5-customer shifts, stars by mistakes, wallet.earnCooking payout, pantry shield via consumeOne. The runner is now the JETPACK game (src/core/jetpack + JetpackScene): hold-anywhere-to-fly, 3 fixed-length runs, coins thread the gaps, 3 hearts + blink-invincibility, hearts-out = early end with progress kept, earnRunner 20-60 band. Both cores pure TS + TDD (474 tests total). PRESERVED UNROUTED: CookingScene/recipes/serving and RunnerScene/gaterunner — the hub routes to 'diner' and 'jetpack'. Reviews caught: bell-mash mistakes, tallest-dish-first ramp, invisible zero-height zap bars in shipped seeds (simulated + regression-tested), payout floor drift. Queue 47-48 hold Charles's playtest questions.

## Run 5 (COMPLETE) — full-Kenney look + sibling canon (decisions #60/#61, Charles live-iterated 3 rounds)

One CC0 Kenney family app-wide (docs/ART-BIBLE.md is the gate): shape-character pieces (color+shape+face), UI Pack v2 GUI composited behind the existing texture keys, Game Icons glyphs, Adventure-pack board frame with solid navy grid cells, toon brother (glasses+beard) in manager panel + map cameo, Luana's procedural avatar got glasses. textTier = 'minimal' now (decision #8 tier live: Puzzle/Cooking card words, Play pills, Level headers; popups use unstroked dark ink on the light cream sheet). Old art packs deleted; MANIFEST/LICENSES rewritten. NEXT (decision #62): cooking → Burger-Party-style order-stack diner (design ref only, old recipe flow preserved, economy stays); runner → jetpack style (Ourcade MIT reference). Queue #46: Luana avatar still procedural vs toon brother.

## Autonomous run 3 (COMPLETE) — RM feel deep pass (decision #58 → #59)

Shipped on feat/rm-feel, merged to main: CC0 SFX + Lilita One font (pre-handoff commit); booster choreography (SpecialActivation clear-event metadata — pure annotation, RNG-stream verified byte-identical; rocket streaks/TNT fuse-boom-shockwave/lightball zaps/propeller bezier flight/ball+ball board flash; cascade-tick pitch-up, match-pop round-robin, piece-drop); goal fly-to-counter (lag-and-snap display); moves-to-rockets win finale (src/core/match3/finale.ts pure planner, private rng, +3 coins/rocket cap 8, journal 'finale'); in-level assists LIVE (hammer 80c/row-arrow 100c/shuffle free; applyAssist through the extracted shared wave engine; charge only after valid resolution; journal 'assist_used'); pause sheet (gear → resume/replay/map/sound/haptics; haptics = new profile-gated setting omnigame.haptics.v1); map dressing v2 (round glossy nodes, current-node bounce, banner v2, haze+sparkles, page dots + trail stubs = queue #33 affordance). 454 tests (429 → 454). Every block adversarially reviewed pre-commit (fixes: board-flash box pop, assist charge ordering, pause drag-swap leak, Phaser-has-no-yoyoEase). New queue items 37-44 (feel timings, finale economy, assist prices, pause-replay generosity, paging dots). Working-clone note: a Windows path containing '&' breaks npm cmd-shims — local work happens in C:\Users\charl\code\OmniGame; the Documents folder is a browsable mirror.

## Autonomous run 2 (COMPLETE)

Shipped: gate-runner playable (#51), grocery runs (#52), serving mode + recipes 11-15, tower core seed (renderer Qs in docs/superpowers/calibration/2026-07-04-tower-seed.md), profile config split (#54, see docs/PUBLIC-BUILD.md). 404 tests. Plan 9 legit-look pass DONE (decision #55). Plan 10.5 RM parity DONE (decision #57, docs/RM-PARITY.md). Plan 10 RM-read milestone DONE (decision #56: CC0 pro art packs, saga MapScene = match-3 home, RM HUD; assets in public/assets/packs + MANIFEST.md; PreloadScene with procedural fallbacks). Remaining backlog: tower renderer, card game (deferred by Charles), real illustrated art (needs references), match-3 pay-feel holistic look (queue #10/#23), reachability-aware runner level validation (queue #24), serving/grocery playtest items (queue #25-27).

## Autonomous run 1 (COMPLETE)

Run finished: plans 7 + 8, manager panel, adaptive v2, gate-runner core, playlist infra all shipped (see docs/RUN-LOG.md). 335 tests. Next session: walk Charles through docs/REVIEW-QUEUE.md (21 items) and collect answers for: gate-runner renderer (queue #20), groceries/shopping sinks (#17), match-3-vs-cooking pay feel (#10), art references for the illustrated pass, serving mode, tower game.

## How Charles works

- Concise communication. Decisions + playable builds — he doesn't read code.
- Full superpowers discipline: spec → plan → TDD → code review.
- Two-layer principle in everything: Luana's personal/simple layer on top, generic/configurable public layer built underneath (theme packs, text tiers, profiles).

## Key constraints

- Logic cores are pure TypeScript, zero Phaser imports. Presentation is a thin, swappable Phaser layer.
- All randomness through a seeded RNG (deterministic core). Levels are JSON data, calibrated by a headless simulator.
- MVP cut: kitchen chapter + one furnishable room. Assets: CC0 (tracked in LICENSES.md). Perf target: mid-range Android 2022+.
- Nothing in core may ever depend on monetization. Never strand the player: errors recover, progress saved after every level.

## Git workflow (restored 2026-07-04 — was lost in a ledger rewrite)

- Source of truth: https://github.com/CharlesDeFarias/OmniGame. Sandbox clone at /sessions/<session>/omnigame does all git ops; the mounted folder is a synced browsable copy (holds no .git). Push auth: token in the mounted folder's .secrets/github-token (gitignored).
- COMMIT POLICY (Charles, 2026-07-04): commit after every task (standard) AND push the feature branch to origin after EVERY task completion — in-flight work must never exist only in the ephemeral sandbox. Merges to main push immediately; deploys are automatic (deploy-pages step is flaky — rerun-failed-jobs via API usually fixes it).

