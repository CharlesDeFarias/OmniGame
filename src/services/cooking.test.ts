import { describe, expect, it } from 'vitest';
import { createCooking } from './cooking';
import { createWallet } from './wallet';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('cooking progression', () => {
  it('starts with only the first recipe unlocked and no bests', () => {
    const c = createCooking(memStorage());
    expect(c.data()).toEqual({ version: 1, best: {}, unlocked: 1 });
    expect(c.isUnlocked(0)).toBe(true);
    expect(c.isUnlocked(1)).toBe(false);
    expect(c.bestFor('toast')).toBe(0);
  });

  it('recordCompletion on the frontier recipe unlocks the next one and pays the wallet', () => {
    const storage = memStorage();
    const c = createCooking(storage);
    const w = createWallet(storage);
    const r = c.recordCompletion('toast', 0, 2, w);
    expect(r).toEqual({ newBest: true, unlockedNext: true });
    expect(c.bestFor('toast')).toBe(2);
    expect(c.isUnlocked(1)).toBe(true);
    expect(c.isUnlocked(2)).toBe(false);
    expect(w.data().coins).toBe(50);
    expect(w.data().xp).toBe(20);
  });

  it('best keeps the max: a worse replay is not a new best and does not lower it', () => {
    const storage = memStorage();
    const c = createCooking(storage);
    const w = createWallet(storage);
    c.recordCompletion('toast', 0, 3, w);
    const r = c.recordCompletion('toast', 0, 1, w);
    expect(r.newBest).toBe(false);
    expect(c.bestFor('toast')).toBe(3);
  });

  it('replaying a non-frontier recipe never unlocks anything further', () => {
    const storage = memStorage();
    const c = createCooking(storage);
    const w = createWallet(storage);
    c.recordCompletion('toast', 0, 2, w); // unlocked -> 2
    const r = c.recordCompletion('toast', 0, 3, w);
    expect(r).toEqual({ newBest: true, unlockedNext: false });
    expect(c.data().unlocked).toBe(2);
  });

  it('unlocked caps at the recipe count (15) even after finishing the last recipe', () => {
    const storage = memStorage();
    const c = createCooking(storage);
    const w = createWallet(storage);
    for (let i = 0; i < 15; i += 1) c.recordCompletion(`r${i}`, i, 3, w);
    expect(c.data().unlocked).toBe(15);
    const r = c.recordCompletion('r14', 14, 3, w);
    expect(r.unlockedNext).toBe(false);
    expect(c.data().unlocked).toBe(15);
  });

  it('servingUnlocked flips true at 5 distinct completed recipes (replays do not count twice)', () => {
    const storage = memStorage();
    const c = createCooking(storage);
    const w = createWallet(storage);
    expect(c.servingUnlocked()).toBe(false);
    for (let i = 0; i < 4; i += 1) c.recordCompletion(`r${i}`, i, 3, w);
    c.recordCompletion('r0', 0, 3, w); // replay, still 4 distinct
    expect(c.servingUnlocked()).toBe(false);
    c.recordCompletion('r4', 4, 2, w);
    expect(c.servingUnlocked()).toBe(true);
    // Persisted: a fresh instance agrees.
    expect(createCooking(storage).servingUnlocked()).toBe(true);
  });

  it('persists across instances via storage', () => {
    const storage = memStorage();
    const c = createCooking(storage);
    c.recordCompletion('toast', 0, 3, createWallet(memStorage()));
    const again = createCooking(storage);
    expect(again.bestFor('toast')).toBe(3);
    expect(again.isUnlocked(1)).toBe(true);
  });

  it('is corruption-safe: garbage or wrong shapes fall back to defaults', () => {
    for (const bad of ['not json', '{"version":9}', '"str"', '{"version":1,"best":3,"unlocked":1}', '{"version":1,"best":{},"unlocked":-2}', '{"version":1,"best":{"toast":9},"unlocked":1}']) {
      const storage = memStorage();
      storage.data.set('omnigame.cooking.v1', bad);
      const c = createCooking(storage);
      expect(c.data()).toEqual({ version: 1, best: {}, unlocked: 1 });
    }
  });
});
