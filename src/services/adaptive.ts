import type { JournalStorage } from './journal';
import { createRng } from '../core/match3/index';
import type { LevelDef, SpecialKind } from '../core/match3/index';

export interface AdaptiveState {
  version: 1;
  tier: number;
  recent: { won: boolean; stars: number }[];
  winsSinceBreak: number;
  /** Consecutive wins (loss resets to 0). Drives the free start-booster reward. */
  streak: number;
}

export interface Adaptive {
  state(): AdaptiveState;
  recordOutcome(won: boolean, stars: number): { tier: number; changed: boolean };
  applyTier(level: LevelDef): LevelDef;
  recordWin(): number;
  resetBreakCounter(): void;
}

const KEY = 'omnigame.adaptive.v1';

const DEFAULT: AdaptiveState = { version: 1, tier: 0, recent: [], winsSinceBreak: 0, streak: 0 };

function load(storage: JournalStorage): AdaptiveState {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return { ...DEFAULT, recent: [] };
    const data = JSON.parse(raw) as Partial<AdaptiveState> | null;
    if (
      data === null ||
      data.version !== 1 ||
      !Number.isInteger(data.tier) ||
      (data.tier as number) < -2 ||
      (data.tier as number) > 2 ||
      !Number.isInteger(data.winsSinceBreak) ||
      (data.winsSinceBreak as number) < 0
    ) {
      return { ...DEFAULT, recent: [] };
    }
    const recent = Array.isArray(data.recent)
      ? (data.recent as unknown[])
          .filter(
            (e) =>
              typeof e === 'object' &&
              e !== null &&
              typeof (e as Record<string, unknown>).won === 'boolean' &&
              typeof (e as Record<string, unknown>).stars === 'number' &&
              Number.isInteger((e as Record<string, unknown>).stars),
          )
          .map((e) => ({ won: (e as Record<string, unknown>).won as boolean, stars: (e as Record<string, unknown>).stars as number }))
      : [];
    // Defensive migration: states stored before the streak field default to 0
    // (invalid values too) without discarding the rest.
    const streak = Number.isInteger(data.streak) && (data.streak as number) >= 0 ? (data.streak as number) : 0;
    return {
      version: 1,
      tier: data.tier as number,
      recent,
      winsSinceBreak: data.winsSinceBreak as number,
      streak,
    };
  } catch {
    return { ...DEFAULT, recent: [] };
  }
}

function save(storage: JournalStorage, state: AdaptiveState): void {
  storage.setItem(KEY, JSON.stringify(state));
}


export interface TierDescription {
  movesDelta: number;
  ice: number;
  boxes: number;
}

/** Injection constants per positive tier (v2, decision #24 full form). */
const INJECTION: Record<1 | 2, { ice: number; boxes: number }> = {
  1: { ice: 3, boxes: 0 },
  2: { ice: 5, boxes: 1 },
};

/** Parent-corner summary of what a tier does to a level. */
export function describeTier(tier: number): TierDescription {
  const inj = tier >= 1 ? INJECTION[Math.min(tier, 2) as 1 | 2] : { ice: 0, boxes: 0 };
  return { movesDelta: tier === 0 ? 0 : -tier, ice: inj.ice, boxes: inj.boxes };
}

/** Pure tier application (v2). tier <= 0: moves-only, exactly as v1 — never touches the
 *  board and never removes authored obstacles. tier >= 1: moves-only PLUS obstacle
 *  injection, but ONLY when every goal is 'collect' (obstacle-goal economies are never
 *  distorted — those levels fall back to moves-only). Injection is deterministic:
 *  seeded from level.seed * 31 + tier, so the same level at the same tier always gets
 *  the same layout, and different tiers diverge. Guards (never violated — inject fewer
 *  or skip instead): total boxes <= floor(w*h/9); movable (non-box) cells >= 2/3 of the
 *  board; ice only on '.' cells (authored b/B/i are always preserved). */
export function applyTierTo(level: LevelDef, tier: number): LevelDef {
  const moves = Math.max(5, level.moves - tier);
  if (tier < 1) return { ...level, moves };
  if (!level.goals.every((g) => g.type === 'collect')) return { ...level, moves };

  const { width, height } = level.board;
  const rows: string[][] = level.board.layout
    ? level.board.layout.map((r) => r.split(''))
    : Array.from({ length: height }, () => new Array<string>(width).fill('.'));
  const rng = createRng(level.seed * 31 + tier);
  const inj = INJECTION[Math.min(tier, 2) as 1 | 2];

  // Eligible cells: currently open ('.'). Picked without replacement.
  const open: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y]![x] === '.') open.push(y * width + x);
    }
  }
  const takeOpen = (): number => {
    const i = rng.int(open.length);
    const cell = open[i]!;
    open.splice(i, 1);
    return cell;
  };

  for (let k = 0; k < inj.ice && open.length > 0; k++) {
    const cell = takeOpen();
    rows[Math.floor(cell / width)]![cell % width] = 'i';
  }

  for (let k = 0; k < inj.boxes && open.length > 0; k++) {
    const boxCount = rows.flat().filter((c) => c === 'b' || c === 'B').length;
    const withinCap = boxCount + 1 <= Math.floor((width * height) / 9);
    const movableOk = width * height - (boxCount + 1) >= Math.ceil((2 * width * height) / 3);
    if (!withinCap || !movableOk) break; // guard: skip rather than violate
    const cell = takeOpen();
    rows[Math.floor(cell / width)]![cell % width] = 'b';
  }

  return {
    ...level,
    moves,
    board: { ...level.board, layout: rows.map((r) => r.join('')) },
  };
}

/** Free start booster earned by the current win streak (renderer combines it with
 *  purchased boosters, cap 2 total): 3+ wins -> rocketH, 5+ -> tnt, 7+ -> lightball. */
export function streakBonus(streak: number): SpecialKind | null {
  if (streak >= 7) return 'lightball';
  if (streak >= 5) return 'tnt';
  if (streak >= 3) return 'rocketH';
  return null;
}

export function createAdaptive(storage: JournalStorage): Adaptive {
  let current = load(storage);

  return {
    state: () => ({
      version: 1,
      tier: current.tier,
      recent: [...current.recent],
      winsSinceBreak: current.winsSinceBreak,
      streak: current.streak,
    }),

    recordOutcome: (won: boolean, stars: number) => {
      current.streak = won ? current.streak + 1 : 0;
      const entry = { won, stars };
      current.recent.push(entry);
      if (current.recent.length > 5) {
        current.recent.shift();
      }

      let changed = false;
      const recent = current.recent;

      // Check for promotion: last 3 are all (won && stars === 3)
      if (recent.length >= 3) {
        const last3 = recent.slice(-3);
        if (last3.every((e) => e.won && e.stars === 3)) {
          if (current.tier < 2) {
            current.tier++;
            changed = true;
          }
          current.recent = [];
        } else {
          // Check for demotion: >= 2 of last 3 have won === false
          const losses = last3.filter((e) => !e.won).length;
          if (losses >= 2) {
            if (current.tier > -2) {
              current.tier--;
              changed = true;
            }
            current.recent = [];
          }
        }
      }

      save(storage, current);
      return { tier: current.tier, changed };
    },

    applyTier: (level: LevelDef) => applyTierTo(level, current.tier),

    recordWin: () => {
      current.winsSinceBreak++;
      save(storage, current);
      return current.winsSinceBreak;
    },

    resetBreakCounter: () => {
      current.winsSinceBreak = 0;
      save(storage, current);
    },
  };
}
