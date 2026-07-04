import { describe, expect, it } from 'vitest';
import { createRunner, starsForRun } from './runner';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('runner progress', () => {
  it('starsForRun: 3 needs no revival and finalCount >= startCount; revival always means 1', () => {
    expect(starsForRun(false, 12, 5)).toBe(3);
    expect(starsForRun(false, 5, 5)).toBe(3);
    expect(starsForRun(false, 4, 5)).toBe(2);
    expect(starsForRun(true, 40, 5)).toBe(1);
  });

  it('record keeps the max per level and persists across a reload', () => {
    const storage = memStorage();
    const r = createRunner(storage);
    expect(r.bestFor('r01')).toBe(0);
    expect(r.record('r01', 2)).toBe(true);
    expect(r.record('r01', 1)).toBe(false);
    expect(r.record('r01', 3)).toBe(true);
    expect(r.record('r01', 3)).toBe(false);
    const reloaded = createRunner(storage);
    expect(reloaded.bestFor('r01')).toBe(3);
    expect(reloaded.data()).toEqual({ version: 1, best: { r01: 3 } });
  });

  it('corrupt or wrong-shape payloads fall back to defaults', () => {
    for (const bad of ['not json{', '{"version":2,"best":{}}', '{"version":1,"best":{"r01":9}}', '{"version":1,"best":[1]}']) {
      const storage = memStorage();
      storage.data.set('omnigame.runner.v1', bad);
      expect(createRunner(storage).data()).toEqual({ version: 1, best: {} });
    }
  });
});
