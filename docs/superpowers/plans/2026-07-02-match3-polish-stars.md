# Match-3 Polish + Stars Implementation Plan (Plan 4 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the live build feel finished: real star scoring, juicier visuals (board backdrop, particles, HUD panels), corrected gift choreography, a chapter-complete screen, and friendly shuffle/restart cues. Addresses Charles's playtest verdict: "plays smoothly but very clearly unpolished."

**Scope note (replan):** the former plan 4 is split — this plan (polish+stars), plan 5 (obstacles + re-authored levels), plan 6 (meta-layer: apartment, profiles, stats screen, adaptive difficulty #24).

**Architecture:** stars computed in the pure core (TDD); all visual work stays in `src/render/` with the snap-sync pattern intact. No new dependencies.

**Git workflow:** sandbox clone, branch `feat/match3-polish` off main; commits as `Charles DeFarias <cddefari@gmail.com>`; controller pushes/merges. Verification gates per task: `npx tsc --noEmit`, `npm test`, `npm run build`.

---

### Task 0: Star scoring in the core (TDD)

**Files:** Create `src/core/match3/stars.ts`; test `src/core/match3/stars.test.ts`; modify `src/core/match3/index.ts` (export)

Rules (fixed): won via gift → 1 star. Won without gift but < 25% of base moves remaining → 2 stars. Won without gift with ≥ 25% of base moves remaining → 3 stars. Not won → 0.

- [ ] **Step 1: failing test `src/core/match3/stars.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { starsFor } from './stars';

const base = { status: 'won' as const, giftUsed: false, movesLeft: 0, baseMoves: 8 };

describe('starsFor', () => {
  it('0 stars when not won', () => {
    expect(starsFor({ ...base, status: 'playing' })).toBe(0);
    expect(starsFor({ ...base, status: 'lost' })).toBe(0);
  });

  it('1 star when won via gift', () => {
    expect(starsFor({ ...base, giftUsed: true, movesLeft: 3 })).toBe(1);
  });

  it('2 stars when won cleanly but tight (movesLeft < 25% of base)', () => {
    expect(starsFor({ ...base, movesLeft: 1 })).toBe(2);
    expect(starsFor({ ...base, movesLeft: 0 })).toBe(2);
  });

  it('3 stars when won cleanly with >= 25% of base moves left', () => {
    expect(starsFor({ ...base, movesLeft: 2 })).toBe(3);
    expect(starsFor({ ...base, baseMoves: 10, movesLeft: 3 })).toBe(3);
  });
});
```

- [ ] **Step 2:** run → FAIL. **Step 3: `src/core/match3/stars.ts`:**

```ts
import type { GameStatus } from './game';

export interface StarInput {
  status: GameStatus;
  giftUsed: boolean;
  movesLeft: number;
  /** The level's base move budget (LevelDef.moves). */
  baseMoves: number;
}

/** 0 = not won; 1 = won via gift; 2 = clean but tight; 3 = clean with >= 25% of budget left. */
export function starsFor(s: StarInput): 0 | 1 | 2 | 3 {
  if (s.status !== 'won') return 0;
  if (s.giftUsed) return 1;
  return s.movesLeft >= s.baseMoves * 0.25 ? 3 : 2;
}
```

- [ ] **Step 4:** add to barrel `src/core/match3/index.ts`: `export { starsFor } from './stars'; export type { StarInput } from './stars';` — extend the barrel test's name list with `'starsFor'`. Run: stars tests PASS, suite 115 (111 + 4), tsc clean. **Step 5:** Commit `feat(core): star scoring metric`.

---

### Task 1: Wire stars into the win screen + record in journal/progress

**Files:** Modify `src/render/PlayScene.ts`, `src/services/progress.ts`, `src/services/progress.test.ts`

- [ ] **Step 1 (TDD for progress):** extend ProgressData to `{ version: 1; levelIndex: number; completed: Record<string, true>; stars?: Record<string, number> }` — loadProgress must default `stars` to `{}` when absent/invalid (append test):

```ts
  it('defaults stars to empty and round-trips them', () => {
    const s = memStorage();
    expect(loadProgress(s).stars).toEqual({});
    saveProgress(s, { version: 1, levelIndex: 1, completed: { 'kitchen-001': true }, stars: { 'kitchen-001': 3 } });
    expect(loadProgress(s).stars).toEqual({ 'kitchen-001': 3 });
  });
```

Make `stars` a REQUIRED field on ProgressData (simpler): update the two existing `toEqual` expectations in progress.test.ts to include `stars: {}` / the saved value, keep version 1 (additive, old saves load with stars defaulted — no migration needed).

- [ ] **Step 2:** implement in progress.ts (validate object-not-array like completed; default `{}`).

- [ ] **Step 3 (PlayScene):** in `onWin()`: compute `const stars = starsFor({ status: this.state.status, giftUsed: this.state.giftUsed, movesLeft: this.state.movesLeft, baseMoves: this.state.level.moves });` — show exactly `stars` star sprites (loop `i < stars`, keep positions for 3 slots; empty slots get a dim gray star: same texture, `setTint(0x555566)`, shown for all 3 slots first, gold pops over them). Record: `this.progress.stars[this.state.level.id] = Math.max(stars, this.progress.stars[this.state.level.id] ?? 0);` before saveProgress; journal `level_end` gains `stars`.

- [ ] **Step 4:** suite 117-ish green (updated progress tests), tsc clean, build green. **Step 5:** Commit `feat(render): real star scoring on win screen, best-stars persistence`.

---

### Task 2: Feel fixes — gift order, wiggle gate, cascade pitch

**Files:** Modify `src/render/PlayScene.ts`, `src/render/audio.ts`

- [ ] **Step 1 (gift order):** in `runTurn`, the gift branch currently runs after `updateHud()` so the counter already shows gifted moves. Fix: when `out.gift !== undefined`, call `updateHud` with the PRE-gift value first — simplest correct sequence: keep a `movesBeforeGift = this.state.movesLeft - out.gift` shown by a targeted `this.movesText.setText(String(movesBeforeGift))` right after `syncBoard()`, then `await this.celebrateGift(out.gift)`, THEN full `updateHud()`. (Goals HUD can update immediately — only the move counter is staged.)

- [ ] **Step 2 (wiggle gate):** in `attemptSwap`, set `this.busy = true` before the `no-match` wiggle and `false` after (`try/finally` around the whole invalid-branch handling), so overlapping wiggles can't fight. Ensure the ShuffleError catch path also clears busy.

- [ ] **Step 3 (cascade pitch):** in audio.ts add `matchAt(wave: number)` — like match() but frequencies multiplied by `1 + wave * 0.12` (cap wave at 6). In PlayScene, count clear-steps within `runTurn` (`let wave = 0`, increment per 'clear' step, pass to `this.blips.matchAt(wave)` instead of match(); keep booster() for >= 6 cells). Rising pitch per cascade = classic juice.

- [ ] **Step 4:** tsc/test/build green. **Step 5:** Commit `feat(render): gift counter staging, wiggle busy-gate, rising cascade pitch`.

---

### Task 3: Visual polish pass — board backdrop, particles, HUD panels, background

**Files:** Modify `src/render/theme.ts`, `src/render/PlayScene.ts`

- [ ] **Step 1 (backdrop):** in theme.ts makeTextures add `ui-tile` (rounded rect, fill 0xffffff): generate at 96. In PlayScene `startCurrentLevel`, after layout: destroy previous backdrop group if any; add one `ui-tile` image per board cell at cell centers, displaySize `cell * 0.98`, alpha alternating 0.06/0.10 (checker: `(x+y) % 2`), depth -1. Store in an array field for cleanup on level restart.

- [ ] **Step 2 (background):** in `create()`, before everything: two full-screen rectangles — base fill 0x1a1a2e (already the canvas color) plus a subtle vertical vignette: top rectangle (height 40% of screen) fill 0x24244a alpha 0.35, bottom similar 0x101020 alpha 0.35. Depth -2. Cheap gradient illusion, no new textures.

- [ ] **Step 3 (clear particles):** in `animateStep` 'clear' case, before the shrink tween: for up to 12 cleared cells, spawn 4 tiny `ui-pip` sprites at the cell center with random velocity tweens (x/y offset ±cell*0.8, alpha→0, scale 0.9→0.2, duration ~320ms, no await — fire and forget, they self-destroy onComplete). Tint them with the cleared piece's color when it was a normal piece (look up piece BEFORE destroying sprites — capture `at(board...)`? board already cleared in state; instead capture sprite tint source: read texture key of the sprite (`sp.texture.key`) and map 'gem-red'→COLOR_HEX.red etc.; specials get white). Import COLOR_HEX back into PlayScene.

- [ ] **Step 4 (HUD panels):** rounded-rect panels behind goals and the move counter: theme.ts gains `ui-panel` (rounded rect fill 0x000000): PlayScene draws goal panel (centered, sized to goal count) alpha 0.30 and moves panel alpha 0.30, depth 0 (icons/text depth 1+). Rebuild with goal HUD per level.

- [ ] **Step 5 (selected pulse):** in `select()`, add a looping scale pulse tween on the marker (1.0→1.06 yoyo repeat -1); kill the tween when deselecting (store the tween in a field, `.stop()` + null it before hiding).

- [ ] **Step 6:** tsc/test/build green; grep-confirm backdrop cleanup on restart (no leak across levels). **Step 7:** Commit `feat(render): board backdrop, clear particles, HUD panels, background vignette, selection pulse`.

---

### Task 4: Chapter-complete screen + friendly shuffle-restart cue

**Files:** Modify `src/render/PlayScene.ts`, `src/render/theme.ts`

- [ ] **Step 1 (trophy texture):** theme.ts: `ui-trophy` — gold cup: fillStyle 0xf1c40f, cup bowl (fillRoundedRect + two side arcs via fillCircle halves is fine — keep it simple: rounded rect bowl, thin stem rect, wide base rect), on the standard light badge circle like specials.

- [ ] **Step 2 (chapter flow):** in `onWin`, when `idx >= this.levels.length - 1` (last level): instead of the normal play button, show the chapter-complete screen after the stars: trophy sprite (scale-in bounce), slow confetti (24 ui-pip sprites tinted from COLOR_HEX values falling from top over 2s, fire-and-forget), and a replay button (`ui-retry` texture) that resets `this.progress.levelIndex = 0`, saves, journals `chapter_replay`, and starts level 1 with `retryCount = 0`. Journal `chapter_complete` stays (once per arrival — keep current call site but move it so it fires when the screen shows, not on button press).

- [ ] **Step 3 (shuffle-restart cue):** mid-move ShuffleError currently restarts silently. In the `attemptSwap` catch: before `startCurrentLevel()`, show a 900ms non-interactive overlay — dim rect + `ui-retry` sprite spinning (angle tween 0→360) at center — then destroy it and restart. Also apply the same cue in the `onLose` → retry path? NO — lose already has its explicit button; leave it.

- [ ] **Step 4:** tsc/test/build green. **Step 5:** Commit `feat(render): chapter-complete celebration, shuffle-restart cue`.

---

### Task 5: Final verification + merge + deploy check

- [ ] Controller: full gates; compact final review (cross-task: sprite/tween leaks across level restarts, depth ordering sanity, journal noise); merge `feat/match3-polish` → main; push; ci+deploy green; site 200; ledger update (phase; note stars rules #29 in decisions; plan 5/6 next); rsync mount; report to Charles with what changed visually.

---

## Self-review checklist

1. Playtest feedback addressed: polish (Task 3), real stars (Tasks 0-1), gift feel (Task 2), chapter end (Task 4), shuffle cue (Task 4) — all six plan-4 must-dos from the ledger covered; journal per-tab note stays accepted.
2. No placeholders; concrete parameters everywhere.
3. Types: StarInput consumed by PlayScene with GameState fields + level.moves; ProgressData.stars required field with defaulting loader (no version bump needed — additive).
