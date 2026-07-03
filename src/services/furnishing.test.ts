import { describe, expect, it } from 'vitest';
import { createFurnishing } from './furnishing';
import { KITCHEN_SLOTS } from '../meta/kitchenRoom';
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

describe('kitchen catalog', () => {
  it('has 6 slots with 3 style choices each at tiered prices 40/40/70/70/110/110', () => {
    expect(KITCHEN_SLOTS).toHaveLength(6);
    expect(KITCHEN_SLOTS.map((s) => s.id)).toEqual(['counter', 'fridge', 'table', 'lamp', 'plant', 'art']);
    const tierPrices = [40, 40, 70, 70, 110, 110];
    KITCHEN_SLOTS.forEach((slot, i) => {
      expect(slot.textureBase).toBe(`furn-${slot.id}`);
      expect(slot.choices.map((c) => c.styleId)).toEqual(['a', 'b', 'c']);
      slot.choices.forEach((c) => expect(c.price).toBe(tierPrices[i]));
    });
  });
});

describe('furnishing', () => {
  it('starts empty, incomplete, no videos', () => {
    const f = createFurnishing(memStorage());
    expect(f.state()).toEqual({ version: 1, rooms: { kitchen: {} }, videos: {} });
    expect(f.isRoomComplete('kitchen')).toBe(false);
    expect(f.hasFilmedVideo('kitchen')).toBe(false);
  });

  it('furnish debits the wallet by exactly the slot price and records the style', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(100);
    const before = w.data().coins;
    expect(f.furnish('counter', 'b', w)).toBe(true);
    expect(w.data().coins).toBe(before - 40);
    expect(f.state().rooms.kitchen).toEqual({ counter: 'b' });
  });

  it('rejects occupied slot, unknown slot, and unknown style without spending', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(400);
    expect(f.furnish('counter', 'a', w)).toBe(true);
    const coins = w.data().coins;
    expect(f.furnish('counter', 'b', w)).toBe(false); // occupied
    expect(f.furnish('sofa', 'a', w)).toBe(false); // unknown slot
    expect(f.furnish('fridge', 'z', w)).toBe(false); // unknown style
    expect(w.data().coins).toBe(coins);
    expect(f.state().rooms.kitchen).toEqual({ counter: 'a' });
  });

  it('rejects when the wallet cannot afford the price', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(20); // 20 coins < 40
    expect(f.furnish('counter', 'a', w)).toBe(false);
    expect(f.state().rooms.kitchen).toEqual({});
  });

  it('room is complete only after all 6 slots are furnished', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(1000);
    for (const slot of KITCHEN_SLOTS.slice(0, 5)) expect(f.furnish(slot.id, 'a', w)).toBe(true);
    expect(f.isRoomComplete('kitchen')).toBe(false);
    expect(f.furnish('art', 'c', w)).toBe(true);
    expect(f.isRoomComplete('kitchen')).toBe(true);
  });

  it('nextAffordableSlot returns the first empty slot within budget, or null', () => {
    const f = createFurnishing(memStorage());
    expect(f.nextAffordableSlot(39)).toBeNull();
    expect(f.nextAffordableSlot(40)).toBe('counter');
    const w = richWallet(200);
    f.furnish('counter', 'a', w);
    expect(f.nextAffordableSlot(40)).toBe('fridge');
    f.furnish('fridge', 'a', w);
    expect(f.nextAffordableSlot(69)).toBeNull();
    expect(f.nextAffordableSlot(70)).toBe('table');
  });

  it('persists across instances and recovers from corruption', () => {
    const s = memStorage();
    const f = createFurnishing(s);
    const w = richWallet(100);
    f.furnish('counter', 'c', w);
    f.markVideoFilmed('kitchen');
    const f2 = createFurnishing(s);
    expect(f2.state().rooms.kitchen).toEqual({ counter: 'c' });
    expect(f2.hasFilmedVideo('kitchen')).toBe(true);
    s.setItem('omnigame.furnish.v1', 'garbage');
    expect(createFurnishing(s).state()).toEqual({ version: 1, rooms: { kitchen: {} }, videos: {} });
    s.setItem('omnigame.furnish.v1', JSON.stringify({ version: 2 }));
    expect(createFurnishing(s).state()).toEqual({ version: 1, rooms: { kitchen: {} }, videos: {} });
  });

  it('video filmed flag round-trips and is idempotent', () => {
    const f = createFurnishing(memStorage());
    expect(f.hasFilmedVideo('kitchen')).toBe(false);
    f.markVideoFilmed('kitchen');
    f.markVideoFilmed('kitchen');
    expect(f.hasFilmedVideo('kitchen')).toBe(true);
    expect(f.state().videos).toEqual({ kitchen: true });
  });
});
