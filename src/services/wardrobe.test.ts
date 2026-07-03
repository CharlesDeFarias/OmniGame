import { describe, expect, it } from 'vitest';
import { createWardrobe } from './wardrobe';
import { WARDROBE } from '../meta/wardrobe';
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

function richWallet(coins: number) {
  const w = createWallet(memStorage());
  for (let i = 0; i < Math.ceil(coins / 20); i++) w.earnWin(0); // +20 each
  return w;
}

describe('wardrobe catalog', () => {
  it('has 6 outfits at prices 80/100/120/150/180/220 with colors distinct from the 3 base avatar outfits', () => {
    expect(WARDROBE).toHaveLength(6);
    expect(WARDROBE.map((o) => o.price)).toEqual([80, 100, 120, 150, 180, 220]);
    const base = [0x9b59b6, 0x2ecc71, 0xe67e22]; // theme.ts avatar OUTFITS
    const colors = WARDROBE.map((o) => o.outfitColor);
    expect(new Set(colors).size).toBe(6);
    for (const c of colors) expect(base).not.toContain(c);
  });
});

describe('wardrobe service', () => {
  it('starts owning nothing with nothing equipped', () => {
    const w = createWardrobe(memStorage());
    expect(w.state()).toEqual({ version: 1, owned: [], equipped: null });
    expect(w.equippedColor()).toBeNull();
  });

  it('buy spends exactly the price and refuses double-buys, unknown ids, and thin wallets', () => {
    const w = createWardrobe(memStorage());
    const wallet = richWallet(100);
    const before = wallet.data().coins;
    expect(w.buy(WARDROBE[0]!.id, wallet)).toBe(true); // 80
    expect(wallet.data().coins).toBe(before - 80);
    expect(w.buy(WARDROBE[0]!.id, wallet)).toBe(false); // already owned
    expect(w.buy('tuxedo', wallet)).toBe(false); // unknown
    expect(w.buy(WARDROBE[5]!.id, wallet)).toBe(false); // 220 > remaining
    expect(wallet.data().coins).toBe(before - 80);
    expect(w.state().owned).toEqual([WARDROBE[0]!.id]);
  });

  it('equips owned outfits only and reports the equipped color', () => {
    const w = createWardrobe(memStorage());
    expect(w.equip(WARDROBE[1]!.id)).toBe(false); // not owned
    const wallet = richWallet(120);
    w.buy(WARDROBE[1]!.id, wallet);
    expect(w.equip(WARDROBE[1]!.id)).toBe(true);
    expect(w.state().equipped).toBe(WARDROBE[1]!.id);
    expect(w.equippedColor()).toBe(WARDROBE[1]!.outfitColor);
  });

  it('persists owned and equipped across instances', () => {
    const s = memStorage();
    const w = createWardrobe(s);
    const wallet = richWallet(100);
    w.buy(WARDROBE[0]!.id, wallet);
    w.equip(WARDROBE[0]!.id);
    const w2 = createWardrobe(s);
    expect(w2.state()).toEqual({ version: 1, owned: [WARDROBE[0]!.id], equipped: WARDROBE[0]!.id });
    expect(w2.equippedColor()).toBe(WARDROBE[0]!.outfitColor);
  });

  it('recovers from corrupted or wrong-version data', () => {
    const s = memStorage();
    s.setItem('omnigame.wardrobe.v1', 'garbage');
    expect(createWardrobe(s).state()).toEqual({ version: 1, owned: [], equipped: null });
    s.setItem('omnigame.wardrobe.v1', JSON.stringify({ version: 2 }));
    expect(createWardrobe(s).state()).toEqual({ version: 1, owned: [], equipped: null });
    s.setItem('omnigame.wardrobe.v1', JSON.stringify({ version: 1, owned: 'oops', equipped: 7 }));
    expect(createWardrobe(s).state()).toEqual({ version: 1, owned: [], equipped: null });
  });
});
