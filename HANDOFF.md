# HANDOFF — OmniGame / Luana Studio (paste into Claude Code)

You are picking up an in-flight project mid-run. Read this fully, then read `CLAUDE.md` (canonical ledger) and `docs/RUN-LOG.md` before writing any code.

## Setup

- Source of truth: https://github.com/CharlesDeFarias/OmniGame — clone it fresh (`git clone`); do NOT trust any un-pushed local state. Push auth: fine-grained token in `.secrets/github-token` inside Charles's local project folder (gitignored; ask Charles if absent).
- Stack: TypeScript + Phaser 3 (PINNED v3 — npm "latest" resolves to v4, do not upgrade) + Vite + Vitest. Node 22.
- Commands: `npm install`, `npm test` (429 green as of handoff), `npm run typecheck`, `npm run build`, `npm run simulate -- <level.json> [runs]`.
- Deploy: push to `main` auto-deploys via GitHub Actions to https://charlesdefarias.github.io/OmniGame/ (deploy-pages step is flaky — rerun failed jobs; it always passes on retry).
- COMMIT POLICY: commit after every task AND push the feature branch after every task. Merge to main = push immediately.
- Discipline: TDD for anything in `src/core`/`src/services`/`src/sim` (pure TS, ZERO Phaser imports there — hard rule); build-gate + code review for `src/render` scenes. Never change RNG consumption on default paths — all 50 levels' difficulty calibration depends on the RNG stream (see `docs/superpowers/calibration/`). After core changes, run the calibration smoke suite (part of `npm test`).
- Ledger upkeep is mandatory: update `CLAUDE.md` (state), `docs/DECISIONS.md` (numbered decisions — next free number: 59), `docs/REVIEW-QUEUE.md` (judgment calls for Charles, 36 items so far), `docs/RUN-LOG.md` (plain-language progress) with every merge.

## Hard boundary (decisions #56/#57/#58)

Charles wants the match-3 as close to Royal Match as possible. Copy MECHANICS, layouts, palettes, animation BEHAVIOR freely — but NEVER reproduce Royal Match/Dream Games asset files, pixel-close artwork replicas, characters, logos, or names. Public repo = DMCA exposure. All art/sound must be CC0 (tracked in `LICENSES.md` + `public/assets/packs/MANIFEST.md`) or OFL fonts. Log every RM-modeled element in `docs/RM-PARITY.md`.

## Where the work stands (run 3, plan 11: "RM feel deep pass", decision #58)

Branch: `feat/rm-feel` (pushed). Done on it: commit `16e888a` — 16 CC0 Kenney SFX in `public/assets/audio/` wired via `sfx()` helper in `src/render/audio.ts` (fallback to synth blips), Lilita One display font for big numbers, PWA precache updated.

### REMAINING QUEUE (execute in order, one reviewed merge per block)

1. **Booster animation choreography** (the big one — RM's feel lives here). In `src/render/PlayScene.ts` `animateStep`, upgrade each event's animation; SFX keys already loaded:
   - rocket (clear of a full row/col from a striped piece): streak sprite (stretch the striped-candy texture or a white bar) sweeping the line + `rocket-whoosh` + camera shake 100ms + per-cell pop staggered 15ms along the line.
   - tnt: fuse spark (Kenney fx star_04) 250ms on the bomb, then `explosion-boom`, radial shockwave (ui-glow white scale 0.2→2 alpha 0.6→0), affected cells pop outward with slight radial offset.
   - lightball: `lightning-zap`; zap each target cell sequentially (25ms stagger) with a small white flash + tinted spark; the lollipop pulses while zapping.
   - propeller: lifts off (scale up + `propeller-whir`), arcs to its target over ~450ms (quadratic bezier via tween on a path or manual onUpdate), spins (angle), hits with pop + spark.
   - cascade ticks: `cascade-tick` with playbackRate 1 + wave*0.15; `match-pop-N` variants round-robin for clears; `piece-drop` on fall settle (throttle: once per fall event).
   - Combos get bigger versions (double shockwave, full-board flash for ball+ball).
2. **RM signature mechanics** (pure mechanics — freely copyable):
   - Goal-piece fly-to-counter: on clear, pieces matching a collect goal spawn a flying copy that arcs to the goal HUD icon (bezier, 400ms, shrink) + `collect-ding`; goal counter bumps when it lands (visual only — state already correct).
   - Moves-to-rockets win conversion: on win with movesLeft > 0, before the win overlay: convert up to N=movesLeft (cap 8) random normal cells into rockets that auto-fire one by one (150ms apart, reuse rocket choreography), each awarding +3 coins (wallet + pips). CORE NOTE: implement as renderer-driven sequence calling a NEW pure core helper (`src/core/match3/finale.ts`, TDD) that deterministically picks cells + returns fire events — do NOT mutate the finished GameState; it's a bonus layer. Journal 'finale' {rockets, coins}.
3. **In-level interactive boosters** (activates the currently-inert bottom bar): 3 slots = hammer (smash 1 chosen cell, 80 coins), row-arrow (clear chosen row, 100), shuffle (free, reuses core shuffleBoard via a safe path — note core shuffle is deterministic from game rng). Tap slot → arm → next board tap applies (hammer/arrow are RENDERER-initiated single-cell/row clears: add a core entry `applyAssist(state, kind, target)` in game.ts, TDD, that resolves like a booster wave WITHOUT consuming a move; charges wallet; journal 'assist_used'). Slot shows price chip; insufficient coins wiggle. Keep near-zero text (icons + numbers).
4. **Pause/settings menu**: gear button in-level (top-right under mute) → RM-anatomy pause sheet: resume (big green), replay, map (quit), sound toggle, haptics toggle (new profile-gated setting, localStorage). Journal 'pause_open'.
5. **Map dressing v2**: brighter RM-like map feel — node buttons restyled (pack art round buttons), current-node bounce, chapter banner with chapter name icon, subtle animated clouds/sparkles (Kenney fx, slow drift). Page-flip affordance if >10 levels (queue #33).
6. **Final review + merge + deploy + docs** (ledger/RM-PARITY/REVIEW-QUEUE/RUN-LOG per policy). Then ask Charles for his verdict + remind him of the paid-asset-pack option (itch.io/GraphicRiver match-3 GUI packs, $10-25, his purchase) as the next big look upgrade.

### Review protocol per block
Dispatch an independent adversarial review before each merge (subagent if available): gates (typecheck/test/build), RNG-stream integrity for any core change (calibration smoke + spot 500-run sims vs docs), scene lifecycle (tween/timer leaks across scene.start), economy sanity (no coin-positive farming loops), near-zero-text audit (numbers/icons only in Luana-facing views).

## Context you'll want

- The game: hub → 4 games (match-3 with saga map + career rooms; cooking with 15 recipes + serving mode; gate-runner; tower core staged headless). 4-currency economy (coins/followers/hearts/influencer level). Adaptive difficulty ±2 with obstacle injection. Hidden parent corner (5 taps top-left on hub) = stats + manager tasks + playlist music. Everything Luana-facing is near-zero text.
- `src/config/profile.ts` = the ONE personal-layer file (identity, feature flags). `docs/PUBLIC-BUILD.md` = generic-build guide.
- Known flaky: sandbox/CI deploy-pages step (retry), `npm test` may need chunking if a 45s process cap exists in your environment (vitest per-directory).
- Charles's style: concise; decisions + playable builds; he doesn't read code. When he's away: full autonomy, log judgment calls to REVIEW-QUEUE.md, keep deploying.
