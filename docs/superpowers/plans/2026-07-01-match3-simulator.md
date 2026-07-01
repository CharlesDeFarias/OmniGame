# Match-3 Simulator + Level Calibration Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the engine valid-move enumeration + deadlock shuffling, then build a headless simulator (policies, batch runner, CLI) and use it to author and calibrate kitchen levels 001-010.

**Architecture:** Core additions stay in `src/core/` (pure TS, deterministic, RNG-injected). The simulator lives in `src/sim/` and consumes the core ONLY through the new barrel export `src/core/match3/index.ts`. The CLI (`scripts/simulate.ts`, run via tsx) is the only node-dependent file.

**Tech Stack:** existing TS/Vitest toolchain + `tsx` devDependency for the CLI.

**Prerequisites:** Plan 1 merged (main at ff68fd3+, 68 tests green). Carries plan-1 final-review must-dos: findValidMoves/shuffle first, RNG getState/setState, barrel export, batch runner.

**Git workflow note (Cowork):** work in the sandbox clone `/sessions/<session>/omnigame` on branch `feat/match3-simulator` off main; commit per task as `Charles DeFarias <cddefari@gmail.com>`; controller pushes.

**Calibration targets (provisional until Luana playtests):** per level, greedy-policy win rate in [0.60, 0.95]; random-policy win rate ≥ 0.15; average greedy movesUsed ≤ moves + giftMoves. "Losing makes winning fun" = players lose sometimes, never hopelessly.

---

### Task 0: RNG state accessors

**Files:**
- Modify: `src/core/rng.ts`
- Test: `src/core/rng.test.ts` (append)

- [ ] **Step 1: Append failing tests to `src/core/rng.test.ts`** (inside `describe('createRng', ...)`):

```ts
  it('getState/setState round-trips the sequence', () => {
    const rng = createRng(42);
    rng.next();
    rng.next();
    const s = rng.getState();
    const expected = [rng.next(), rng.next()];
    rng.setState(s);
    expect([rng.next(), rng.next()]).toEqual(expected);
  });

  it('setState transplants state across instances', () => {
    const a = createRng(1);
    a.next();
    const b = createRng(999);
    b.setState(a.getState());
    expect(b.next()).toBe(a.next());
  });
```

- [ ] **Step 2: Run** `npx vitest run src/core/rng.test.ts` — the two new tests FAIL (getState is not a function).

- [ ] **Step 3: Extend `src/core/rng.ts`** — add to the interface:

```ts
  /** Opaque serializable state (uint32) for snapshots/branching simulations. */
  getState(): number;
  setState(state: number): void;
```

and to the returned object in `createRng`:

```ts
  const getState = (): number => a;
  const setState = (state: number): void => { a = state >>> 0; };
  return { next, int, pick, getState, setState };
```

- [ ] **Step 4: Run** `npx vitest run src/core/rng.test.ts` → 7 tests PASS. Then `npm test` (70 total) and `npx tsc --noEmit`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): RNG state accessors for snapshots and simulation"`

---

### Task 1: Valid-move enumeration

**Files:**
- Create: `src/core/match3/moves.ts`
- Test: `src/core/match3/moves.test.ts`
- Modify: `src/core/match3/game.test.ts` (replace local helper)

- [ ] **Step 1: Write failing test `src/core/match3/moves.test.ts`** (copy the `boardFrom` ASCII helper from an existing test file to the top):

```ts
import { describe, expect, it } from 'vitest';
import { findValidMoves, hasValidMove } from './moves';

describe('findValidMoves', () => {
  it('finds no moves on a deadlocked latin-square board', () => {
    const b = boardFrom(['rbg', 'bgr', 'grb']);
    expect(findValidMoves(b)).toEqual([]);
    expect(hasValidMove(b)).toBe(false);
  });

  it('finds the known move on a simple board', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const moves = findValidMoves(b);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves).toContainEqual({ a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
  });

  it('enumerates each candidate pair once (right and down only)', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const seen = new Set(findValidMoves(b).map((m) => `${m.a.x},${m.a.y}-${m.b.x},${m.b.y}`));
    expect(seen.size).toBe(findValidMoves(b).length);
  });
});
```

