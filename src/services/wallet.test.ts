import { describe, expect, it } from 'vitest';
import { createWallet, levelFor } from './wallet';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('wallet', () => {
  it('starts empty', () => {
    const w = createWallet(memStorage());
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 0, hearts: 0, xp: 0 });
    expect(w.level()).toBe(1);
  });

  it('earnWin pays coins per star, hearts only on 3 stars, xp per star', () => {
    const w = createWallet(memStorage());
    w.earnWin(1);
    expect(w.data()).toEqual({ version: 1, coins: 30, followers: 0, hearts: 0, xp: 10 });
    w.earnWin(2);
    expect(w.data()).toEqual({ version: 1, coins: 70, followers: 0, hearts: 0, xp: 30 });
    w.earnWin(3);
    expect(w.data()).toEqual({ version: 1, coins: 120, followers: 0, hearts: 3, xp: 60 });
  });

  it('earnWin(0) is handled defensively: base coins only, no hearts, no xp', () => {
    const w = createWallet(memStorage());
    w.earnWin(0);
    expect(w.data()).toEqual({ version: 1, coins: 20, followers: 0, hearts: 0, xp: 0 });
  });

  it('earnFinale pays 3 coins per finale rocket, nothing else', () => {
    const w = createWallet(memStorage());
    w.earnFinale(5);
    expect(w.data()).toEqual({ version: 1, coins: 15, followers: 0, hearts: 0, xp: 0 });
    w.earnFinale(0);
    expect(w.data().coins).toBe(15);
  });

  it('earnRunner adds exactly the given coins; xp is floor(coins/2) capped at 30', () => {
    const w = createWallet(memStorage());
    w.earnRunner(24);
    expect(w.data()).toEqual({ version: 1, coins: 24, followers: 0, hearts: 0, xp: 12 });
    w.earnRunner(70); // above coinsForScore's 60-coin ceiling: xp cap must bind
    expect(w.data().coins).toBe(94);
    expect(w.data().xp).toBe(42);
  });

  it('earnWin adds the per-chapter coin bonus to coins only', () => {
    const w = createWallet(memStorage());
    w.earnWin(2, 10);
    expect(w.data()).toEqual({ version: 1, coins: 50, followers: 0, hearts: 0, xp: 20 });
    w.earnWin(3, 15);
    expect(w.data()).toEqual({ version: 1, coins: 115, followers: 0, hearts: 3, xp: 50 });
  });

  it('earnVideo pays followers per perf, flat hearts and xp', () => {
    const w = createWallet(memStorage());
    w.earnVideo(0);
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 25, hearts: 15, xp: 100 });
    w.earnVideo(2);
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 60, hearts: 30, xp: 200 });
  });

  it('earnVideo scales followers/hearts/xp by the chapter multiplier, rounded', () => {
    const w = createWallet(memStorage());
    w.earnVideo(2, 1.25);
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 44, hearts: 19, xp: 125 });
    w.earnVideo(0, 1.75);
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 44 + 44, hearts: 19 + 26, xp: 125 + 175 });
  });

  it('earnTask pays a flat 20 hearts and 50 xp per manager task', () => {
    const w = createWallet(memStorage());
    w.earnTask();
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 0, hearts: 20, xp: 50 });
    w.earnTask();
    expect(w.data()).toEqual({ version: 1, coins: 0, followers: 0, hearts: 40, xp: 100 });
  });

  it('spend succeeds only with sufficient coins and never goes negative', () => {
    const w = createWallet(memStorage());
    w.earnWin(2); // 40 coins
    expect(w.spend(50)).toBe(false);
    expect(w.data().coins).toBe(40);
    expect(w.spend(40)).toBe(true);
    expect(w.data().coins).toBe(0);
    expect(w.spend(1)).toBe(false);
    expect(w.data().coins).toBe(0);
  });

  it('levelFor thresholds are 1-based with +1200 per level after the table', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(149)).toBe(1);
    expect(levelFor(150)).toBe(2);
    expect(levelFor(399)).toBe(2);
    expect(levelFor(400)).toBe(3);
    expect(levelFor(1149)).toBe(4);
    expect(levelFor(1150)).toBe(5);
    expect(levelFor(2999)).toBe(6);
    expect(levelFor(3000)).toBe(7);
    expect(levelFor(4199)).toBe(7);
    expect(levelFor(4200)).toBe(8);
    expect(levelFor(5400)).toBe(9);
  });

  it('persists every mutation and round-trips across instances', () => {
    const s = memStorage();
    const w = createWallet(s);
    w.earnWin(3);
    w.earnVideo(1);
    w.spend(10);
    const w2 = createWallet(s);
    expect(w2.data()).toEqual({ version: 1, coins: 40, followers: 30, hearts: 18, xp: 130 });
  });

  it('recovers to defaults on corrupted or wrong-version data', () => {
    const s = memStorage();
    s.setItem('omnigame.wallet.v1', 'garbage');
    expect(createWallet(s).data()).toEqual({ version: 1, coins: 0, followers: 0, hearts: 0, xp: 0 });
    s.setItem('omnigame.wallet.v1', JSON.stringify({ version: 99, coins: 500 }));
    expect(createWallet(s).data()).toEqual({ version: 1, coins: 0, followers: 0, hearts: 0, xp: 0 });
    s.setItem('omnigame.wallet.v1', JSON.stringify({ version: 1, coins: -5, followers: 0, hearts: 0, xp: 0 }));
    expect(createWallet(s).data()).toEqual({ version: 1, coins: 0, followers: 0, hearts: 0, xp: 0 });
  });

  it('data() returns a fresh copy that cannot mutate wallet state', () => {
    const w = createWallet(memStorage());
    w.earnWin(1);
    const d = w.data();
    d.coins = 9999;
    expect(w.data().coins).toBe(30);
  });
});

describe('wallet cooking rewards', () => {
  it('earnCooking pays coins and xp per stars, no hearts or followers, and persists', () => {
    const storage = memStorage();
    const w = createWallet(storage);
    w.earnCooking(3);
    expect(w.data()).toEqual({ version: 1, coins: 60, followers: 0, hearts: 0, xp: 30 });
    w.earnCooking(1);
    expect(w.data()).toEqual({ version: 1, coins: 100, followers: 0, hearts: 0, xp: 40 });
    const reloaded = createWallet(storage);
    expect(reloaded.data().coins).toBe(100);
    expect(reloaded.data().xp).toBe(40);
  });
});
