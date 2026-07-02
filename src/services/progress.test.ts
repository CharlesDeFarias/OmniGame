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