- [ ] **Step 2: Run it** — FAIL (cannot find './moves').

- [ ] **Step 3: Write `src/core/match3/moves.ts`:**

```ts
import { canSwap } from './swap';
import type { Board, Coord } from './types';

export interface Move { a: Coord; b: Coord; }

const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }] as const;

export function findValidMoves(board: Board): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      for (const d of DIRS) {
        const to = { x: x + d.x, y: y + d.y };
        if (to.x >= board.width || to.y >= board.height) continue;
        if (canSwap(board, { x, y }, to).valid) out.push({ a: { x, y }, b: to });
      }
    }
  }
  return out;
}

export function hasValidMove(board: Board): boolean {
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      for (const d of DIRS) {
        const to = { x: x + d.x, y: y + d.y };
        if (to.x >= board.width || to.y >= board.height) continue;
        if (canSwap(board, { x, y }, to).valid) return true;
      }
    }
  }
  return false;
}
```

- [ ] **Step 4: Refactor `src/core/match3/game.test.ts`** — delete its local `findValidMove` helper and replace with:

```ts
import { findValidMoves } from './moves';

function findValidMove(state: ReturnType<typeof startLevel>): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const moves = findValidMoves(state.board);
  if (moves.length === 0) throw new Error('no valid move found');
  return moves[0]!;
}
```

(Also remove the now-unused `import { canSwap } from './swap';` from that file.)

- [ ] **Step 5: Run** `npx vitest run src/core/match3/moves.test.ts src/core/match3/game.test.ts` → 8 PASS. `npm test` (73 total), `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(core): valid-move enumeration; game tests use it"`

---

### Task 2: Deadlock shuffle + game integration

**Files:**
- Modify: `src/core/match3/moves.ts` (append), `src/core/match3/resolve.ts` (event union), `src/core/match3/game.ts`
- Test: `src/core/match3/moves.test.ts` (append), `src/core/match3/game.test.ts` (append)

- [ ] **Step 1: Discovery script (throwaway, /tmp not repo):** scan for a small createBoard deadlock to use as a fixture:

```ts
// /tmp/find-deadlock.ts — run with: npx tsx /tmp/find-deadlock.ts
import { createRng } from '/sessions/wizardly-sleepy-faraday/omnigame/src/core/rng';
import { createBoard } from '/sessions/wizardly-sleepy-faraday/omnigame/src/core/match3/board';
import { hasValidMove } from '/sessions/wizardly-sleepy-faraday/omnigame/src/core/match3/moves';

for (const size of [4, 5]) {
  for (let seed = 0; seed < 200000; seed++) {
    const b = createBoard(size, size, createRng(seed), 3);
    if (!hasValidMove(b)) { console.log(`deadlock: size=${size} seed=${seed}`); process.exit(0); }
  }
}
console.log('none found');
```

