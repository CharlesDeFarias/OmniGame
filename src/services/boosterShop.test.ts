import { describe, expect, it } from 'vitest';
import { BOOSTER_PRICES, buy } from './boosterShop';
import { createWallet } from './wallet';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('boosterShop', () => {
  it('prices rocketH 40, tnt 60, lightball 90', () => {
    expect(BOOSTER_PRICES).toEqual({ rocketH: 40, tnt: 60, lightball: 90 });
  });

  it('buy spends the price and returns true when affordable', () => {
    const w = createWallet(memStorage());
    w.earnRunner(100); // +100 coins
    expect(buy('tnt', w)).toBe(true);
    expect(w.data().coins).toBe(40);
  });

  it('buy returns false and leaves the wallet untouched when coins are short', () => {
    const w = createWallet(memStorage());
    w.earnRunner(50);
    expect(buy('lightball', w)).toBe(false);
    expect(w.data().coins).toBe(50);
  });
});
