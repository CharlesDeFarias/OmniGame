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
    if (
      p === null ||
      p.version !== 1 ||
      typeof p.levelIndex !== 'number' ||
      typeof p.completed !== 'object' ||
      p.completed === null ||
      Array.isArray(p.completed)
    ) {
      return { ...DEFAULT, completed: {} };
    }
    return { version: 1, levelIndex: p.levelIndex, completed: p.completed };
  } catch {
    return { ...DEFAULT, completed: {} };
  }
}

export function saveProgress(storage: JournalStorage, p: ProgressData): void {
  storage.setItem(KEY, JSON.stringify(p));
}