(tsx is added in this task's Step 4; if you prefer, run the scan AFTER step 4, or inline the logic in a vitest scratch test and delete it.) Record the found `size`/`seed` — call them DL_SIZE/DL_SEED below. If truly none found, use the latin-square 3×3 fixture for shuffleBoard's throw-path test instead and note it in the commit message.

- [ ] **Step 2: Append failing tests to `src/core/match3/moves.test.ts`:**

```ts
import { createRng } from '../rng';
import { createBoard } from './board';
import { findMatchGroups } from './matches';
import { shuffleBoard } from './moves';

describe('shuffleBoard', () => {
  const pieceMultiset = (b: ReturnType<typeof createBoard>): string =>
    b.cells.map((c) => JSON.stringify(c)).sort().join('|');

  it('preserves pieces, removes matches, guarantees a valid move, deterministic per seed', () => {
    const mk = () => createBoard(6, 6, createRng(11), 4);
    const b1 = mk();
    const b2 = mk();
    const before = pieceMultiset(b1);
    shuffleBoard(b1, createRng(99));
    shuffleBoard(b2, createRng(99));
    expect(pieceMultiset(b1)).toBe(before);
    expect(findMatchGroups(b1, null)).toHaveLength(0);
    expect(hasValidMove(b1)).toBe(true);
    expect(b1).toEqual(b2);
  });

  it('rescues the discovered createBoard deadlock', () => {
    const b = createBoard(DL_SIZE, DL_SIZE, createRng(DL_SEED), 3);
    expect(hasValidMove(b)).toBe(false);
    shuffleBoard(b, createRng(1));
    expect(hasValidMove(b)).toBe(true);
    expect(findMatchGroups(b, null)).toHaveLength(0);
  });
});
```

(Replace DL_SIZE/DL_SEED with the discovered constants.)

- [ ] **Step 3: Run** — FAIL (shuffleBoard not exported).

- [ ] **Step 4: Append to `src/core/match3/moves.ts`:**

```ts
import { at, set } from './board';
import { findMatchGroups } from './matches';
import type { RNG } from '../rng';

export class ShuffleError extends Error { override name = 'ShuffleError'; }

/** Fisher-Yates over occupied cells: same piece multiset, new positions. Retries until the
 *  arrangement has no immediate matches and at least one valid move. Deterministic per RNG state. */
export function shuffleBoard(board: Board, rng: RNG, maxAttempts = 50): void {
  const coords: Coord[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (at(board, x, y) !== null) coords.push({ x, y });
    }
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = coords.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const ci = coords[i]!;
      const cj = coords[j]!;
      const tmp = at(board, ci.x, ci.y);
      set(board, ci.x, ci.y, at(board, cj.x, cj.y));
      set(board, cj.x, cj.y, tmp);
    }
    if (findMatchGroups(board, null).length === 0 && hasValidMove(board)) return;
  }
  throw new ShuffleError(`no playable arrangement found in ${maxAttempts} shuffles`);
}
```

Also install the CLI runner used by later tasks now: `npm install -D tsx` (single devDependency; committed with this task).

- [ ] **Step 5: Wire into the game.** In `src/core/match3/resolve.ts`, extend the event union with one member (renderer re-reads the board after a shuffle):

```ts
  | { type: 'shuffle' }
```

In `src/core/match3/game.ts`, import `hasValidMove, shuffleBoard` from './moves', then: in `startLevel`, after `createBoard`: `if (!hasValidMove(board)) shuffleBoard(board, rng);` — and in `applyMove`, after computing `status` but before building `next`, operating on `result.board`:

```ts
  let events = result.events;
  if (status === 'playing' && !hasValidMove(result.board)) {
    shuffleBoard(result.board, state.rng);
    events = [...events, { type: 'shuffle' }];
  }
```

(Use `events` in the returned MoveOutcome instead of `result.events`.)

- [ ] **Step 6: Append a wiring test to `src/core/match3/game.test.ts`:**

```ts
  it('startLevel auto-shuffles a deadlocked opening board', () => {
    const dl: LevelDef = {
      id: 'deadlock-1',
      seed: DL_SEED,
      board: { width: DL_SIZE, height: DL_SIZE, colorCount: 3 },
      moves: 5,
      giftMoves: 0,
      goals: [{ type: 'collect', color: 'red', count: 5 }],
    };
    const s = startLevel(dl);
    expect(findValidMoves(s.board).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 7: Run** moves+game tests (PASS), `npm test` (76 total), `npx tsc --noEmit` clean.

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat(core): deadlock shuffle wired into game; add tsx"`

---

### Task 3: Barrel export

**Files:**
- Create: `src/core/match3/index.ts`
- Test: `src/core/match3/index.test.ts`

- [ ] **Step 1: Failing test `src/core/match3/index.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import * as api from './index';

describe('public barrel', () => {
  it('exposes the full public surface', () => {
    for (const name of [
      'createRng', 'ALL_COLORS', 'createBoard', 'at', 'inBounds',
      'canSwap', 'isAdjacent', 'findValidMoves', 'hasValidMove', 'shuffleBoard',
      'resolveTurn', 'initGoals', 'applyCleared', 'goalsComplete',
      'parseLevel', 'LevelError', 'startLevel', 'applyMove',
    ]) {
      expect(api, name).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Write `src/core/match3/index.ts`:**

```ts
export { createRng } from '../rng';
export type { RNG } from '../rng';
export { ALL_COLORS } from './types';
export type { Board, Coord, Piece, PieceColor, SpecialKind } from './types';
export { at, createBoard, inBounds } from './board';
export { canSwap, isAdjacent } from './swap';
export type { SwapCheck } from './swap';
export { findValidMoves, hasValidMove, shuffleBoard, ShuffleError } from './moves';
export type { Move } from './moves';
export { resolveTurn } from './resolve';
export type { ResolveEvent, TurnResult } from './resolve';
export { applyCleared, goalsComplete, initGoals } from './goals';
export type { CollectGoal, Goal, GoalState } from './goals';
export { LevelError, parseLevel } from './level';
export type { LevelDef } from './level';
export { applyMove, startLevel } from './game';
export type { GameState, GameStatus, MoveOutcome } from './game';
```

- [ ] **Step 4: Run** (PASS; `npm test` 77 total; tsc clean). **Step 5: Commit** `git add -A && git commit -m "feat(core): public barrel export for match3"`

---

### Task 4: Simulator policies

**Files:**
- Create: `src/sim/policies.ts`
- Test: `src/sim/policies.test.ts`

- [ ] **Step 1: Failing test `src/sim/policies.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { createRng, findValidMoves, parseLevel, startLevel } from '../core/match3/index';
import { greedyPolicy, randomPolicy } from './policies';

const level = parseLevel({
  id: 'sim-test',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 20,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 12 }],
});

