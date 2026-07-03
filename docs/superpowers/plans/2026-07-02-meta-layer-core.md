# Meta-Layer Core Implementation Plan (Plan 6 of 7)

> **For agentic workers:** superpowers:subagent-driven-development. TDD for services; build-gates for scenes; per-task review; commits as `Charles DeFarias <cddefari@gmail.com>` on branch `feat/meta-layer`; controller pushes/merges. Gates: `npx tsc --noEmit`, `npm test`, `npm run build`.

**Goal:** The influencer-career meta loop on top of the existing 20 levels (spec section "Meta-layer design", decisions #34-38): four currencies, career screen, kitchen furnishing, film-a-video milestone (choices + tap-beat minigame), dance breaks, adaptive difficulty v1, parent-corner integration. New themed chapters = plan 6.5; art direction pass = plan 7.

**Fixed numbers (tune in plan 6.5 with sim+playtest):**
- Coins per win: 20 + 10×stars. Hearts: +3 on a 3-star win.
- Kitchen room: 6 furniture slots (counter, fridge, table, lamp, plant, wall art) × 3 style choices each, prices 40/70/110 per slot (style choice is aesthetic; prices equal within a slot: 40 for slots 1-2, 70 for 3-4, 110 for 5-6). Room complete = all 6 furnished.
- Video payout: followers +25 +5×minigamePerf (perf 0-2), hearts +15. XP: stars×10 per level, +100 per video. Influencer level thresholds (cumulative xp): [0, 150, 400, 800, 1300, 2000, 3000] then +1200 each. Level-ups celebrate; unlock chapters later (6.5).
- Tap-beat minigame: 8 beats @ 100bpm procedural; hit window ±250ms; perf = 2 if ≥6 hits, 1 if ≥3, else 0 — NEVER fails, payout always happens.
- Dance break: offered after every 5th level WIN; optional overlay (dancing avatar + beat ~20s + prominent skip); journal completed/skipped. Procedural beat only (decision #37).
- Adaptive difficulty v1 (#24): tier ∈ [-2, +2], start 0. After each level_end: last 3 completed outcomes all 3-star wins → tier+1; 2 of last 3 lost → tier-1 (bounded). Applied at level start: effectiveMoves = max(5, moves - tier). Journal tier changes ('difficulty_tier'). Shown in parent corner.

### Task 0: Wallet service (TDD) — `src/services/wallet.ts`
WalletData {version:1, coins, followers, hearts, xp}. createWallet(storage): load (corruption/version-safe like progress.ts), `earnWin(stars)` (coins/hearts/xp per rules), `earnVideo(perf)` (followers/hearts/xp), `spend(cost)` (false if insufficient — never negative), `levelFor(xp)` pure export using the threshold table, getters. Persist on every mutation. Tests: earn math per rules incl. hearts-only-on-3-star; spend guard; level thresholds boundaries; persistence round-trip; corruption.

### Task 1: Furnishing service (TDD) — `src/services/furnishing.ts` + `src/meta/kitchenRoom.ts`
kitchenRoom.ts: catalog data (6 slots: id, textureBase, 3 choices {styleId, price} per fixed prices). furnishing.ts: FurnishState {version:1, rooms: {kitchen: Record<slotId, styleId>}}; load/save like progress; `furnish(slotId, styleId, wallet)` (spends via wallet.spend, false if broke or slot taken), `isRoomComplete('kitchen')`, `nextAffordableSlot(coins)`. Tests: buy flow debits wallet; occupied slot rejected; completion detection; persistence; insufficient funds.

### Task 2: Adaptive difficulty service (TDD) — `src/services/adaptive.ts`
AdaptiveState {version:1, tier, recent: {won: boolean, stars: number}[] (last 5)}. `recordOutcome(won, stars)` applies tier rules (bounded, returns {tier, changed}); `applyTier(level: LevelDef): LevelDef` (effectiveMoves rule; pure, returns modified copy; never mutates input; giftMoves untouched). Persist. Tests: promotion on 3×3-star streak; demotion on 2-of-3 losses; bounds; applyTier floor at 5 moves; state persistence; no-mutation.

### Task 3: Meta textures — theme.ts additions
Procedural (plan-7 will restyle): avatar (simple friendly figure: skin-tone circle head 0xf0c8a0, hair arc, torso in outfit color — parameterized `makeAvatarTexture(scene, key, outfitColor, poseIndex 0-2)` with 3 poses via arm angles); furniture ×6 slots ×3 styles (`furn-{slot}-{style}` — vary silhouette per slot + accent color per style; keep simple recognizable shapes: counter/fridge/table/lamp/plant/art); career UI: `ui-coin` (gold circle + inner ring), `ui-follower` (person silhouette badge), `ui-heart` (heart), `ui-level` (chevron badge), `ui-video` (camera), `ui-note` (music note), empty-slot marker (dashed rounded rect `ui-slot`).

### Task 4: CareerScene — `src/render/CareerScene.ts` + boot rewire
Currency bar top (coin/follower/heart/level icons + numbers). Kitchen room view: 6 slot positions on a simple room backdrop (floor/wall rects); furnished slots show chosen furniture texture; empty affordable slots pulse with `ui-slot` + price tag (coin icon + number); tap empty slot → 3-choice picker overlay (three furniture previews + prices; tap to buy via furnishing service; insufficient coins = wiggle). Chapter strip: kitchen icon (active) + 3 dimmed teasers (note/dumbbell placeholder circles). Big play button (ui-play) → scene.start('play'). PlayScene win flow: after star display, continue button → `scene.start('career')` instead of immediate next level (career's play button resumes). main.ts registers both scenes; boot: career if progress.levelIndex > 0 else play. Room completion detected after a furnish → launch video moment (Task 5).
NOTE scene data passing: PlayScene and CareerScene share services via fresh construction from localStorage each scene create() — services are cheap; no globals.

### Task 5: Video moment (in CareerScene as sub-flow)
On kitchen completion (once — persist a `videos: Record<roomId, true>` flag in FurnishState): dim → choice 1 "outfit" (3 avatar textures w/ different outfit colors, tap one) → choice 2 "pose" (3 poses w/ chosen outfit) → tap-beat minigame: `ui-note` pulses at 100bpm ×8 with expanding ring cue; taps within ±250ms flash gold (audio: new blips.beat(n) tick + success ding); perf tiers per fixed numbers → payout: camera flash white overlay, followers/hearts fly to currency bar (pip-style), wallet.earnVideo, journal 'video_filmed' {room, perf}. Skippable minigame (skip = perf 1). Audio additions to audio.ts: `beat()` metronome tick + `ding()`.

### Task 6: PlayScene integration
On win (before overlay): wallet.earnWin(stars); coin pips fly to a small coin counter added near movesText; adaptive.recordOutcome + journal tier changes. Level start: `applyTier` wraps currentDef() output (adaptive loaded per scene create). Dance break: track wins-since-break in FurnishState... no — separate tiny storage key in adaptive state? Add `winsSinceBreak` to AdaptiveState (increment on win; on 5th → after win overlay dismissed, show dance overlay: avatar bouncing (pose swap at beat rate), beat loop ~20s or until skip; journal 'dance_break' {completed}). Reset counter after offer.

### Task 7: Parent corner + ledger
Stats overlay gains: currency row (coins/followers/hearts/level) + adaptive tier row (ui-level icon + signed number). Ledger/decisions updated by controller at merge.

### Task 8: Final — full gates, whole-plan review (scene lifecycle across play↔career transitions, wallet/furnish/adaptive persistence integrity, no core imports from services→render), merge, deploy green, mount sync, report.
