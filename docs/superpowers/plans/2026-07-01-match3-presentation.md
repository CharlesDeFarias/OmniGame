# Match-3 Presentation + PWA Implementation Plan (Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable, installable match-3 — kitchen levels 001-010 rendered by Phaser, deployed to GitHub Pages as a PWA that Luana can add to her home screen.

**Architecture:** `src/render/` (Phaser scenes + pure, testable helpers: layout math, animation planner), `src/services/` (journal + progress, pure TS with injected storage/clock). The renderer consumes the core ONLY via `src/core/match3/index` and replays `ResolveEvent` streams as tween choreography; after each animated turn it snap-syncs sprites to the authoritative board so drift is impossible. Scenes are verified by build + human playtest (per spec); everything pure gets TDD.

**Art/sound decision (decision #27):** MVP uses PROCEDURAL art — each gem is a distinct shape+color drawn by Phaser Graphics (doubles as color-blind accessibility) — and WebAudio-synthesized blips. No binary assets, no licensing risk, no network fetches; real art packs arrive later through the theme-pack system exactly as the spec intends.

**Plan-2 carry-overs honored here:** render `shuffle` events (load-bearing, 12-17% of runs on 6-color levels); catch escaped `ShuffleError` → regenerate level (never strand the player); surface swap-rejection reason (Task 0) for wiggle feedback; opening shuffle is silent (render resulting board). Usage-journal hooks are first-class (decision #26).

**Tech stack additions:** phaser@3, vite-plugin-pwa (both npm, no natives).

**Git workflow:** sandbox clone `/sessions/<session>/omnigame`, branch `feat/match3-presentation` off main; commit per task as `Charles DeFarias <cddefari@gmail.com>`; controller pushes/merges.

---

### Task 0: Surface swap-rejection reason in MoveOutcome

**Files:** Modify `src/core/match3/game.ts`, `src/core/match3/resolve.ts`; test `src/core/match3/game.test.ts` (append)

- [ ] **Step 1: Append failing test** to game.test.ts describe block:

```ts
  it('reports why an invalid move was rejected', () => {
    const s = startLevel(level);
    const r1 = applyMove(s, { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(r1.invalid).toBe(true);
    expect(r1.reason).toBe('not-adjacent');
    const r2 = applyMove({ ...s, status: 'won' }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(r2.reason).toBe('not-playing');
  });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** In resolve.ts, extend TurnResult with `reason?: 'not-adjacent' | 'no-match' | 'empty-cell'` and return it from the invalid branch (`return { valid: false, board, events: [], clearedByColor: {}, reason: check.reason };`). In game.ts, extend MoveOutcome with `/** Why the move was rejected (for renderer feedback, e.g. wiggle). */ reason?: 'not-adjacent' | 'no-match' | 'empty-cell' | 'not-playing';` — the not-playing branch returns `{ state, events: [], invalid: true, reason: 'not-playing' }`, the invalid-swap branch returns `{ state, events: [], invalid: true, reason: result.reason }`.

- [ ] **Step 4:** `npm test` (95) + `npx tsc --noEmit` clean. **Step 5:** Commit `feat(core): surface swap-rejection reason in MoveOutcome`.

---

### Task 1: Usage journal service (decision #26)

**Files:** Create `src/services/journal.ts`; test `src/services/journal.test.ts`

- [ ] **Step 1: Failing test:**

```ts
import { describe, expect, it } from 'vitest';
import { createJournal, type JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('journal', () => {
  it('appends events with timestamps and reads them back', () => {
    let now = 1000;
    const j = createJournal(memStorage(), () => now);
    j.log('level_start', { id: 'kitchen-001' });
    now = 2000;
    j.log('level_end', { id: 'kitchen-001', won: true });
    const all = j.read();
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual({ t: 1000, type: 'level_start', data: { id: 'kitchen-001' } });
    expect(all[1]!.t).toBe(2000);
  });

  it('persists across instances sharing storage', () => {
    const s = memStorage();
    createJournal(s, () => 1).log('a', {});
    const j2 = createJournal(s, () => 2);
    expect(j2.read()).toHaveLength(1);
  });

  it('caps at maxEntries, dropping oldest', () => {
    const j = createJournal(memStorage(), () => 0, 3);
    for (let i = 0; i < 5; i++) j.log('e', { i });
    const all = j.read();
    expect(all).toHaveLength(3);
    expect(all[0]!.data).toEqual({ i: 2 });
  });

  it('survives corrupted storage by starting fresh', () => {
    const s = memStorage();
    s.setItem('omnigame.journal.v1', '{not json');
    const j = createJournal(s, () => 1);
    j.log('a', {});
    expect(j.read()).toHaveLength(1);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Write `src/services/journal.ts`:**

```ts
export interface JournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface JournalEntry {
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export interface Journal {
  log(type: string, data: Record<string, unknown>): void;
  read(): JournalEntry[];
}

const KEY = 'omnigame.journal.v1';

/** Local-only usage journal (decision #26): append-capped event log, never uploaded. */
export function createJournal(storage: JournalStorage, now: () => number, maxEntries = 5000): Journal {
  const load = (): JournalEntry[] => {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
    } catch {
      return [];
    }
  };
  return {
    log(type, data) {
      const entries = load();
      entries.push({ t: now(), type, data });
      while (entries.length > maxEntries) entries.shift();
      storage.setItem(KEY, JSON.stringify(entries));
    },
    read: load,
  };
}
```

- [ ] **Step 4:** PASS (4 tests); `npm test` (99); tsc clean. **Step 5:** Commit `feat(services): local usage journal`.

---

### Task 2: Progress save service (versioned)

**Files:** Create `src/services/progress.ts`; test `src/services/progress.test.ts`

- [ ] **Step 1: Failing test:**

```ts
import { describe, expect, it } from 'vitest';
import { loadProgress, saveProgress, type ProgressData } from './progress';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('progress', () => {
  it('defaults to level index 0 with empty completion', () => {
    expect(loadProgress(memStorage())).toEqual({ version: 1, levelIndex: 0, completed: {} });
  });

  it('round-trips saves', () => {
    const s = memStorage();
    const p: ProgressData = { version: 1, levelIndex: 3, completed: { 'kitchen-001': true } };
    saveProgress(s, p);
    expect(loadProgress(s)).toEqual(p);
  });

  it('recovers from corrupted or wrong-version data', () => {
    const s = memStorage();
    s.setItem('omnigame.progress.v1', 'garbage');
    expect(loadProgress(s).levelIndex).toBe(0);
    s.setItem('omnigame.progress.v1', JSON.stringify({ version: 99 }));
    expect(loadProgress(s).levelIndex).toBe(0);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Write `src/services/progress.ts`:**

```ts
import type { JournalStorage } from './journal';

export interface ProgressData {
  version: 1;
  levelIndex: number;
  completed: Record<string, true>;
}

const KEY = 'omnigame.progress.v1';

const DEFAULT: ProgressData = { version: 1, levelIndex: 0, completed: {} };

export function loadProgress(storage: JournalStorage): ProgressData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return { ...DEFAULT, completed: {} };
    const p = JSON.parse(raw) as Partial<ProgressData> | null;
    if (p === null || p.version !== 1 || typeof p.levelIndex !== 'number') return { ...DEFAULT, completed: {} };
    return { version: 1, levelIndex: p.levelIndex, completed: p.completed ?? {} };
  } catch {
    return { ...DEFAULT, completed: {} };
  }
}

export function saveProgress(storage: JournalStorage, p: ProgressData): void {
  storage.setItem(KEY, JSON.stringify(p));
}
```

- [ ] **Step 4:** PASS (3); `npm test` (102); tsc clean. **Step 5:** Commit `feat(services): versioned progress save`.

---

### Task 3: Phaser + PWA scaffold, boot scene, build green

**Files:** Create `index.html`, `vite.config.ts`, `src/render/main.ts`, `public/icon-192.png` + `public/icon-512.png` (generated), `scripts/make-icons.ts`, `LICENSES.md`; modify `package.json`

- [ ] **Step 1:** `npm install phaser && npm install -D vite-plugin-pwa`

- [ ] **Step 2: `index.html`** (repo root — Vite convention):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#1a1a2e" />
  <title>OmniGame</title>
  <style>
    html, body { margin: 0; padding: 0; background: #1a1a2e; height: 100%; overflow: hidden; }
    #app { width: 100%; height: 100%; }
    * { touch-action: none; user-select: none; -webkit-user-select: none; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/render/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: `vite.config.ts`:**

```ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/OmniGame/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'OmniGame',
        short_name: 'OmniGame',
        description: 'Ad-free casual games',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 4: Icons.** Write `scripts/make-icons.ts` generating two PNGs into `public/` with pure JS (no canvas dep): draw a simple 3x3 gem-grid motif into a raw RGBA buffer and encode PNG via a tiny zlib-free encoder — simplest reliable route: `npm i -D pngjs`, then:

```ts
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const COLORS: [number, number, number][] = [
  [231, 76, 60], [52, 152, 219], [46, 204, 113],
  [241, 196, 15], [155, 89, 182], [230, 126, 34],
  [231, 76, 60], [52, 152, 219], [46, 204, 113],
];

function makeIcon(size: number, file: string): void {
  const png = new PNG({ width: size, height: size });
  const bg = [26, 26, 46];
  const pad = Math.floor(size * 0.08);
  const cell = Math.floor((size - 2 * pad) / 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      let [r, g, b] = bg;
      const cx = Math.floor((x - pad) / cell);
      const cy = Math.floor((y - pad) / cell);
      if (x >= pad && y >= pad && cx >= 0 && cx < 3 && cy >= 0 && cy < 3) {
        const inX = (x - pad) % cell;
        const inY = (y - pad) % cell;
        const m = Math.floor(cell * 0.12);
        if (inX > m && inX < cell - m && inY > m && inY < cell - m) {
          [r, g, b] = COLORS[cy * 3 + cx]!;
        }
      }
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
  }
  writeFileSync(file, PNG.sync.write(png));
}

makeIcon(192, 'public/icon-192.png');
makeIcon(512, 'public/icon-512.png');
console.log('icons written');
```

Run `npx tsx scripts/make-icons.ts`; commit the generated PNGs (they're tiny and deterministic).

- [ ] **Step 5: `src/render/main.ts`** (boot with placeholder scene for now — replaced in Task 6):

```ts
import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 200, 200, 0x3498db);
  }
}

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene],
});
```

- [ ] **Step 6: `LICENSES.md`:** record: all game art procedural (this repo, no external assets); Phaser (MIT); vite-plugin-pwa (MIT); pngjs (MIT, dev-only); tsx/vite/vitest/typescript (dev-only, MIT/Apache). One line each with links.

- [ ] **Step 7:** `npm run build` succeeds (dist/ with sw.js + manifest); `npm test` still green (102); tsc clean. NOTE: `tsc --noEmit` must typecheck main.ts — if `"types": ["node"]` conflicts with DOM lib, set `"lib": ["ES2022", "DOM"]` in tsconfig compilerOptions (keep types node for tests/scripts).

- [ ] **Step 8:** Commit `feat(render): Phaser + PWA scaffold, generated icons, licenses`.

---

### Task 4: Layout math (pure, TDD)

**Files:** Create `src/render/layout.ts`; test `src/render/layout.test.ts`

- [ ] **Step 1: Failing test:**

```ts
import { describe, expect, it } from 'vitest';
import { boardLayout, cellToXY, xyToCell } from './layout';

describe('layout', () => {
  const l = boardLayout(720, 1280, 6, 6, 220, 160);

  it('fits the board within width and reserved bands', () => {
    expect(l.cell * 6).toBeLessThanOrEqual(720 * 0.94 + 1e-6);
    expect(l.cell * 6).toBeLessThanOrEqual(1280 - 220 - 160 + 1e-6);
    expect(l.originY).toBeGreaterThanOrEqual(220);
  });

  it('centers horizontally', () => {
    expect(l.originX + (l.cell * 6) / 2).toBeCloseTo(360, 5);
  });

  it('cellToXY gives cell centers; xyToCell inverts', () => {
    const { px, py } = cellToXY(l, 0, 0);
    expect(px).toBeCloseTo(l.originX + l.cell / 2, 5);
    expect(py).toBeCloseTo(l.originY + l.cell / 2, 5);
    expect(xyToCell(l, px, py)).toEqual({ x: 0, y: 0 });
    expect(xyToCell(l, l.originX - 5, l.originY)).toBeNull();
    const far = cellToXY(l, 5, 5);
    expect(xyToCell(l, far.px, far.py)).toEqual({ x: 5, y: 5 });
  });

  it('handles 7x7 boards', () => {
    const l7 = boardLayout(720, 1280, 7, 7, 220, 160);
    expect(l7.cell * 7).toBeLessThanOrEqual(720 * 0.94 + 1e-6);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Write `src/render/layout.ts`:**

```ts
export interface Layout {
  originX: number;
  originY: number;
  cell: number;
  cols: number;
  rows: number;
}

/** Board geometry in logical pixels: max 94% of width, vertically centered between reserves. */
export function boardLayout(
  viewW: number,
  viewH: number,
  cols: number,
  rows: number,
  topReserve: number,
  bottomReserve: number,
): Layout {
  const cell = Math.min((viewW * 0.94) / cols, (viewH - topReserve - bottomReserve) / rows);
  const originX = (viewW - cell * cols) / 2;
  const usable = viewH - topReserve - bottomReserve;
  const originY = topReserve + (usable - cell * rows) / 2;
  return { originX, originY, cell, cols, rows };
}

export function cellToXY(l: Layout, x: number, y: number): { px: number; py: number } {
  return { px: l.originX + (x + 0.5) * l.cell, py: l.originY + (y + 0.5) * l.cell };
}

export function xyToCell(l: Layout, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - l.originX) / l.cell);
  const y = Math.floor((py - l.originY) / l.cell);
  if (x < 0 || x >= l.cols || y < 0 || y >= l.rows) return null;
  return { x, y };
}
```

- [ ] **Step 4:** PASS (4); suite 106; tsc clean. **Step 5:** Commit `feat(render): board layout math`.

---

### Task 5: Animation planner (pure, TDD)

**Files:** Create `src/render/choreo.ts`; test `src/render/choreo.test.ts`

- [ ] **Step 1: Failing test:**

```ts
import { describe, expect, it } from 'vitest';
import type { ResolveEvent } from '../core/match3/index';
import { planSteps, DUR } from './choreo';

const events: ResolveEvent[] = [
  { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  { type: 'clear', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
  { type: 'spawn', coord: { x: 1, y: 0 }, piece: { kind: 'special', special: 'rocketH' } },
  { type: 'fall', moves: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 3 } }] },
  { type: 'refill', fills: [{ coord: { x: 0, y: 0 }, piece: { kind: 'normal', color: 'red' } }] },
  { type: 'shuffle' },
];

describe('planSteps', () => {
  it('maps events 1:1 in order with positive durations', () => {
    const steps = planSteps(events);
    expect(steps.map((s) => s.event.type)).toEqual(['swap', 'clear', 'spawn', 'fall', 'refill', 'shuffle']);
    for (const s of steps) expect(s.duration).toBeGreaterThan(0);
  });

  it('scales fall duration with the longest drop', () => {
    const short = planSteps([{ type: 'fall', moves: [{ from: { x: 0, y: 2 }, to: { x: 0, y: 3 } }] }]);
    const long = planSteps([{ type: 'fall', moves: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 5 } }] }]);
    expect(long[0]!.duration).toBeGreaterThan(short[0]!.duration);
  });

  it('total duration for a typical turn stays snappy (< 4s)', () => {
    const total = planSteps(events).reduce((s, x) => s + x.duration, 0);
    expect(total).toBeLessThan(4000);
    expect(DUR.swap).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Write `src/render/choreo.ts`:**

```ts
import type { ResolveEvent } from '../core/match3/index';

export const DUR = {
  swap: 160,
  clear: 220,
  spawn: 160,
  fallPerRow: 70,
  fallMin: 120,
  refill: 220,
  shuffle: 450,
} as const;

export interface Step {
  event: ResolveEvent;
  duration: number;
}

/** Maps the core's event stream 1:1 to timed animation steps. The scene executes them
 *  sequentially, then snap-syncs sprites to the authoritative board. */
export function planSteps(events: ResolveEvent[]): Step[] {
  return events.map((event) => {
    switch (event.type) {
      case 'swap': return { event, duration: DUR.swap };
      case 'clear': return { event, duration: DUR.clear };
      case 'spawn': return { event, duration: DUR.spawn };
      case 'fall': {
        const maxDrop = Math.max(1, ...event.moves.map((m) => m.to.y - m.from.y));
        return { event, duration: Math.max(DUR.fallMin, maxDrop * DUR.fallPerRow) };
      }
      case 'refill': return { event, duration: DUR.refill };
      case 'shuffle': return { event, duration: DUR.shuffle };
    }
  });
}
```

- [ ] **Step 4:** PASS (3); suite 109; tsc clean. **Step 5:** Commit `feat(render): animation step planner`.

---

### Task 6: Theme textures + audio blips (code-reviewed, not unit-tested — canvas/audio need a browser)

**Files:** Create `src/render/config.ts`, `src/render/theme.ts`, `src/render/audio.ts`

- [ ] **Step 1: `src/render/config.ts`** (avoids main.ts circular imports):

```ts
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;
export const TOP_RESERVE = 220;
export const BOTTOM_RESERVE = 160;
```

- [ ] **Step 2: `src/render/theme.ts`.** Distinct shape per color (accessibility: shape ≠ color alone). Exports:

```ts
import type Phaser from 'phaser';
import type { Piece, PieceColor } from '../core/match3/index';

export const COLOR_HEX: Record<PieceColor, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  purple: 0x9b59b6,
  orange: 0xe67e22,
};

export function textureKeyFor(piece: Piece): string {
  return piece.kind === 'normal' ? `gem-${piece.color}` : `sp-${piece.special}`;
}

const poly = (cx: number, cy: number, r: number, n: number, rot: number): { x: number; y: number }[] =>
  Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos(rot + (i * 2 * Math.PI) / n),
    y: cy + r * Math.sin(rot + (i * 2 * Math.PI) / n),
  }));

const star = (cx: number, cy: number, rOut: number, rIn: number, n: number): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
};

/** Generates all gem/special/UI textures once. size = texture edge in px. */
export function makeTextures(scene: Phaser.Scene, size: number): void {
  const s = size;
  const c = s / 2;
  const r = s * 0.38;
  const gem = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    draw(g);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(c - r * 0.35, c - r * 0.4, r * 0.55, r * 0.35);
    g.generateTexture(key, s, s);
    g.destroy();
  };

  gem('gem-red', (g) => { g.fillStyle(COLOR_HEX.red); g.fillCircle(c, c, r); });
  gem('gem-blue', (g) => { g.fillStyle(COLOR_HEX.blue); g.fillPoints(poly(c, c, r * 1.05, 3, -Math.PI / 2), true); });
  gem('gem-green', (g) => { g.fillStyle(COLOR_HEX.green); g.fillRoundedRect(c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7, r * 0.35); });
  gem('gem-yellow', (g) => { g.fillStyle(COLOR_HEX.yellow); g.fillPoints(poly(c, c, r * 1.05, 4, -Math.PI / 2), true); });
  gem('gem-purple', (g) => { g.fillStyle(COLOR_HEX.purple); g.fillPoints(poly(c, c, r, 6, 0), true); });
  gem('gem-orange', (g) => { g.fillStyle(COLOR_HEX.orange); g.fillPoints(star(c, c, r * 1.05, r * 0.5, 5), true); });

  const sp = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    g.fillStyle(0xf5f0ff);
    g.fillCircle(c, c, r * 1.05);
    g.lineStyle(s * 0.03, 0x2c2c54);
    g.strokeCircle(c, c, r * 1.05);
    draw(g);
    g.generateTexture(key, s, s);
    g.destroy();
  };

  sp('sp-rocketH', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillTriangle(c - r, c, c - r * 0.3, c - r * 0.4, c - r * 0.3, c + r * 0.4);
    g.fillTriangle(c + r, c, c + r * 0.3, c - r * 0.4, c + r * 0.3, c + r * 0.4);
    g.fillRect(c - r * 0.35, c - r * 0.12, r * 0.7, r * 0.24);
  });
  sp('sp-rocketV', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillTriangle(c, c - r, c - r * 0.4, c - r * 0.3, c + r * 0.4, c - r * 0.3);
    g.fillTriangle(c, c + r, c - r * 0.4, c + r * 0.3, c + r * 0.4, c + r * 0.3);
    g.fillRect(c - r * 0.12, c - r * 0.35, r * 0.24, r * 0.7);
  });
  sp('sp-tnt', (g) => {
    g.fillStyle(0x2c2c54);
    g.fillCircle(c, c + r * 0.15, r * 0.6);
    g.fillRect(c - r * 0.06, c - r * 0.75, r * 0.12, r * 0.45);
    g.fillStyle(0xe67e22);
    g.fillCircle(c, c - r * 0.8, r * 0.14);
  });
  sp('sp-lightball', (g) => {
    g.fillStyle(0xf1c40f);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillTriangle(
        c + Math.cos(a) * r * 0.95, c + Math.sin(a) * r * 0.95,
        c + Math.cos(a + 0.25) * r * 0.45, c + Math.sin(a + 0.25) * r * 0.45,
        c + Math.cos(a - 0.25) * r * 0.45, c + Math.sin(a - 0.25) * r * 0.45,
      );
    }
    g.fillCircle(c, c, r * 0.42);
  });
  sp('sp-propeller', (g) => {
    g.fillStyle(0x16a085);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      g.fillEllipse(c + Math.cos(a) * r * 0.5, c + Math.sin(a) * r * 0.5, r * 0.75, r * 0.32);
    }
    g.fillStyle(0x2c2c54);
    g.fillCircle(c, c, r * 0.16);
  });

  const ui = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, s, s);
    g.destroy();
  };
  ui('ui-star', (g) => { g.fillStyle(0xf1c40f); g.fillPoints(star(c, c, r * 1.1, r * 0.5, 5), true); });
  ui('ui-play', (g) => {
    g.fillStyle(0x2ecc71);
    g.fillCircle(c, c, r * 1.1);
    g.fillStyle(0xffffff);
    g.fillTriangle(c - r * 0.35, c - r * 0.5, c - r * 0.35, c + r * 0.5, c + r * 0.55, c);
  });
  ui('ui-retry', (g) => {
    g.fillStyle(0x3498db);
    g.fillCircle(c, c, r * 1.1);
    g.lineStyle(s * 0.07, 0xffffff);
    g.beginPath();
    g.arc(c, c, r * 0.55, -Math.PI * 0.25, Math.PI, false);
    g.strokePath();
    g.fillStyle(0xffffff);
    g.fillTriangle(c + r * 0.75, c - r * 0.45, c + r * 0.2, c - r * 0.55, c + r * 0.55, c - r * 0.05);
  });
  ui('ui-pip', (g) => { g.fillStyle(0xffffff); g.fillCircle(c, c, r * 0.3); });
}
```

- [ ] **Step 3: `src/render/audio.ts`** — tiny WebAudio synth, resumed on first gesture:

```ts
export interface Blips {
  unlock(): void;
  match(): void;
  booster(): void;
  gift(): void;
  win(): void;
  lose(): void;
}

export function createBlips(): Blips {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12): void => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur + 0.05);
  };
  return {
    unlock() { if (ctx.state === 'suspended') void ctx.resume(); },
    match() { tone(520, 0, 0.12); tone(660, 0.05, 0.12); },
    booster() { tone(220, 0, 0.2, 'square', 0.1); tone(330, 0.08, 0.18, 'square', 0.08); },
    gift() { tone(440, 0, 0.1); tone(550, 0.09, 0.1); tone(660, 0.18, 0.14); },
    win() { tone(523, 0, 0.15); tone(659, 0.12, 0.15); tone(784, 0.24, 0.25); },
    lose() { tone(392, 0, 0.2); tone(330, 0.15, 0.3); },
  };
}
```

- [ ] **Step 4:** `npx tsc --noEmit` clean; `npm run build` green; `npm test` unchanged (109). Commit `feat(render): procedural gem/special/UI textures and audio blips`.

---

### Task 7: PlayScene — the playable game

**Files:** Create `src/render/levels.ts`, `src/render/PlayScene.ts`; rewrite `src/render/main.ts`; modify `tsconfig.json` (add "vite/client" to types)

- [ ] **Step 1: tsconfig:** `"types": ["node"]` → `"types": ["node", "vite/client"]` (for `import.meta.glob`).

- [ ] **Step 2: `src/render/levels.ts`:**

```ts
import { parseLevel } from '../core/match3/index';
import type { LevelDef } from '../core/match3/index';

const modules = import.meta.glob('../../levels/kitchen/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

/** Kitchen chapter levels, sorted by filename (001..010), validated at load. */
export function loadLevels(): LevelDef[] {
  return Object.keys(modules)
    .sort()
    .map((k) => parseLevel(modules[k]!.default));
}
```

- [ ] **Step 3: `src/render/PlayScene.ts`** — complete file:

```ts
import Phaser from 'phaser';
import { applyMove, startLevel, ShuffleError } from '../core/match3/index';
import type { Coord, GameState, LevelDef, MoveOutcome, PieceColor } from '../core/match3/index';
import { createJournal, type Journal } from '../services/journal';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { createBlips, type Blips } from './audio';
import { planSteps, type Step } from './choreo';
import { BOTTOM_RESERVE, GAME_HEIGHT, GAME_WIDTH, TOP_RESERVE } from './config';
import { boardLayout, cellToXY, xyToCell, type Layout } from './layout';
import { loadLevels } from './levels';
import { COLOR_HEX, makeTextures, textureKeyFor } from './theme';

const key = (c: Coord): string => `${c.x},${c.y}`;

export class PlayScene extends Phaser.Scene {
  private levels: LevelDef[] = [];
  private state!: GameState;
  private layout!: Layout;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private selected: Coord | null = null;
  private marker!: Phaser.GameObjects.Rectangle;
  private busy = false;
  private journal!: Journal;
  private progress!: ProgressData;
  private blips!: Blips;
  private movesText!: Phaser.GameObjects.Text;
  private goalHud: { icon: Phaser.GameObjects.Sprite; txt: Phaser.GameObjects.Text; color: PieceColor }[] = [];
  private retryCount = 0;
  private downAt: { cell: Coord; px: number; py: number } | null = null;

  constructor() {
    super('play');
  }

  create(): void {
    makeTextures(this, 96);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.progress = loadProgress(window.localStorage);
    this.blips = createBlips();
    this.levels = loadLevels();
    this.marker = this.add
      .rectangle(0, 0, 10, 10)
      .setStrokeStyle(5, 0xffffff)
      .setFillStyle(0, 0)
      .setVisible(false)
      .setDepth(5);
    this.movesText = this.add
      .text(GAME_WIDTH / 2, TOP_RESERVE * 0.72, '', { fontSize: '64px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.startCurrentLevel();
  }

  private currentDef(): LevelDef {
    const idx = Math.min(this.progress.levelIndex, this.levels.length - 1);
    const def = this.levels[idx]!;
    return this.retryCount === 0 ? def : { ...def, seed: def.seed + this.retryCount * 101 };
  }

  private startCurrentLevel(): void {
    const def = this.currentDef();
    try {
      this.state = startLevel(def);
    } catch (e) {
      if (e instanceof ShuffleError) {
        this.journal.log('shuffle_error', { level: def.id, phase: 'start' });
        this.state = startLevel({ ...def, seed: def.seed + 9999 });
      } else throw e;
    }
    this.layout = boardLayout(
      GAME_WIDTH, GAME_HEIGHT,
      def.board.width, def.board.height,
      TOP_RESERVE, BOTTOM_RESERVE,
    );
    this.journal.log('level_start', { level: def.id, retry: this.retryCount });
    this.buildGoalHud();
    this.syncBoard();
    this.updateHud();
  }

  private buildGoalHud(): void {
    for (const g of this.goalHud) { g.icon.destroy(); g.txt.destroy(); }
    this.goalHud = [];
    const n = this.state.goals.length;
    const spacing = 150;
    const x0 = GAME_WIDTH / 2 - ((n - 1) * spacing) / 2;
    this.state.goals.forEach((gs, i) => {
      const icon = this.add.sprite(x0 + i * spacing - 34, TOP_RESERVE * 0.32, `gem-${gs.goal.color}`).setDisplaySize(64, 64);
      const txt = this.add
        .text(x0 + i * spacing + 14, TOP_RESERVE * 0.32, '', { fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0, 0.5);
      this.goalHud.push({ icon, txt, color: gs.goal.color });
    });
  }

  private updateHud(): void {
    this.movesText.setText(String(this.state.movesLeft));
    this.state.goals.forEach((gs, i) => {
      const remaining = Math.max(0, gs.goal.count - gs.collected);
      const hud = this.goalHud[i]!;
      hud.txt.setText(remaining === 0 ? '✓' : String(remaining));
      hud.txt.setColor(remaining === 0 ? '#2ecc71' : '#ffffff');
    });
  }

  private syncBoard(): void {
    for (const sp of this.sprites.values()) sp.destroy();
    this.sprites.clear();
    const b = this.state.board;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const piece = b.cells[y * b.width + x];
        if (piece === null || piece === undefined) continue;
        const { px, py } = cellToXY(this.layout, x, y);
        const sp = this.add.sprite(px, py, textureKeyFor(piece)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92);
        this.sprites.set(key({ x, y }), sp);
      }
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.blips.unlock();
    if (this.busy) return;
    const cell = xyToCell(this.layout, p.x, p.y);
    if (cell === null) return;
    this.downAt = { cell, px: p.x, py: p.y };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.busy || this.downAt === null) return;
    const start = this.downAt;
    this.downAt = null;
    const dx = p.x - start.px;
    const dy = p.y - start.py;
    const dragDist = Math.hypot(dx, dy);
    if (dragDist > this.layout.cell * 0.35) {
      const dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      const target = { x: start.cell.x + dir.x, y: start.cell.y + dir.y };
      this.select(null);
      void this.attemptSwap(start.cell, target);
      return;
    }
    if (this.selected === null) {
      this.select(start.cell);
    } else if (this.selected.x === start.cell.x && this.selected.y === start.cell.y) {
      this.select(null);
    } else if (Math.abs(this.selected.x - start.cell.x) + Math.abs(this.selected.y - start.cell.y) === 1) {
      const a = this.selected;
      this.select(null);
      void this.attemptSwap(a, start.cell);
    } else {
      this.select(start.cell);
    }
  }

  private select(cell: Coord | null): void {
    this.selected = cell;
    if (cell === null) {
      this.marker.setVisible(false);
      return;
    }
    const { px, py } = cellToXY(this.layout, cell.x, cell.y);
    this.marker.setPosition(px, py).setSize(this.layout.cell * 0.98, this.layout.cell * 0.98).setVisible(true);
  }

  private async attemptSwap(a: Coord, b: Coord): Promise<void> {
    let out: MoveOutcome;
    try {
      out = applyMove(this.state, a, b);
    } catch (e) {
      if (e instanceof ShuffleError) {
        this.journal.log('shuffle_error', { level: this.state.level.id, phase: 'move' });
        this.retryCount += 1;
        this.startCurrentLevel();
        return;
      }
      throw e;
    }
    if (out.invalid === true) {
      this.journal.log('invalid_move', { level: this.state.level.id, reason: out.reason ?? 'unknown' });
      if (out.reason === 'no-match') await Promise.all([this.wiggle(a), this.wiggle(b)]);
      return;
    }
    await this.runTurn(out);
  }

  private wiggle(c: Coord): Promise<void> {
    const sp = this.sprites.get(key(c));
    if (sp === undefined) return Promise.resolve();
    return new Promise((resolve) => {
      this.tweens.add({ targets: sp, x: sp.x + 9, duration: 45, yoyo: true, repeat: 3, onComplete: () => resolve() });
    });
  }

  private tweenAsync(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }

  private async runTurn(out: MoveOutcome): Promise<void> {
    this.busy = true;
    this.state = out.state;
    this.journal.log('move', { level: this.state.level.id, movesLeft: this.state.movesLeft });
    for (const step of planSteps(out.events)) await this.animateStep(step);
    this.syncBoard();
    this.updateHud();
    if (out.gift !== undefined) {
      this.journal.log('gift', { level: this.state.level.id, moves: out.gift });
      await this.celebrateGift(out.gift);
    }
    if (this.state.status === 'won') await this.onWin();
    else if (this.state.status === 'lost') await this.onLose();
    this.busy = false;
  }

  private async animateStep(step: Step): Promise<void> {
    const ev = step.event;
    switch (ev.type) {
      case 'swap': {
        const sa = this.sprites.get(key(ev.a));
        const sb = this.sprites.get(key(ev.b));
        const pa = cellToXY(this.layout, ev.a.x, ev.a.y);
        const pb = cellToXY(this.layout, ev.b.x, ev.b.y);
        const jobs: Promise<void>[] = [];
        if (sa) jobs.push(this.tweenAsync({ targets: sa, x: pb.px, y: pb.py, duration: step.duration }));
        if (sb) jobs.push(this.tweenAsync({ targets: sb, x: pa.px, y: pa.py, duration: step.duration }));
        await Promise.all(jobs);
        if (sa && sb) {
          this.sprites.set(key(ev.a), sb);
          this.sprites.set(key(ev.b), sa);
        }
        break;
      }
      case 'clear': {
        const targets = ev.cells.map((c) => this.sprites.get(key(c))).filter((s): s is Phaser.GameObjects.Sprite => s !== undefined);
        if (ev.cells.length >= 6) this.blips.booster();
        else this.blips.match();
        if (targets.length > 0) {
          await this.tweenAsync({ targets, scale: 0, alpha: 0, duration: step.duration, ease: 'Back.easeIn' });
        }
        for (const c of ev.cells) {
          const sp = this.sprites.get(key(c));
          if (sp) { sp.destroy(); this.sprites.delete(key(c)); }
        }
        if (navigator.vibrate) navigator.vibrate(20);
        break;
      }
      case 'spawn': {
        const { px, py } = cellToXY(this.layout, ev.coord.x, ev.coord.y);
        const sp = this.add.sprite(px, py, textureKeyFor(ev.piece)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92).setScale(0);
        this.sprites.set(key(ev.coord), sp);
        await this.tweenAsync({ targets: sp, scale: (this.layout.cell * 0.92) / 96, duration: step.duration, ease: 'Back.easeOut' });
        break;
      }
      case 'fall': {
        const moving: { sp: Phaser.GameObjects.Sprite; to: Coord }[] = [];
        for (const m of ev.moves) {
          const sp = this.sprites.get(key(m.from));
          if (sp) { moving.push({ sp, to: m.to }); this.sprites.delete(key(m.from)); }
        }
        const jobs = moving.map(({ sp, to }) => {
          const { px, py } = cellToXY(this.layout, to.x, to.y);
          return this.tweenAsync({ targets: sp, x: px, y: py, duration: step.duration, ease: 'Quad.easeIn' });
        });
        for (const { sp, to } of moving) this.sprites.set(key(to), sp);
        await Promise.all(jobs);
        break;
      }
      case 'refill': {
        const jobs: Promise<void>[] = [];
        for (const f of ev.fills) {
          const { px, py } = cellToXY(this.layout, f.coord.x, f.coord.y);
          const sp = this.add
            .sprite(px, this.layout.originY - this.layout.cell, textureKeyFor(f.piece))
            .setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92);
          this.sprites.set(key(f.coord), sp);
          jobs.push(this.tweenAsync({ targets: sp, y: py, duration: step.duration, ease: 'Quad.easeOut' }));
        }
        await Promise.all(jobs);
        break;
      }
      case 'shuffle': {
        this.journal.log('shuffle', { level: this.state.level.id });
        const all = [...this.sprites.values()];
        await this.tweenAsync({ targets: all, alpha: 0, duration: step.duration / 2 });
        this.syncBoard();
        for (const sp of this.sprites.values()) sp.setAlpha(0);
        await this.tweenAsync({ targets: [...this.sprites.values()], alpha: 1, duration: step.duration / 2 });
        break;
      }
    }
  }

  private async celebrateGift(moves: number): Promise<void> {
    this.blips.gift();
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < moves; i++) {
      const pip = this.add.sprite(GAME_WIDTH / 2 + (i - moves / 2) * 60, GAME_HEIGHT / 2, 'ui-pip').setScale(2);
      jobs.push(
        this.tweenAsync({
          targets: pip,
          x: this.movesText.x,
          y: this.movesText.y,
          scale: 0.5,
          duration: 550,
          delay: i * 90,
          ease: 'Cubic.easeIn',
        }).then(() => pip.destroy()),
      );
    }
    await Promise.all(jobs);
    await this.tweenAsync({ targets: this.movesText, scale: 1.6, duration: 140, yoyo: true });
  }

  private overlay(): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(10);
  }

  private async onWin(): Promise<void> {
    this.journal.log('level_end', { level: this.state.level.id, won: true, movesLeft: this.state.movesLeft, retries: this.retryCount });
    this.blips.win();
    const dim = this.overlay();
    const stars: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const st = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, GAME_HEIGHT * 0.38, 'ui-star').setDepth(11).setScale(0);
      stars.push(st);
      await this.tweenAsync({ targets: st, scale: 2.2, duration: 260, ease: 'Back.easeOut' });
    }
    const idx = this.progress.levelIndex;
    this.progress.completed[this.state.level.id] = true;
    if (idx < this.levels.length - 1) this.progress.levelIndex = idx + 1;
    saveProgress(window.localStorage, this.progress);
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, 'ui-play').setDepth(11).setScale(2.4).setInteractive();
    btn.once('pointerup', () => {
      this.retryCount = 0;
      dim.destroy();
      stars.forEach((s) => s.destroy());
      btn.destroy();
      if (idx >= this.levels.length - 1) this.journal.log('chapter_complete', { chapter: 'kitchen' });
      this.startCurrentLevel();
    });
  }

  private async onLose(): Promise<void> {
    this.journal.log('level_end', { level: this.state.level.id, won: false, retries: this.retryCount });
    this.blips.lose();
    const dim = this.overlay();
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, 'ui-retry').setDepth(11).setScale(0).setInteractive();
    await this.tweenAsync({ targets: btn, scale: 2.4, duration: 300, ease: 'Back.easeOut' });
    btn.once('pointerup', () => {
      this.retryCount += 1;
      dim.destroy();
      btn.destroy();
      this.startCurrentLevel();
    });
  }
}
```

- [ ] **Step 4: rewrite `src/render/main.ts`:**

```ts
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PlayScene } from './PlayScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [PlayScene],
});
```

- [ ] **Step 5:** `npx tsc --noEmit` clean; `npm run build` green; `npm test` unchanged (109). Fix any type errors faithfully (e.g. Phaser tween config typing) WITHOUT changing behavior; report anything structural.

- [ ] **Step 6:** Commit `feat(render): playable match-3 PlayScene (input, choreography, HUD, win/lose/gift, journal hooks)`.

**Known simplifications (deliberate, note for reviewers):** the win overlay's ✓ character in updateHud is a symbol, not text; goal/move numbers are numeric HUD (allowed by near-zero-text tier); wake-lock and the pointing-hand tutorial land in plan 4 alongside profiles; propeller's extra-target flight is rendered as part of the clear pop (no dedicated flight animation yet).

---

### Task 8: Deploy — GitHub Pages workflow

**Files:** Create `.github/workflows/deploy.yml`; modify `README.md`

- [ ] **Step 1: `.github/workflows/deploy.yml`:**

```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2:** Controller enables Pages (API: `POST /repos/CharlesDeFarias/OmniGame/pages` with `{"build_type":"workflow"}` — 409 means already enabled, fine).

- [ ] **Step 3:** README: add a "Play" section with https://charlesdefarias.github.io/OmniGame/ and the Android install steps (open link in Chrome → menu → "Add to Home screen").

- [ ] **Step 4:** Commit `feat: GitHub Pages deploy workflow + play link`.

---

### Task 9: Final verification, merge, deploy check

- [ ] Controller: full `npm run typecheck && npm test && npm run build`; final whole-plan review; merge `feat/match3-presentation` → main (no-ff); push; verify BOTH workflows green (ci + deploy); confirm the Pages deployment is live (GitHub API pages status = built); update CLAUDE.md (phase → plan 3 executed; playable URL; plan-4 must-dos) + DECISIONS (#27 procedural art); rsync mount; handoff message to Charles with the URL and phone install steps.

---

## Self-review checklist

1. **Plan-2/3 must-dos covered:** shuffle event rendered (Task 7 animateStep) ✓; ShuffleError → regenerate at start AND mid-move (Task 7) ✓; swap-rejection reason (Task 0) consumed for wiggle ✓; opening shuffle silent (startLevel then syncBoard) ✓; journal hooks first-class (Tasks 1, 7: level_start/move/invalid_move/gift/shuffle/shuffle_error/level_end/retry-count/chapter_complete) ✓ (decision #26); progress save versioned (Task 2, decision from plan-1 review) ✓; haptics via navigator.vibrate on clears ✓; drag AND tap-tap swap ✓ (decision #16).
2. **Placeholders:** none — every file complete. DL-style discovery constants: none needed here.
3. **Type consistency:** Step/planSteps (Task 5) consumed by PlayScene (Task 7); JournalStorage shared by journal+progress (Tasks 1-2); config constants (Task 6) used by PlayScene/main (Task 7); textureKeyFor handles both piece kinds (Task 6) matching Piece union; MoveOutcome.reason (Task 0) read in attemptSwap (Task 7).
4. **Explicitly deferred to plan 4:** meta-progression (apartment/stars), profiles/text tiers/theme-pack switching UI, difficulty settings, stats screen UI (journal data collection already live), pointing-hand tutorial, wake-lock, mute toggle, obstacles + re-authored longer levels, adaptive difficulty (#24), time-tracking nudges (#25).