describe('policies', () => {
  it('randomPolicy returns a listed move, deterministically per seed', () => {
    const s = startLevel(level);
    const moves = findValidMoves(s.board);
    const m1 = randomPolicy(createRng(3))(s, moves);
    const m2 = randomPolicy(createRng(3))(s, moves);
    expect(moves).toContainEqual(m1);
    expect(m1).toEqual(m2);
  });

  it('greedyPolicy returns a listed move and does not advance the game RNG', () => {
    const s = startLevel(level);
    const before = s.rng.getState();
    const moves = findValidMoves(s.board);
    const m = greedyPolicy(createRng(4))(s, moves);
    expect(moves).toContainEqual(m);
    expect(s.rng.getState()).toBe(before);
  });

  it('greedyPolicy prefers a goal-scoring move over a zero-score move', () => {
    const s = startLevel(level);
    const moves = findValidMoves(s.board);
    const chosen = greedyPolicy(createRng(4))(s, moves);
    const { resolveTurn, createRng: mk } = await import('../core/match3/index');
    const trial = mk(0);
    trial.setState(s.rng.getState());
    const r = resolveTurn(s.board, chosen.a, chosen.b, trial, level.board.colorCount);
    const bestScore = r.clearedByColor.red ?? 0;
    expect(bestScore).toBeGreaterThanOrEqual(0);
  });
});
```

Note: the third test as written uses `await import` inside a non-async test — write it instead with a top-of-file import: add `resolveTurn` to the first import line and drop the dynamic import; assert the chosen move's red-clear count is `>=` the red-clear count of every other move in `moves` (loop them the same way greedy does). That is the real property. Write it that way:

```ts
  it('greedyPolicy is argmax over immediate goal progress', () => {
    const s = startLevel(level);
    const moves = findValidMoves(s.board);
    const chosen = greedyPolicy(createRng(4))(s, moves);
    const score = (m: (typeof moves)[number]): number => {
      const trial = createRng(0);
      trial.setState(s.rng.getState());
      const r = resolveTurn(s.board, m.a, m.b, trial, level.board.colorCount);
      return Math.min(12, r.clearedByColor.red ?? 0);
    };
    const best = Math.max(...moves.map(score));
    expect(score(chosen)).toBe(best);
  });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Write `src/sim/policies.ts`:**

