import type { JournalStorage } from './journal';
import type { LevelDef } from '../core/match3/index';

export interface AdaptiveState {
  version: 1;
  tier: number;
  recent: { won: boolean; stars: number }[];
  winsSinceBreak: number;
}

export interface Adaptive {
  state(): AdaptiveState;
  recordOutcome(won: boolean, stars: number): { tier: number; changed: boolean };
  applyTier(level: LevelDef): LevelDef;
  recordWin(): number;
  resetBreakCounter(): void;
}

const KEY = 'omnigame.adaptive.v1';

const DEFAULT: AdaptiveState = { version: 1, tier: 0, recent: [], winsSinceBreak: 0 };

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
    return {
      version: 1,
      tier: data.tier as number,
      recent,
      winsSinceBreak: data.winsSinceBreak as number,
    };
  } catch {
    return { ...DEFAULT, recent: [] };
  }
}

function save(storage: JournalStorage, state: AdaptiveState): void {
  storage.setItem(KEY, JSON.stringify(state));
}

export function createAdaptive(storage: JournalStorage): Adaptive {
  let current = load(storage);

  return {
    state: () => ({
      version: 1,
      tier: current.tier,
      recent: [...current.recent],
      winsSinceBreak: current.winsSinceBreak,
    }),

    recordOutcome: (won: boolean, stars: number) => {
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

    applyTier: (level: LevelDef) => ({
      ...level,
      moves: Math.max(5, level.moves - current.tier),
    }),

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
