# Match-3 Logic Core Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete, headless, deterministic match-3 game engine (board, matches, boosters, cascades, goals, forgiving move economy, level loading) as pure TypeScript with full test coverage — no Phaser, no DOM.

**Architecture:** Pure functions over immutable-ish state in `src/core/`. All randomness flows through an injected seeded RNG. `resolveTurn` returns a list of steps (events) that a future renderer replays as animations. Levels are JSON data validated at load.

**Tech Stack:** TypeScript (strict), Vite, Vitest, GitHub Actions CI.

**Follow-up plans:** 2) headless simulator + level calibration · 3) Phaser presentation + PWA shell · 4) meta-layer (apartment, saves, profiles, stats).

**Git workflow note (Cowork):** the working tree lives in the user's mounted folder, but git operations run in the sandbox clone at `/sessions/<session>/omnigame` (see CLAUDE.md "Git workflow"). Each "Commit" step means: rsync mount → sandbox clone, `git add`/`commit` there, push with the token from `.secrets/github-token`. Commit as `Charles DeFarias <cddefari@gmail.com>`.

---

### Task 0: Project scaffold + CI

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.github/workflows/ci.yml`, `src/core/.gitkeep`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "omnigame",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 4: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
```

- [ ] **Step 5: Add smoke test, install, verify**

Create `src/core/smoke.test.ts` (deleted again in Task 1):

```ts
import { expect, it } from 'vitest';
it('toolchain runs', () => { expect(1).toBe(1); });
```