```ts
import { createRng, resolveTurn } from '../core/match3/index';
import type { GameState, Move, RNG } from '../core/match3/index';

export type Policy = (state: GameState, moves: Move[]) => Move;

export function randomPolicy(rng: RNG): Policy {
  return (_state, moves) => rng.pick(moves);
}

/** Argmax over immediate goal progress: trial-resolves each move on the (never-mutated) board
 *  with a transplanted RNG copy, so the trial predicts exactly what applyMove would do. */
export function greedyPolicy(rng: RNG): Policy {
  return (state, moves) => {
    let bestScore = -1;
    let best: Move[] = [];
    for (const m of moves) {
      const trialRng = createRng(0);
      trialRng.setState(state.rng.getState());
      const r = resolveTurn(state.board, m.a, m.b, trialRng, state.level.board.colorCount);
      let score = 0;
      for (const g of state.goals) {
        const need = g.goal.count - g.collected;
        if (need > 0) score += Math.min(need, r.clearedByColor[g.goal.color] ?? 0);
      }
      if (score > bestScore) {
        bestScore = score;
        best = [m];
      } else if (score === bestScore) {
        best.push(m);
      }
    }
    return rng.pick(best);
  };
}
```

- [ ] **Step 4: Run** (PASS; suite 80; tsc clean). **Step 5: Commit** `git add -A && git commit -m "feat(sim): random and greedy move policies"`

---

### Task 5: playLevel runner

**Files:**
- Create: `src/sim/run.ts`
- Test: `src/sim/run.test.ts`

- [ ] **Step 1: Failing test `src/sim/run.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { createRng, parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { playLevel } from './run';

const easy = parseLevel({
  id: 'easy-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 30,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 3 }],
});

const brutal = parseLevel({
  id: 'brutal-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 2,
  giftMoves: 0,
  goals: [{ type: 'collect', color: 'red', count: 500 }],
});

describe('playLevel', () => {
  it('wins an easy level with greedy and reports sane numbers', () => {
    const res = playLevel(easy, greedyPolicy(createRng(1)));
    expect(res.won).toBe(true);
    expect(res.movesUsed).toBeGreaterThan(0);
    expect(res.movesUsed).toBeLessThanOrEqual(30 + 5);
  });

  it('loses an impossible level and stops', () => {
    const res = playLevel(brutal, greedyPolicy(createRng(1)));
    expect(res.won).toBe(false);
    expect(res.movesUsed).toBe(2);
  });

  it('is deterministic given level seed + policy seed', () => {
    const r1 = playLevel(easy, greedyPolicy(createRng(7)));
    const r2 = playLevel(easy, greedyPolicy(createRng(7)));
    expect(r1).toEqual(r2);
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Write `src/sim/run.ts`:**

```ts
import { applyMove, findValidMoves, startLevel } from '../core/match3/index';
import type { LevelDef } from '../core/match3/index';
import type { Policy } from './policies';

export interface PlayResult {
  won: boolean;
  movesUsed: number;
  giftUsed: boolean;
  shuffles: number;
}

export function playLevel(level: LevelDef, policy: Policy, maxSteps = 500): PlayResult {
  let state = startLevel(level);
  let movesUsed = 0;
  let shuffles = 0;
  for (let step = 0; step < maxSteps && state.status === 'playing'; step++) {
    const moves = findValidMoves(state.board);
    const mv = policy(state, moves);
    const out = applyMove(state, mv.a, mv.b);
    if (out.invalid) throw new Error(`policy returned invalid move at step ${step}`);
    state = out.state;
    movesUsed++;
    if (out.events.some((e) => e.type === 'shuffle')) shuffles++;
  }
  return { won: state.status === 'won', movesUsed, giftUsed: state.giftUsed, shuffles };
}
```

- [ ] **Step 4: Run** (PASS; suite 83; tsc clean). **Step 5: Commit** `git add -A && git commit -m "feat(sim): headless level runner"`

---

### Task 6: Batch statistics

**Files:**
- Create: `src/sim/simulate.ts`
- Test: `src/sim/simulate.test.ts`

- [ ] **Step 1: Failing test `src/sim/simulate.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { simulateLevel } from './simulate';

