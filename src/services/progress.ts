import type { JournalStorage } from './journal';

export interface ProgressData {
  version: 1;
  levelIndex: number;
  completed: Record<string, true>;
  stars: Record<string, number>;
}

const KEY = 'omnigame.progress.v1';

const DEFAULT: ProgressData = { version: 1, levelIndex: 0, completed: {}, stars: {} };

export function loadProgress(storage: JournalStorage): ProgressData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return { ...DEFAULT, completed: {}, stars: {} };
    const p = JSON.parse(raw) as Partial<ProgressData> | null;
    if (
      p === null ||
      p.version !== 1 ||
      !Number.isInteger(p.levelIndex) ||
      (p.levelIndex as number) < 0 ||
      typeof p.completed !== 'object' ||
      p.completed === null ||
      Array.isArray(p.completed)
    ) {
      return { ...DEFAULT, completed: {}, stars: {} };
    }
    const stars =
      typeof p.stars === 'object' && p.stars !== null && !Array.isArray(p.stars) ? p.stars : {};
    return { version: 1, levelIndex: p.levelIndex as number, completed: p.completed, stars };
  } catch {
    return { ...DEFAULT, completed: {}, stars: {} };
  }
}

export function saveProgress(storage: JournalStorage, p: ProgressData): void {
  storage.setItem(KEY, JSON.stringify(p));
}