Run: `npm install && npm test`
Expected: 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite/TS/Vitest project with CI"
```

---

### Task 1: Seeded RNG

**Files:**
- Create: `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next() is in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(max) is an integer in [0, max)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('pick returns an element of the array', () => {
    const rng = createRng(9);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(arr).toContain(rng.pick(arr));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/rng.test.ts`
Expected: FAIL — "Cannot find module './rng'"

- [ ] **Step 3: Write minimal implementation (mulberry32)**

```ts
export interface RNG {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);
  const pick = <T,>(items: readonly T[]): T => {
    const item = items[int(items.length)];
    if (item === undefined && items.length === 0) throw new Error('pick from empty array');
    return item as T;
  };
  return { next, int, pick };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/rng.test.ts`
Expected: PASS (5 tests). Delete `src/core/smoke.test.ts` if it exists.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): seeded deterministic RNG (mulberry32)"
```

---

### Task 2: Board types and creation

**Files:**
- Create: `src/core/match3/types.ts`, `src/core/match3/board.ts`
- Test: `src/core/match3/board.test.ts`

- [ ] **Step 1: Write `src/core/match3/types.ts`** (types only — no test needed yet; the board test exercises them)

```ts
export type PieceColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export const ALL_COLORS: readonly PieceColor[] = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange',
];

export type SpecialKind = 'rocketH' | 'rocketV' | 'tnt' | 'lightball' | 'propeller';

export type Piece =
  | { kind: 'normal'; color: PieceColor }
  | { kind: 'special'; special: SpecialKind };

export interface Coord { x: number; y: number; }

export interface Board {
  width: number;
  height: number;
  /** Row-major: index = y * width + x. null = empty cell awaiting refill. */
  cells: (Piece | null)[];
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at, createBoard, index, set } from './board';
import { ALL_COLORS } from './types';

describe('board', () => {
  it('creates a board of the right size, fully populated', () => {
    const board = createBoard(7, 7, createRng(1), 5);
    expect(board.width).toBe(7);
    expect(board.height).toBe(7);
    expect(board.cells).toHaveLength(49);
    expect(board.cells.every((c) => c !== null)).toBe(true);
  });

  it('uses only the first N colors', () => {
    const board = createBoard(7, 7, createRng(1), 4);
    const allowed = new Set(ALL_COLORS.slice(0, 4));
    for (const cell of board.cells) {
      if (cell?.kind === 'normal') expect(allowed.has(cell.color)).toBe(true);
    }
  });

  it('never contains a starting match of 3', () => {
    for (let seed = 0; seed < 20; seed++) {
      const b = createBoard(7, 7, createRng(seed), 5);
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const p = at(b, x, y);
          if (p?.kind !== 'normal') continue;
          if (x >= 2) {
            const a1 = at(b, x - 1, y);
            const a2 = at(b, x - 2, y);
            expect(a1?.kind === 'normal' && a1.color === p.color && a2?.kind === 'normal' && a2.color === p.color).toBe(false);
          }
          if (y >= 2) {
            const a1 = at(b, x, y - 1);
            const a2 = at(b, x, y - 2);
            expect(a1?.kind === 'normal' && a1.color === p.color && a2?.kind === 'normal' && a2.color === p.color).toBe(false);
          }
        }
      }
    }
  });

  it('is deterministic per seed', () => {
    const a = createBoard(7, 7, createRng(5), 5);
    const b = createBoard(7, 7, createRng(5), 5);
    expect(a).toEqual(b);
  });

  it('at/set/index round-trip', () => {
    const board = createBoard(3, 3, createRng(1), 5);
    expect(index(board, 2, 1)).toBe(5);
    set(board, 2, 1, { kind: 'normal', color: 'red' });
    expect(at(board, 2, 1)).toEqual({ kind: 'normal', color: 'red' });
    expect(at(board, -1, 0)).toBeNull();
    expect(at(board, 3, 0)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/core/match3/board.test.ts`
Expected: FAIL — "Cannot find module './board'"

- [ ] **Step 4: Write `src/core/match3/board.ts`**

```ts
import type { RNG } from '../rng';
import { ALL_COLORS, type Board, type Piece, type PieceColor } from './types';

export function index(board: Board, x: number, y: number): number {
  return y * board.width + x;
}

export function inBounds(board: Board, x: number, y: number): boolean {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function at(board: Board, x: number, y: number): Piece | null {
  if (!inBounds(board, x, y)) return null;
  return board.cells[index(board, x, y)] ?? null;
}

export function set(board: Board, x: number, y: number, piece: Piece | null): void {
  if (!inBounds(board, x, y)) throw new Error(`set out of bounds: ${x},${y}`);
  board.cells[index(board, x, y)] = piece;
}

export function cloneBoard(board: Board): Board {
  return { width: board.width, height: board.height, cells: board.cells.slice() };
}

/** Fill so no 3-in-a-row exists at creation: exclude the color of (x-1,x-2) and (y-1,y-2) runs. */
export function createBoard(width: number, height: number, rng: RNG, colorCount: number): Board {
  const palette = ALL_COLORS.slice(0, colorCount);
  const board: Board = { width, height, cells: new Array(width * height).fill(null) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const banned = new Set<PieceColor>();
      const l1 = at(board, x - 1, y);
      const l2 = at(board, x - 2, y);
      if (l1?.kind === 'normal' && l2?.kind === 'normal' && l1.color === l2.color) banned.add(l1.color);
      const u1 = at(board, x, y - 1);
      const u2 = at(board, x, y - 2);
      if (u1?.kind === 'normal' && u2?.kind === 'normal' && u1.color === u2.color) banned.add(u1.color);
      const options = palette.filter((c) => !banned.has(c));
      set(board, x, y, { kind: 'normal', color: rng.pick(options) });
    }
  }
  return board;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/match3/board.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): board types, creation without starting matches"
```

---

### Task 3: Run detection (3+ in a row/column)

**Files:**
- Create: `src/core/match3/matches.ts`
- Test: `src/core/match3/matches.test.ts`

Test helper used by this and later tasks — put it at the top of `matches.test.ts` (and copy into later test files where used; it is 8 lines, duplication is fine at this stage):

```ts
import type { Board, Piece, PieceColor } from './types';

/** Build a board from ASCII rows, e.g. ['rrb', 'bgg']. r/b/g/y/p/o = colors, '.' = empty. */
export function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange' };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) cells.push(ch === '.' ? null : { kind: 'normal', color: map[ch]! });
  }
  return { width, height, cells };
}
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { findRuns } from './matches';
// boardFrom helper as above

describe('findRuns', () => {
  it('finds a horizontal run of 3', () => {
    const b = boardFrom(['rrrb', 'bgyb', 'ygbr']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ color: 'red', dir: 'h' });
    expect(runs[0]!.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('finds a vertical run of 4', () => {
    const b = boardFrom(['rb', 'rg', 'ry', 'rb', 'gy']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ color: 'red', dir: 'v' });
    expect(runs[0]!.cells).toHaveLength(4);
  });

  it('finds nothing on a clean board', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(findRuns(b)).toHaveLength(0);
  });

  it('finds multiple runs including overlapping L-shape', () => {
    const b = boardFrom(['rgg', 'rby', 'rrr']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(2);
    const dirs = runs.map((r) => r.dir).sort();
    expect(dirs).toEqual(['h', 'v']);
  });

  it('ignores empty cells', () => {
    const b = boardFrom(['r.r', 'rbr', 'rgr']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.dir === 'v')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/matches.test.ts`
Expected: FAIL — "Cannot find module './matches'"

- [ ] **Step 3: Write `src/core/match3/matches.ts`**

```ts
import { at } from './board';
import type { Board, Coord, PieceColor } from './types';

export interface Run {
  color: PieceColor;
  dir: 'h' | 'v';
  cells: Coord[];
}

export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < board.height; y++) {
    let x = 0;
    while (x < board.width) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') { x++; continue; }
      let end = x + 1;
      while (end < board.width) {
        const q = at(board, end, y);
        if (q?.kind === 'normal' && q.color === p.color) end++;
        else break;
      }
      if (end - x >= 3) {
        const cells: Coord[] = [];
        for (let i = x; i < end; i++) cells.push({ x: i, y });
        runs.push({ color: p.color, dir: 'h', cells });
      }
      x = end;
    }
  }
  for (let x = 0; x < board.width; x++) {
    let y = 0;
    while (y < board.height) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') { y++; continue; }
      let end = y + 1;
      while (end < board.height) {
        const q = at(board, x, end);
        if (q?.kind === 'normal' && q.color === p.color) end++;
        else break;
      }
      if (end - y >= 3) {
        const cells: Coord[] = [];
        for (let i = y; i < end; i++) cells.push({ x, y: i });
        runs.push({ color: p.color, dir: 'v', cells });
      }
      y = end;
    }
  }
  return runs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/matches.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): horizontal/vertical run detection"
```

---

### Task 4: Match groups and special-piece classification

Royal Match-style rules, fixed for this project:
- run of 5+ → **lightball**
- h-run + v-run sharing a cell (L/T) → **tnt**
- run of exactly 4 → **rocketH** if the run is horizontal, **rocketV** if vertical
- 2×2 square (cells not already in any run) → **propeller**
- run of 3 → no special

The special spawns at `origin`: the swapped cell if it is part of the group, otherwise the group's first cell.

**Files:**
- Modify: `src/core/match3/matches.ts` (append)
- Test: `src/core/match3/groups.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { findMatchGroups } from './matches';
// boardFrom helper as in Task 3

describe('findMatchGroups', () => {
  it('classifies a 3-run as plain (no special)', () => {
    const g = findMatchGroups(boardFrom(['rrrb', 'bgyb', 'ygbr']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBeNull();
    expect(g[0]!.cells).toHaveLength(3);
  });

  it('classifies a 4-run as rocket with matching orientation', () => {
    const h = findMatchGroups(boardFrom(['rrrr', 'bgyb', 'ygbr', 'goyg']), null);
    expect(h[0]!.special).toBe('rocketH');
    const v = findMatchGroups(boardFrom(['rb', 'rg', 'ry', 'rb']), null);
    expect(v[0]!.special).toBe('rocketV');
  });

  it('classifies a 5-run as lightball even when crossed', () => {
    const g = findMatchGroups(boardFrom(['rrrrr', 'bgyby', 'ygbrg']), null);
    expect(g[0]!.special).toBe('lightball');
  });

  it('classifies an L-shape as tnt and merges the two runs into one group', () => {
    const g = findMatchGroups(boardFrom(['rgg', 'rby', 'rrr']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBe('tnt');
    expect(g[0]!.cells).toHaveLength(5);
  });

  it('classifies a standalone 2x2 as propeller', () => {
    const g = findMatchGroups(boardFrom(['rrb', 'rrg', 'byg']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBe('propeller');
    expect(g[0]!.cells).toHaveLength(4);
  });

  it('spawns the special at the swapped cell when it is in the group', () => {
    const g = findMatchGroups(boardFrom(['rrrr', 'bgyb', 'ygbr', 'goyg']), { x: 2, y: 0 });
    expect(g[0]!.origin).toEqual({ x: 2, y: 0 });
  });

  it('merges a 2x2 that overlaps a run into the group without upgrading', () => {
    const g = findMatchGroups(boardFrom(['rrr', 'rrg', 'byg']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBeNull();
    expect(g[0]!.cells).toHaveLength(5);
  });

  it('transitively merges bridged groups: I-shape becomes one tnt group', () => {
    const g = findMatchGroups(boardFrom(['rrr', 'brb', 'rrr']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBe('tnt');
    expect(g[0]!.cells).toHaveLength(7);
  });

  it('merges a solid 3x2 block into one plain group with no duplicate cells', () => {
    const g = findMatchGroups(boardFrom(['rrr', 'rrr', 'byg']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBeNull();
    expect(g[0]!.cells).toHaveLength(6);
  });
});
```

Rule (fixed for this project): a 2×2 square overlapping a run merges its cells into that run's group without changing the group's classification. Only standalone 2×2 squares make propellers.

**Amendment (2026-07-01, from Task 4 code review):** group merging must be transitive. The original merge attached each run/square to the *first* overlapping group only, so a bridging run could leave the same cell in two groups (double-clear + phantom special in Task 8). The fixpoint merge loop above and the two extra tests (I-shape, 3x2 block) close this. No group may share a cell with another group in the returned array.


- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/groups.test.ts`
Expected: FAIL — "findMatchGroups is not a function"

- [ ] **Step 3: Append to `src/core/match3/matches.ts`**

```ts
import type { SpecialKind } from './types';

export interface MatchGroup {
  color: PieceColor;
  cells: Coord[];
  special: SpecialKind | null;
  origin: Coord;
}

const key = (c: Coord): string => `${c.x},${c.y}`;

export function findMatchGroups(board: Board, swapped: Coord | null): MatchGroup[] {
  const runs = findRuns(board);
  const groups: { color: PieceColor; runs: Run[]; cellSet: Map<string, Coord> }[] = [];
  for (const run of runs) {
    const target = groups.find(
      (g) => g.color === run.color && run.cells.some((c) => g.cellSet.has(key(c))),
    );
    if (target) {
      target.runs.push(run);
      for (const c of run.cells) target.cellSet.set(key(c), c);
    } else {
      groups.push({ color: run.color, runs: [run], cellSet: new Map(run.cells.map((c) => [key(c), c])) });
    }
  }

  const inAnyRun = new Set<string>();
  for (const g of groups) for (const k of g.cellSet.keys()) inAnyRun.add(k);

  const squares: { color: PieceColor; cells: Coord[] }[] = [];
  for (let y = 0; y < board.height - 1; y++) {
    for (let x = 0; x < board.width - 1; x++) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') continue;
      const others = [at(board, x + 1, y), at(board, x, y + 1), at(board, x + 1, y + 1)];
      if (others.every((q) => q?.kind === 'normal' && q.color === p.color)) {
        squares.push({
          color: p.color,
          cells: [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }],
        });
      }
    }
  }

  for (const sq of squares) {
    const overlapping = groups.find(
      (g) => g.color === sq.color && sq.cells.some((c) => g.cellSet.has(key(c))),
    );
    if (overlapping) {
      for (const c of sq.cells) overlapping.cellSet.set(key(c), c);
    } else {
      const cellSet = new Map(sq.cells.map((c) => [key(c), c]));
      groups.push({ color: sq.color, runs: [], cellSet });
    }
  }

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const gi = groups[i]!;
        const gj = groups[j]!;
        if (gi.color !== gj.color) continue;
        let overlap = false;
        for (const k of gj.cellSet.keys()) {
          if (gi.cellSet.has(k)) { overlap = true; break; }
        }
        if (overlap) {
          gi.runs.push(...gj.runs);
          for (const [k, c] of gj.cellSet) gi.cellSet.set(k, c);
          groups.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return groups.map((g) => {
    const cells = [...g.cellSet.values()];
    const maxRunLen = Math.max(0, ...g.runs.map((r) => r.cells.length));
    const hasH = g.runs.some((r) => r.dir === 'h');
    const hasV = g.runs.some((r) => r.dir === 'v');
    let special: SpecialKind | null = null;
    if (maxRunLen >= 5) special = 'lightball';
    else if (hasH && hasV) special = 'tnt';
    else if (maxRunLen === 4) special = hasH ? 'rocketH' : 'rocketV';
    else if (g.runs.length === 0) special = 'propeller';
    const origin = swapped && g.cellSet.has(key(swapped)) ? swapped : cells[0]!;
    return { color: g.color, cells, special, origin };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/groups.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, no regressions

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): match grouping and special-piece classification"
```

---

### Task 5: Swap validation

**Files:**
- Create: `src/core/match3/swap.ts`
- Test: `src/core/match3/swap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { canSwap, isAdjacent } from './swap';
import { set } from './board';
// boardFrom helper as in Task 3

describe('swap', () => {
  it('isAdjacent: orthogonal neighbors only', () => {
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 0 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('rejects non-adjacent swaps', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({ valid: false, reason: 'not-adjacent' });
  });

  it('rejects swaps that produce no match', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ valid: false, reason: 'no-match' });
  });

  it('accepts a swap that produces a match at a swapped cell', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    expect(canSwap(b, { x: 1, y: 1 }, { x: 1, y: 0 })).toEqual({ valid: true });
  });

  it('accepts any adjacent swap involving a special piece', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 0, 0, { kind: 'special', special: 'rocketH' });
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ valid: true });
  });

  it('rejects swaps involving an empty cell', () => {
    const b = boardFrom(['.bg', 'gry', 'yob']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ valid: false, reason: 'empty-cell' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/swap.test.ts`
Expected: FAIL — "Cannot find module './swap'"

- [ ] **Step 3: Write `src/core/match3/swap.ts`**

```ts
import { at, cloneBoard, set } from './board';
import { findMatchGroups } from './matches';
import type { Board, Coord } from './types';

export interface SwapCheck {
  valid: boolean;
  reason?: 'not-adjacent' | 'no-match' | 'empty-cell';
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function swapPieces(board: Board, a: Coord, b: Coord): void {
  const pa = at(board, a.x, a.y);
  const pb = at(board, b.x, b.y);
  set(board, a.x, a.y, pb);
  set(board, b.x, b.y, pa);
}

export function canSwap(board: Board, a: Coord, b: Coord): SwapCheck {
  if (!isAdjacent(a, b)) return { valid: false, reason: 'not-adjacent' };
  const pa = at(board, a.x, a.y);
  const pb = at(board, b.x, b.y);
  if (pa === null || pb === null) return { valid: false, reason: 'empty-cell' };
  if (pa.kind === 'special' || pb.kind === 'special') return { valid: true };
  const test = cloneBoard(board);
  swapPieces(test, a, b);
  const groups = findMatchGroups(test, null);
  const hit = groups.some((g) =>
    g.cells.some((c) => (c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y)),
  );
  return hit ? { valid: true } : { valid: false, reason: 'no-match' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/swap.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): swap adjacency and validity checks"
```

---

### Task 6: Gravity and refill

Convention: row 0 is the TOP of the board. Gravity moves pieces to higher y. Refill spawns new pieces into remaining nulls.

**Files:**
- Create: `src/core/match3/gravity.ts`
- Test: `src/core/match3/gravity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at } from './board';
import { applyGravity, refill } from './gravity';
// boardFrom helper as in Task 3

describe('gravity', () => {
  it('drops pieces into empty cells below', () => {
    const b = boardFrom(['r', '.', 'b', '.']);
    const moves = applyGravity(b);
    expect(at(b, 0, 3)).toEqual({ kind: 'normal', color: 'blue' });
    expect(at(b, 0, 2)).toEqual({ kind: 'normal', color: 'red' });
    expect(at(b, 0, 0)).toBeNull();
    expect(at(b, 0, 1)).toBeNull();
    expect(moves).toEqual([
      { from: { x: 0, y: 2 }, to: { x: 0, y: 3 } },
      { from: { x: 0, y: 0 }, to: { x: 0, y: 2 } },
    ]);
  });

  it('does nothing on a full column', () => {
    const b = boardFrom(['r', 'b', 'g']);
    expect(applyGravity(b)).toEqual([]);
  });

  it('refill fills all nulls with normal pieces from the palette', () => {
    const b = boardFrom(['..', 'rb']);
    const fills = refill(b, createRng(3), 5);
    expect(fills).toHaveLength(2);
    expect(b.cells.every((c) => c !== null)).toBe(true);
    for (const f of fills) expect(f.piece.kind).toBe('normal');
  });

  it('refill is deterministic per seed', () => {
    const b1 = boardFrom(['..', 'rb']);
    const b2 = boardFrom(['..', 'rb']);
    refill(b1, createRng(9), 5);
    refill(b2, createRng(9), 5);
    expect(b1).toEqual(b2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/gravity.test.ts`
Expected: FAIL — "Cannot find module './gravity'"

- [ ] **Step 3: Write `src/core/match3/gravity.ts`**

```ts
import type { RNG } from '../rng';
import { at, set } from './board';
import { ALL_COLORS, type Board, type Coord, type Piece } from './types';

export interface FallMove { from: Coord; to: Coord; }

export function applyGravity(board: Board): FallMove[] {
  const moves: FallMove[] = [];
  for (let x = 0; x < board.width; x++) {
    let writeY = board.height - 1;
    for (let y = board.height - 1; y >= 0; y--) {
      const p = at(board, x, y);
      if (p === null) continue;
      if (y !== writeY) {
        set(board, x, writeY, p);
        set(board, x, y, null);
        moves.push({ from: { x, y }, to: { x, y: writeY } });
      }
      writeY--;
    }
  }
  return moves;
}

export function refill(board: Board, rng: RNG, colorCount: number): { coord: Coord; piece: Piece }[] {
  const palette = ALL_COLORS.slice(0, colorCount);
  const fills: { coord: Coord; piece: Piece }[] = [];
  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      if (at(board, x, y) === null) {
        const piece: Piece = { kind: 'normal', color: rng.pick(palette) };
        set(board, x, y, piece);
        fills.push({ coord: { x, y }, piece });
      }
    }
  }
  return fills;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/gravity.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): gravity and deterministic refill"
```

---

### Task 7: Booster targets and combos

Fixed effect rules for this project:
- **rocketH** at (x,y): clears row y. **rocketV**: clears column x.
- **tnt**: clears the 3×3 area centered on it.
- **lightball** activated alone: clears all normal pieces of the board's most common color (ties broken by `ALL_COLORS` order). Swapped with a normal piece: clears all of that piece's color (handled in Task 8's resolve).
- **propeller**: clears its 4 orthogonal neighbors plus one rng-chosen normal cell anywhere.
- Combos (swapping two specials): rocket+rocket = row and column through the first coord; tnt+tnt = 5×5; rocket+tnt = 3 rows and 3 columns centered; lightball+lightball = whole board; lightball+other = most-common-color cells plus the other booster's targets; propeller+other = propeller targets plus the other booster's targets.

**Files:**
- Create: `src/core/match3/boosters.ts`
- Test: `src/core/match3/boosters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { boosterTargets, comboTargets, mostCommonColor } from './boosters';
// boardFrom helper as in Task 3

const K = (cs: { x: number; y: number }[]) => cs.map((c) => `${c.x},${c.y}`).sort();

describe('boosterTargets', () => {
  it('rocketH clears its row; rocketV its column', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(K(boosterTargets(b, { x: 1, y: 1 }, 'rocketH', createRng(1)))).toEqual(K([
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    ]));
    expect(K(boosterTargets(b, { x: 1, y: 1 }, 'rocketV', createRng(1)))).toEqual(K([
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
    ]));
  });

  it('tnt clears 3x3 clipped to the board', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(boosterTargets(b, { x: 0, y: 0 }, 'tnt', createRng(1))).toHaveLength(4);
    expect(boosterTargets(b, { x: 1, y: 1 }, 'tnt', createRng(1))).toHaveLength(9);
  });

  it('lightball alone targets every cell of the most common color', () => {
    const b = boardFrom(['rrg', 'gry', 'yrb']);
    expect(mostCommonColor(b)).toBe('red');
    const t = boosterTargets(b, { x: 2, y: 2 }, 'lightball', createRng(1));
    expect(K(t)).toEqual(K([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]));
  });

  it('propeller targets its orthogonal neighbors plus one extra cell', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const t = boosterTargets(b, { x: 1, y: 1 }, 'propeller', createRng(1));
    expect(t.length).toBe(5);
    expect(K(t.slice(0, 4))).toEqual(K([{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 2 }]));
  });
});

describe('comboTargets', () => {
  it('rocket+rocket clears row and column', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const t = comboTargets(b, { coord: { x: 1, y: 1 }, special: 'rocketH' }, { coord: { x: 2, y: 1 }, special: 'rocketV' }, createRng(1));
    expect(t.length).toBe(5);
  });

  it('lightball+lightball clears the whole board', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const t = comboTargets(b, { coord: { x: 0, y: 0 }, special: 'lightball' }, { coord: { x: 1, y: 0 }, special: 'lightball' }, createRng(1));
    expect(t).toHaveLength(9);
  });

  it('tnt+tnt clears a 5x5 area clipped to the board', () => {
    const b = boardFrom(['rbgyo', 'gryob', 'yobrg', 'bgyor', 'oyrbg']);
    const t = comboTargets(b, { coord: { x: 2, y: 2 }, special: 'tnt' }, { coord: { x: 3, y: 2 }, special: 'tnt' }, createRng(1));
    expect(t).toHaveLength(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/boosters.test.ts`
Expected: FAIL — "Cannot find module './boosters'"

- [ ] **Step 3: Write `src/core/match3/boosters.ts`**

```ts
import type { RNG } from '../rng';
import { at, inBounds } from './board';
import { ALL_COLORS, type Board, type Coord, type PieceColor, type SpecialKind } from './types';

export function mostCommonColor(board: Board): PieceColor {
  const counts = new Map<PieceColor, number>();
  for (const cell of board.cells) {
    if (cell?.kind === 'normal') counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1);
  }
  let best: PieceColor = ALL_COLORS[0]!;
  let bestCount = -1;
  for (const color of ALL_COLORS) {
    const n = counts.get(color) ?? 0;
    if (n > bestCount) { best = color; bestCount = n; }
  }
  return best;
}

export function cellsOfColor(board: Board, color: PieceColor): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const p = at(board, x, y);
      if (p?.kind === 'normal' && p.color === color) out.push({ x, y });
    }
  }
  return out;
}

function row(board: Board, y: number): Coord[] {
  return Array.from({ length: board.width }, (_, x) => ({ x, y }));
}

function column(board: Board, x: number): Coord[] {
  return Array.from({ length: board.height }, (_, y) => ({ x, y }));
}

function area(board: Board, center: Coord, radius: number): Coord[] {
  const out: Coord[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (inBounds(board, x, y)) out.push({ x, y });
    }
  }
  return out;
}

export function boosterTargets(board: Board, coord: Coord, special: SpecialKind, rng: RNG): Coord[] {
  switch (special) {
    case 'rocketH': return row(board, coord.y);
    case 'rocketV': return column(board, coord.x);
    case 'tnt': return area(board, coord, 1);
    case 'lightball': return cellsOfColor(board, mostCommonColor(board));
    case 'propeller': {
      const neighbors = [
        { x: coord.x - 1, y: coord.y }, { x: coord.x + 1, y: coord.y },
        { x: coord.x, y: coord.y - 1 }, { x: coord.x, y: coord.y + 1 },
      ].filter((c) => inBounds(board, c.x, c.y));
      const candidates: Coord[] = [];
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (at(board, x, y)?.kind === 'normal') candidates.push({ x, y });
        }
      }
      const extra = candidates.length > 0 ? [rng.pick(candidates)] : [];
      return [...neighbors, ...extra];
    }
  }
}