const easy = parseLevel({
  id: 'easy-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 30,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 3 }],
});

describe('simulateLevel', () => {
  it('aggregates stats over distinct boards and is deterministic', () => {
    const s1 = simulateLevel(easy, 20, greedyPolicy);
    const s2 = simulateLevel(easy, 20, greedyPolicy);
    expect(s1).toEqual(s2);
    expect(s1.runs).toBe(20);
    expect(s1.winRate).toBeGreaterThan(0.9);
    expect(s1.avgMovesUsed).toBeGreaterThan(0);
    expect(s1.winRate).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Write `src/sim/simulate.ts`:**

```ts
import { createRng } from '../core/match3/index';
import type { LevelDef, RNG } from '../core/match3/index';
import type { Policy } from './policies';
import { playLevel } from './run';

export interface SimStats {
  runs: number;
  winRate: number;
  avgMovesUsed: number;
  giftRate: number;
  shuffleRate: number;
}

/** Runs the level across `runs` board variants (seed offset per run) with an independently
 *  seeded policy per run. Measures the level CONFIG, not one particular board. */
export function simulateLevel(
  level: LevelDef,
  runs: number,
  policyFor: (rng: RNG) => Policy,
  seedBase = 1,
): SimStats {
  let wins = 0;
  let movesSum = 0;
  let gifts = 0;
  let shuffled = 0;
  for (let i = 0; i < runs; i++) {
    const variant: LevelDef = { ...level, seed: level.seed + i * 7919 };
    const res = playLevel(variant, policyFor(createRng(seedBase + i)));
    if (res.won) wins++;
    movesSum += res.movesUsed;
    if (res.giftUsed) gifts++;
    if (res.shuffles > 0) shuffled++;
  }
  return {
    runs,
    winRate: wins / runs,
    avgMovesUsed: movesSum / runs,
    giftRate: gifts / runs,
    shuffleRate: shuffled / runs,
  };
}
```

- [ ] **Step 4: Run** (PASS; suite 84; tsc clean). **Step 5: Commit** `git add -A && git commit -m "feat(sim): batch simulation statistics"`

---

### Task 7: CLI

**Files:**
- Create: `scripts/simulate.ts`
- Modify: `package.json` (script), `tsconfig.json` (include scripts)

- [ ] **Step 1: Write `scripts/simulate.ts`:**

```ts
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/core/match3/index';
import { greedyPolicy, randomPolicy } from '../src/sim/policies';
import { simulateLevel } from '../src/sim/simulate';

const file = process.argv[2];
const runs = Number(process.argv[3] ?? 200);
if (!file || !Number.isInteger(runs) || runs < 1) {
  console.error('usage: npm run simulate -- <level.json> [runs]');
  process.exit(1);
}
const level = parseLevel(JSON.parse(readFileSync(file, 'utf8')) as unknown);
const policies = [
  ['greedy', greedyPolicy],
  ['random', randomPolicy],
] as const;
for (const [name, factory] of policies) {
  const s = simulateLevel(level, runs, factory);
  console.log(
    `${level.id} ${name.padEnd(6)} runs=${s.runs} win=${(s.winRate * 100).toFixed(1)}% ` +
    `avgMoves=${s.avgMovesUsed.toFixed(1)} gift=${(s.giftRate * 100).toFixed(1)}% shuffle=${(s.shuffleRate * 100).toFixed(1)}%`,
  );
}
```

- [ ] **Step 2:** package.json scripts: add `"simulate": "tsx scripts/simulate.ts"`. tsconfig.json: change `"include": ["src"]` to `"include": ["src", "scripts"]`.

- [ ] **Step 3: Verify:** `npm run simulate -- levels/kitchen/001.json 100` prints two lines with plausible numbers; `npx tsc --noEmit` clean; `npm test` still green.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(sim): CLI level simulator"`

---

### Task 8: Author + calibrate kitchen 001-010

**Files:**
- Create: `levels/kitchen/002.json` … `levels/kitchen/010.json`
- Create: `docs/superpowers/calibration/2026-07-01-kitchen-001-010.md`
- Test: `src/sim/calibration.smoke.test.ts`
- Possibly modify: `levels/kitchen/001.json` (if calibration demands)

- [ ] **Step 1: Author starting drafts** from this progression table (seeds = 1000 + level number; giftMoves 5 everywhere):

| level | board | colorCount | moves | goals |
|---|---|---|---|---|
| 002 | 6×6 | 4 | 20 | blue 14 |
| 003 | 6×6 | 4 | 22 | red 10 + blue 10 |
| 004 | 7×7 | 4 | 22 | green 18 |
| 005 | 7×7 | 4 | 24 | red 14 + yellow 14 |
| 006 | 7×7 | 5 | 24 | blue 16 |
| 007 | 7×7 | 5 | 26 | red 14 + green 14 |
| 008 | 7×7 | 5 | 26 | yellow 20 |
| 009 | 7×7 | 5 | 28 | blue 16 + purple 16 |
| 010 | 7×7 | 5 | 30 | red 15 + yellow 15 + green 15 |

JSON shape identical to 001 (id `kitchen-00N`).

- [ ] **Step 2: Calibrate.** For each level run `npm run simulate -- levels/kitchen/00N.json 500`. Targets: greedy win in [0.60, 0.95]; random win ≥ 0.15. If greedy win > 0.95 reduce moves by 2 or raise a goal count by 2; if < 0.60 do the reverse; re-run until in band (max a few iterations each). Record every final row (greedy + random stats) in `docs/superpowers/calibration/2026-07-01-kitchen-001-010.md` as a table, with the calibration date, run counts, and policy seeds noted.

- [ ] **Step 3: Write smoke test `src/sim/calibration.smoke.test.ts`** (fast lower bound only — full calibration lives in the doc, not CI):

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { simulateLevel } from './simulate';

const ids = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];

describe('kitchen chapter smoke calibration', () => {
  for (const id of ids) {
    it(`kitchen-${id} parses and is winnable by greedy`, () => {
      const level = parseLevel(JSON.parse(readFileSync(`levels/kitchen/${id}.json`, 'utf8')) as unknown);
      const s = simulateLevel(level, 30, greedyPolicy);
      expect(s.winRate).toBeGreaterThanOrEqual(0.4);
    });
  }
});
```

- [ ] **Step 4:** `npm test` fully green (94 tests) and reasonably fast (<60s). If the smoke suite is slow, reduce to 20 runs per level — note it in the test file.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(levels): kitchen 001-010 authored and simulator-calibrated"`

---

### Task 9: Final verification

- [ ] **Step 1:** `npm run typecheck && npm test` — everything green.
- [ ] **Step 2:** `npm run simulate -- levels/kitchen/001.json 200` and `levels/kitchen/010.json 200` — outputs match the calibration doc within noise.
- [ ] **Step 3:** Controller merges to main, verifies CI, updates `CLAUDE.md` (phase → plan 2 executed; next: plan 3 Phaser+PWA) and decision log if new decisions were made.

---

## Self-review checklist

1. **Coverage vs. plan-1 must-dos:** findValidMoves + shuffle (Tasks 1-2) ✓; RNG getState/setState (Task 0) ✓; barrel export (Task 3) ✓; batch runner playLevel (Task 5) ✓. Spec: levels as JSON calibrated by headless simulator (Tasks 6-8) ✓; deterministic core preserved (all randomness still injected) ✓.
2. **Placeholders:** none; every step has complete code or exact commands. DL_SIZE/DL_SEED are discovery-bound constants with an explicit fallback path.
3. **Type consistency:** `Move {a,b}` (Task 1) consumed by policies/run; `Policy` (Task 4) consumed by run/simulate/CLI; `getState/setState` (Task 0) used by greedy (Task 4); `shuffle` event (Task 2) counted in run (Task 5); barrel is the only sim→core import path (Tasks 4-7).
