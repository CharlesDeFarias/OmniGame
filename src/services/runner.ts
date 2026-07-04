import type { JournalStorage } from './journal';

export interface RunnerData {
  version: 1;
  /** Best star count per runner level id (1-3); absent = never won. */
  best: Record<string, number>;
}

export interface RunnerProgress {
  data(): RunnerData;
  bestFor(id: string): number;
  /** Records a won run; best keeps the max. Returns true when this is a new best. */
  record(id: string, stars: 1 | 2 | 3): boolean;
}

/**
 * Star rule (gate-runner renderer, queue #20): only wins earn stars.
 * 3 = won without the one-time revival AND finished with at least the starting
 * squad; 2 = won without revival; 1 = won after reviving.
 */
export function starsForRun(revived: boolean, finalCount: number, startCount: number): 1 | 2 | 3 {
  if (revived) return 1;
  return finalCount >= startCount ? 3 : 2;
}

const KEY = 'omnigame.runner.v1';

function defaults(): RunnerData {
  return { version: 1, best: {} };
}

function isStarCount(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 3;
}

function load(storage: JournalStorage): RunnerData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return defaults();
    const d = p as Partial<RunnerData>;
    if (d.version !== 1) return defaults();
    const best = d.best;
    if (typeof best !== 'object' || best === null || Array.isArray(best)) return defaults();
    for (const v of Object.values(best)) {
      if (!isStarCount(v)) return defaults();
    }
    return { version: 1, best: { ...best } };
  } catch {
    return defaults();
  }
}

export function createRunner(storage: JournalStorage): RunnerProgress {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  return {
    data: () => ({ version: 1, best: { ...state.best } }),
    bestFor: (id) => state.best[id] ?? 0,
    record(id, stars) {
      const prev = state.best[id] ?? 0;
      if (stars <= prev) return false;
      state.best[id] = stars;
      save();
      return true;
    },
  };
}