const dedupe = (cells: Coord[]): Coord[] => {
  const seen = new Set<string>();
  const out: Coord[] = [];
  for (const c of cells) {
    const k = `${c.x},${c.y}`;
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  }
  return out;
};

export interface PlacedSpecial { coord: Coord; special: SpecialKind; }

export function comboTargets(board: Board, a: PlacedSpecial, b: PlacedSpecial, rng: RNG): Coord[] {
  const pair = [a.special, b.special].sort().join('+');
  const isRocket = (s: SpecialKind) => s === 'rocketH' || s === 'rocketV';

  if (a.special === 'lightball' && b.special === 'lightball') {
    const all: Coord[] = [];
    for (let y = 0; y < board.height; y++) for (let x = 0; x < board.width; x++) all.push({ x, y });
    return all;
  }
  if (a.special === 'lightball' || b.special === 'lightball') {
    const other = a.special === 'lightball' ? b : a;
    return dedupe([
      ...cellsOfColor(board, mostCommonColor(board)),
      ...boosterTargets(board, other.coord, other.special, rng),
    ]);
  }
  if (isRocket(a.special) && isRocket(b.special)) {
    return dedupe([...row(board, a.coord.y), ...column(board, a.coord.x)]);
  }
  if (pair === 'tnt+tnt') return area(board, a.coord, 2);
  if ((isRocket(a.special) && b.special === 'tnt') || (a.special === 'tnt' && isRocket(b.special))) {
    const c = a.coord;
    return dedupe([
      ...row(board, Math.max(0, c.y - 1)), ...row(board, c.y), ...row(board, Math.min(board.height - 1, c.y + 1)),
      ...column(board, Math.max(0, c.x - 1)), ...column(board, c.x), ...column(board, Math.min(board.width - 1, c.x + 1)),
    ]);
  }
  return dedupe([
    ...boosterTargets(board, a.coord, a.special, rng),
    ...boosterTargets(board, b.coord, b.special, rng),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/boosters.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): booster target rules and special combos"
```

---

### Task 8: Turn resolution (swap → clear → chain → cascade)

The heart of the engine. `resolveTurn` executes a full move and returns an event list a renderer can replay. Chain rule: any special piece inside a cleared set activates, adding its targets (closure until stable). Spawned specials are placed after their wave's clear, so they survive.

**Files:**
- Create: `src/core/match3/resolve.ts`
- Test: `src/core/match3/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at, set } from './board';
import { findMatchGroups } from './matches';
import { resolveTurn } from './resolve';
// boardFrom helper as in Task 3

describe('resolveTurn', () => {
  it('returns invalid for a no-match swap and leaves the board untouched', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const before = b.cells.slice();
    const r = resolveTurn(b, { x: 0, y: 0 }, { x: 1, y: 0 }, createRng(1), 5);
    expect(r.valid).toBe(false);
    expect(b.cells).toEqual(before);
  });

  it('resolves a simple 3-match: events in order, no matches remain', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(1), 5);
    expect(r.valid).toBe(true);
    expect(r.events[0]!.type).toBe('swap');
    const types = r.events.map((e) => e.type);
    expect(types).toContain('clear');
    expect(types).toContain('refill');
    expect(findMatchGroups(r.board, null).length).toBe(0);
    expect(r.clearedByColor.red ?? 0).toBeGreaterThanOrEqual(3);
    expect(r.board.cells.every((c) => c !== null)).toBe(true);
  });

  it('spawns a rocket from a 4-match at the swapped cell', () => {
    const b = boardFrom(['rbrr', 'brgg', 'ygby', 'rgyo']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(2), 5);
    expect(r.valid).toBe(true);
    const spawns = r.events.filter((e) => e.type === 'spawn');
    expect(spawns.length).toBeGreaterThanOrEqual(1);
    const hasRocket = r.board.cells.some((c) => c?.kind === 'special' && c.special === 'rocketH');
    expect(hasRocket).toBe(true);
  });

  it('activates a rocket when swapped with a normal piece', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 0, 1, { kind: 'special', special: 'rocketH' });
    const r = resolveTurn(b, { x: 0, y: 1 }, { x: 0, y: 0 }, createRng(3), 5);
    expect(r.valid).toBe(true);
    const clears = r.events.filter((e) => e.type === 'clear');
    expect(clears.length).toBeGreaterThanOrEqual(1);
  });

  it('chains: a rocket cleared by another rocket activates too', () => {
    const b = boardFrom(['rbgy', 'gryb', 'yobr', 'bgyo']);
    set(b, 1, 0, { kind: 'special', special: 'rocketH' });
    set(b, 3, 1, { kind: 'special', special: 'rocketV' });
    const r = resolveTurn(b, { x: 1, y: 0 }, { x: 1, y: 1 }, createRng(4), 5);
    expect(r.valid).toBe(true);
    const cleared = r.events
      .filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear')
      .flatMap((e) => e.cells);
    expect(cleared.some((c) => c.x === 3 && c.y === 3)).toBe(true);
  });

  it('lightball swapped with a normal clears all of that color', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'lightball' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 0, y: 1 }, createRng(5), 5);
    expect(r.valid).toBe(true);
    expect(r.clearedByColor.green ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic per seed', () => {
    const mk = () => boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const r1 = resolveTurn(mk(), { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(7), 5);
    const r2 = resolveTurn(mk(), { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(7), 5);
    expect(r1.events).toEqual(r2.events);
    expect(r1.board).toEqual(r2.board);
  });

  it('throws on colorCount < 3 instead of cascading forever', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    expect(() => resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(1), 2)).toThrow(/colorCount/);
  });

  it('lightball swapped with a normal fires once: first clear is exactly that color plus itself', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'lightball' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 0, y: 1 }, createRng(5), 5);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toHaveLength(3);
  });

  it('rocket+rocket combo fires once: first clear is exactly the cross', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'rocketH' });
    set(b, 2, 1, { kind: 'special', special: 'rocketV' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 2, y: 1 }, createRng(6), 5);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toHaveLength(5);
  });

  it('spawns the special where the dragged piece landed', () => {
    const b = boardFrom(['rbrr', 'brgg', 'ygby', 'rgyo']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(2), 5);
    const spawns = r.events.filter((e): e is Extract<typeof e, { type: 'spawn' }> => e.type === 'spawn');
    expect(spawns[0]!.coord).toEqual({ x: 1, y: 0 });
  });
});
```


- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/resolve.test.ts`
Expected: FAIL — "Cannot find module './resolve'"

- [ ] **Step 3: Write `src/core/match3/resolve.ts`**

```ts
import type { RNG } from '../rng';
import { at, cloneBoard, set } from './board';
import { boosterTargets, cellsOfColor, comboTargets } from './boosters';
import { applyGravity, refill, type FallMove } from './gravity';
import { findMatchGroups } from './matches';
import { canSwap, swapPieces } from './swap';
import type { Board, Coord, Piece, PieceColor } from './types';

export type ResolveEvent =
  | { type: 'swap'; a: Coord; b: Coord }
  | { type: 'clear'; cells: Coord[] }
  | { type: 'spawn'; coord: Coord; piece: Piece }
  | { type: 'fall'; moves: FallMove[] }
  | { type: 'refill'; fills: { coord: Coord; piece: Piece }[] };

export interface TurnResult {
  valid: boolean;
  board: Board;
  events: ResolveEvent[];
  clearedByColor: Partial<Record<PieceColor, number>>;
}

const key = (c: Coord): string => `${c.x},${c.y}`;

/** Set closure (DFS via pop): specials inside the set activate and extend it; each cell once.
 *  Cells in `noExpand` are cleared but never re-fire — used for swapped specials whose targeted
 *  or combo effect was already computed, preventing double-activation. */
function expandWithSpecials(board: Board, initial: Coord[], rng: RNG, noExpand?: Set<string>): Coord[] {
  const seen = new Map<string, Coord>();
  const queue = [...initial];
  while (queue.length > 0) {
    const c = queue.pop()!;
    const k = key(c);
    if (seen.has(k)) continue;
    seen.set(k, c);
    if (noExpand?.has(k)) continue;
    const p = at(board, c.x, c.y);
    if (p?.kind === 'special') {
      for (const t of boosterTargets(board, c, p.special, rng)) queue.push(t);
    }
  }
  return [...seen.values()];
}

function countColors(board: Board, cells: Coord[], into: Partial<Record<PieceColor, number>>): void {
  for (const c of cells) {
    const p = at(board, c.x, c.y);
    if (p?.kind === 'normal') into[p.color] = (into[p.color] ?? 0) + 1;
  }
}

export function resolveTurn(
  board: Board,
  a: Coord,
  b: Coord,
  rng: RNG,
  colorCount: number,
): TurnResult {
  if (colorCount < 3) throw new Error(`colorCount must be >= 3, got ${colorCount}`);
  const check = canSwap(board, a, b);
  if (!check.valid) return { valid: false, board, events: [], clearedByColor: {} };

  const work = cloneBoard(board);
  const events: ResolveEvent[] = [];
  const clearedByColor: Partial<Record<PieceColor, number>> = {};

  const pa = at(work, a.x, a.y)!;
  const pb = at(work, b.x, b.y)!;
  swapPieces(work, a, b);
  events.push({ type: 'swap', a, b });

  const clearWave = (cells: Coord[], spawns: { coord: Coord; piece: Piece }[], noExpand?: Set<string>): void => {
    const expanded = expandWithSpecials(work, cells, rng, noExpand);
    countColors(work, expanded, clearedByColor);
    for (const c of expanded) set(work, c.x, c.y, null);
    events.push({ type: 'clear', cells: expanded });
    for (const s of spawns) {
      set(work, s.coord.x, s.coord.y, s.piece);
      events.push({ type: 'spawn', coord: s.coord, piece: s.piece });
    }
    const moves = applyGravity(work);
    if (moves.length > 0) events.push({ type: 'fall', moves });
    const fills = refill(work, rng, colorCount);
    if (fills.length > 0) events.push({ type: 'refill', fills });
  };

  // pa is now at b, pb at a.
  if (pa.kind === 'special' && pb.kind === 'special') {
    const targets = comboTargets(
      work,
      { coord: b, special: pa.special },
      { coord: a, special: pb.special },
      rng,
    );
    clearWave([...targets, a, b], [], new Set([key(a), key(b)]));
  } else if (pa.kind === 'special' || pb.kind === 'special') {
    const specialAt = pa.kind === 'special' ? b : a;
    const special = pa.kind === 'special' ? pa.special : (pb as Extract<Piece, { kind: 'special' }>).special;
    const partner = pa.kind === 'special' ? pb : pa;
    const targets =
      special === 'lightball' && partner.kind === 'normal'
        ? cellsOfColor(work, partner.color)
        : boosterTargets(work, specialAt, special, rng);
    clearWave([...targets, specialAt], [], new Set([key(specialAt)]));
  }

  let swappedHint: Coord | null = b;
  const MAX_WAVES = 50;
  let waves = 0;
  for (;;) {
    if (++waves > MAX_WAVES) throw new Error('cascade did not settle within 50 waves');
    const groups = findMatchGroups(work, swappedHint);
    swappedHint = null;
    if (groups.length === 0) break;
    const cells: Coord[] = [];
    const spawns: { coord: Coord; piece: Piece }[] = [];
    for (const g of groups) {
      cells.push(...g.cells);
      if (g.special) spawns.push({ coord: g.origin, piece: { kind: 'special', special: g.special } });
    }
    clearWave(cells, spawns);
  }

  return { valid: true, board: work, events, clearedByColor };
}
```


- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/resolve.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, no regressions

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): full turn resolution with chains and cascades"
```

**Amendment (2026-07-01, from Task 8 code review):** three defects fixed in the code above. (1) Swapped specials double-fired — their targeted/combo effect was computed AND `expandWithSpecials` re-activated them with default semantics (lightball+green also wiped the most common color; rocket+rocket cleared 13 cells instead of the 9-cell cross). Fixed via the `noExpand` set: initiating cells clear but never re-fire. (2) `swappedHint` used `a`, but the dragged piece lands at `b` — specials spawned at the wrong cell. Fixed: hint is `b`. (3) No termination guard — `colorCount < 3` cascaded forever. Fixed: input validation + MAX_WAVES=50 cap. Four regression tests added (exact first-clear sizes and spawn coordinate — beware weak `>=` assertions, they let defect 1 through). Known cosmetic limitation (accepted for MVP): when the STATIONARY piece's cell completes the match, the hint (`b`) misses the group and the special spawns at the group's first cell rather than at `a`; deterministic and inside the run. Possible future fix: fallback chain b → a → cells[0].


---

### Task 9: Goals

**Files:**
- Create: `src/core/match3/goals.ts`
- Test: `src/core/match3/goals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { applyCleared, goalsComplete, initGoals } from './goals';

describe('goals', () => {
  it('initializes with zero collected', () => {
    const s = initGoals([{ type: 'collect', color: 'red', count: 10 }]);
    expect(s).toEqual([{ goal: { type: 'collect', color: 'red', count: 10 }, collected: 0 }]);
  });

  it('accumulates cleared pieces of the right color, capped at count', () => {
    let s = initGoals([{ type: 'collect', color: 'red', count: 5 }]);
    s = applyCleared(s, { red: 3, blue: 4 });
    expect(s[0]!.collected).toBe(3);
    s = applyCleared(s, { red: 4 });
    expect(s[0]!.collected).toBe(5);
  });

  it('is complete only when all goals are met', () => {
    let s = initGoals([
      { type: 'collect', color: 'red', count: 2 },
      { type: 'collect', color: 'blue', count: 2 },
    ]);
    s = applyCleared(s, { red: 2 });
    expect(goalsComplete(s)).toBe(false);
    s = applyCleared(s, { blue: 2 });
    expect(goalsComplete(s)).toBe(true);
  });

  it('does not mutate the input state', () => {
    const s = initGoals([{ type: 'collect', color: 'red', count: 5 }]);
    applyCleared(s, { red: 3 });
    expect(s[0]!.collected).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/goals.test.ts`
Expected: FAIL — "Cannot find module './goals'"

- [ ] **Step 3: Write `src/core/match3/goals.ts`**

```ts
import type { PieceColor } from './types';

export interface CollectGoal {
  type: 'collect';
  color: PieceColor;
  count: number;
}

export type Goal = CollectGoal;

export interface GoalState {
  goal: Goal;
  collected: number;
}

export function initGoals(goals: Goal[]): GoalState[] {
  return goals.map((goal) => ({ goal, collected: 0 }));
}

export function applyCleared(
  states: GoalState[],
  clearedByColor: Partial<Record<PieceColor, number>>,
): GoalState[] {
  return states.map((s) => {
    const gained = clearedByColor[s.goal.color] ?? 0;
    return { goal: s.goal, collected: Math.min(s.goal.count, s.collected + gained) };
  });
}

export function goalsComplete(states: GoalState[]): boolean {
  return states.every((s) => s.collected >= s.goal.count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/goals.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): collect goals with progress tracking"
```

---

### Task 10: Level schema, validation, and first level file

**Files:**
- Create: `src/core/match3/level.ts`, `levels/kitchen/001.json`
- Test: `src/core/match3/level.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLevel } from './level';

const good = {
  id: 'kitchen-001',
  seed: 1001,
  board: { width: 7, height: 7, colorCount: 4 },
  moves: 20,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 15 }],
};

describe('parseLevel', () => {
  it('accepts a valid level', () => {
    expect(parseLevel(good)).toEqual(good);
  });

  it('rejects non-objects and missing fields', () => {
    expect(() => parseLevel(null)).toThrow(/level/i);
    expect(() => parseLevel({ ...good, id: undefined })).toThrow(/id/);
    expect(() => parseLevel({ ...good, goals: [] })).toThrow(/goals/);
  });

  it('rejects out-of-range board and moves', () => {
    expect(() => parseLevel({ ...good, board: { ...good.board, width: 2 } })).toThrow(/width/);
    expect(() => parseLevel({ ...good, board: { ...good.board, colorCount: 7 } })).toThrow(/colorCount/);
    expect(() => parseLevel({ ...good, moves: 0 })).toThrow(/moves/);
  });

  it('rejects bad goal colors', () => {
    expect(() =>
      parseLevel({ ...good, goals: [{ type: 'collect', color: 'pink', count: 3 }] }),
    ).toThrow(/color/);
  });

  it('parses the real kitchen-001 level file', () => {
    const raw = JSON.parse(readFileSync('levels/kitchen/001.json', 'utf8')) as unknown;
    const level = parseLevel(raw);
    expect(level.id).toBe('kitchen-001');
    expect(level.board.width).toBeLessThanOrEqual(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/level.test.ts`
Expected: FAIL — "Cannot find module './level'"

- [ ] **Step 3: Write `src/core/match3/level.ts`**

```ts
import { ALL_COLORS, type PieceColor } from './types';
import type { Goal } from './goals';

export interface LevelDef {
  id: string;
  seed: number;
  board: { width: number; height: number; colorCount: number };
  moves: number;
  giftMoves: number;
  goals: Goal[];
}

class LevelError extends Error {}

function fail(msg: string): never {
  throw new LevelError(msg);
}

export function parseLevel(input: unknown): LevelDef {
  if (typeof input !== 'object' || input === null) fail('level must be an object');
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) fail('id must be a non-empty string');
  if (typeof o.seed !== 'number' || !Number.isInteger(o.seed)) fail('seed must be an integer');
  const b = o.board as Record<string, unknown> | null | undefined;
  if (typeof b !== 'object' || b === null) fail('board must be an object');
  if (typeof b.width !== 'number' || b.width < 3 || b.width > 9) fail('board.width must be 3-9');
  if (typeof b.height !== 'number' || b.height < 3 || b.height > 9) fail('board.height must be 3-9');
  if (typeof b.colorCount !== 'number' || b.colorCount < 3 || b.colorCount > 6) fail('board.colorCount must be 3-6');
  if (typeof o.moves !== 'number' || o.moves < 1) fail('moves must be >= 1');
  if (typeof o.giftMoves !== 'number' || o.giftMoves < 0) fail('giftMoves must be >= 0');
  if (!Array.isArray(o.goals) || o.goals.length === 0) fail('goals must be a non-empty array');
  const goals: Goal[] = o.goals.map((g: unknown) => {
    if (typeof g !== 'object' || g === null) fail('goal must be an object');
    const go = g as Record<string, unknown>;
    if (go.type !== 'collect') fail('goal.type must be "collect"');
    if (!ALL_COLORS.includes(go.color as PieceColor)) fail(`goal.color invalid: ${String(go.color)}`);
    if (typeof go.count !== 'number' || go.count < 1) fail('goal.count must be >= 1');
    return { type: 'collect', color: go.color as PieceColor, count: go.count };
  });
  return {
    id: o.id,
    seed: o.seed,
    board: { width: b.width, height: b.height, colorCount: b.colorCount },
    moves: o.moves,
    giftMoves: o.giftMoves,
    goals,
  };
}
```

- [ ] **Step 4: Write `levels/kitchen/001.json`**

```json
{
  "id": "kitchen-001",
  "seed": 1001,
  "board": { "width": 6, "height": 6, "colorCount": 4 },
  "moves": 20,
  "giftMoves": 5,
  "goals": [{ "type": "collect", "color": "red", "count": 12 }]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/match3/level.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): level schema, validation, first kitchen level"
```

---

### Task 11: Game state machine with forgiving move economy

Rules: an invalid swap consumes no move. A valid move decrements `movesLeft`. Winning is checked before losing. At 0 moves without a win: the first time, the gift auto-grants `giftMoves` extra moves (event reported so the renderer can celebrate the gift); the second time the level is lost. A lost or won game rejects further moves.

**Files:**
- Create: `src/core/match3/game.ts`
- Test: `src/core/match3/game.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { startLevel, applyMove } from './game';
import type { LevelDef } from './level';

const level: LevelDef = {
  id: 'test-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 3,
  giftMoves: 2,
  goals: [{ type: 'collect', color: 'red', count: 200 }],
};

/** Find any valid move by brute force so tests don't depend on a specific layout. */
import { canSwap } from './swap';
function findValidMove(state: ReturnType<typeof startLevel>): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const b = state.board;
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const to = { x: x + d.x, y: y + d.y };
        if (to.x >= b.width || to.y >= b.height) continue;
        if (canSwap(b, { x, y }, to).valid) return { a: { x, y }, b: to };
      }
    }
  }
  throw new Error('no valid move found');
}

describe('game', () => {
  it('starts with the level board and full moves', () => {
    const s = startLevel(level);
    expect(s.movesLeft).toBe(3);
    expect(s.status).toBe('playing');
    expect(s.board.width).toBe(6);
  });

  it('an invalid swap consumes no move', () => {
    const s = startLevel(level);
    const r = applyMove(s, { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(r.invalid).toBe(true);
    expect(r.state.movesLeft).toBe(3);
  });

  it('a valid move decrements movesLeft and reports events', () => {
    const s = startLevel(level);
    const mv = findValidMove(s);
    const r = applyMove(s, mv.a, mv.b);
    expect(r.invalid).toBeUndefined();
    expect(r.state.movesLeft).toBe(2);
    expect(r.events.length).toBeGreaterThan(0);
  });

  it('grants the gift exactly once, then loses', () => {
    let s = startLevel(level);
    let gifted = false;
    for (let guard = 0; guard < 50 && s.status === 'playing'; guard++) {
      const mv = findValidMove(s);
      const r = applyMove(s, mv.a, mv.b);
      s = r.state;
      if (r.gift !== undefined) {
        expect(r.gift).toBe(2);
        expect(s.movesLeft).toBe(2);
        gifted = true;
      }
    }
    expect(gifted).toBe(true);
    expect(s.status).toBe('lost');
  });

  it('wins when goals complete and rejects further moves', () => {
    const easy: LevelDef = { ...level, moves: 30, goals: [{ type: 'collect', color: 'red', count: 1 }] };
    let s = startLevel(easy);
    for (let guard = 0; guard < 50 && s.status === 'playing'; guard++) {
      const mv = findValidMove(s);
      s = applyMove(s, mv.a, mv.b).state;
    }
    expect(s.status).toBe('won');
    const after = applyMove(s, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(after.invalid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/match3/game.test.ts`
Expected: FAIL — "Cannot find module './game'"

- [ ] **Step 3: Write `src/core/match3/game.ts`**

```ts
import { createRng, type RNG } from '../rng';
import { createBoard } from './board';
import { applyCleared, goalsComplete, initGoals, type GoalState } from './goals';
import type { LevelDef } from './level';
import { resolveTurn, type ResolveEvent } from './resolve';
import type { Board, Coord } from './types';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  level: LevelDef;
  board: Board;
  rng: RNG;
  movesLeft: number;
  goals: GoalState[];
  giftUsed: boolean;
  status: GameStatus;
}

export interface MoveOutcome {
  state: GameState;
  events: ResolveEvent[];
  /** Number of moves granted by the one-time forgiveness gift, if it fired. */
  gift?: number;
  invalid?: true;
}

export function startLevel(level: LevelDef): GameState {
  const rng = createRng(level.seed);
  const board = createBoard(level.board.width, level.board.height, rng, level.board.colorCount);
  return {
    level,
    board,
    rng,
    movesLeft: level.moves,
    goals: initGoals(level.goals),
    giftUsed: false,
    status: 'playing',
  };
}

export function applyMove(state: GameState, a: Coord, b: Coord): MoveOutcome {
  if (state.status !== 'playing') return { state, events: [], invalid: true };
  const result = resolveTurn(state.board, a, b, state.rng, state.level.board.colorCount);
  if (!result.valid) return { state, events: [], invalid: true };

  const goals = applyCleared(state.goals, result.clearedByColor);
  let movesLeft = state.movesLeft - 1;
  let giftUsed = state.giftUsed;
  let status: GameStatus = 'playing';
  let gift: number | undefined;

  if (goalsComplete(goals)) {
    status = 'won';
  } else if (movesLeft <= 0) {
    if (!giftUsed && state.level.giftMoves > 0) {
      movesLeft = state.level.giftMoves;
      giftUsed = true;
      gift = state.level.giftMoves;
    } else {
      status = 'lost';
    }
  }

  const next: GameState = {
    level: state.level,
    board: result.board,
    rng: state.rng,
    movesLeft,
    goals,
    giftUsed,
    status,
  };
  return gift === undefined ? { state: next, events: result.events } : { state: next, events: result.events, gift };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/match3/game.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): game state machine with one-time move gift"
```

---

### Task 12: Typecheck script, full verification, push

**Files:**
- Modify: `package.json` (add typecheck script)

- [ ] **Step 1: Add typecheck script to `package.json` scripts block**

```json
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Run the full verification**

Run: `npm run typecheck && npm test`
Expected: zero type errors; all suites pass (~38 tests across 9 files)

- [ ] **Step 3: Commit and push**

```bash
git add -A && git commit -m "chore: add typecheck script" && git push origin main
```

- [ ] **Step 4: Verify CI is green**

Run: `curl -s https://api.github.com/repos/CharlesDeFarias/OmniGame/actions/runs?per_page=1 | python3 -c "import json,sys; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'])"`
Expected: `completed success` (wait ~60s after push and retry if `in_progress`)

- [ ] **Step 5: Update ledger**

Update `CLAUDE.md` "Current state" to: logic core complete (plan 1 done); next = plan 2 (simulator + level calibration). Commit and push:

```bash
git add CLAUDE.md && git commit -m "docs: ledger — logic core complete" && git push origin main
```

---

## Self-review checklist (run after writing, before execution)

1. **Spec coverage (plan-1 scope):** deterministic seeded RNG ✓ (Task 1, injected everywhere); board without starting matches ✓ (Task 2); Royal Match specials: rocket/tnt/lightball/propeller creation ✓ (Task 4) and effects/combos ✓ (Task 7); cascades + chain activation ✓ (Task 8); collect goals ✓ (Task 9); levels as validated JSON ✓ (Task 10); forgiving move economy with one-time +5-style gift ✓ (Task 11, `giftMoves` per level); CI on push ✓ (Task 0). Deferred by design: obstacles/blockers (plan 2+ when levels need them), difficulty modifiers beyond gift (plan 4 profiles), simulator (plan 2), rendering/PWA (plan 3), meta/saves/stats (plan 4).
2. **Placeholder scan:** no TBDs; every step has complete code or an exact command with expected output.
3. **Type consistency:** `findMatchGroups(board, swapped: Coord | null)` used in Tasks 4, 5, 8; `RNG` from `src/core/rng.ts` used in Tasks 2, 6, 7, 8, 11; `Goal`/`GoalState` shared by Tasks 9-11; `LevelDef.giftMoves` consumed by Task 11.
