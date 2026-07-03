import { describe, expect, it } from 'vitest';
import { createFurnishing, type FurnishState } from './furnishing';
import { KITCHEN_SLOTS } from '../meta/kitchenRoom';
import { ROOMS } from '../meta/rooms';
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

const EMPTY: FurnishState = {
  version: 2,
  rooms: { kitchen: {}, dance: {}, gym: {}, vanity: {} },
  videos: {},
};

describe('kitchen catalog (back-compat via kitchenRoom shim)', () => {
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
  it('starts empty across all four rooms, incomplete, no videos', () => {
    const f = createFurnishing(memStorage());
    expect(f.state()).toEqual(EMPTY);
    expect(f.isRoomComplete('kitchen')).toBe(false);
    expect(f.isRoomComplete('dance')).toBe(false);
    expect(f.hasFilmedVideo('kitchen')).toBe(false);
  });

  it('furnish debits the wallet by exactly the slot price and records the style in that room', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(100);
    const before = w.data().coins;
    expect(f.furnish('kitchen', 'counter', 'b', w)).toBe(true);
    expect(w.data().coins).toBe(before - 40);
    expect(f.state().rooms.kitchen).toEqual({ counter: 'b' });
    expect(f.state().rooms.dance).toEqual({});
  });

  it('furnishes non-kitchen rooms with their own catalogs and prices', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(100);
    const before = w.data().coins;
    expect(f.furnish('dance', 'mirror', 'a', w)).toBe(true);
    expect(w.data().coins).toBe(before - 40);
    expect(f.state().rooms.dance).toEqual({ mirror: 'a' });
    // Same slot name in a different room is independent.
    expect(f.furnish('gym', 'mirror', 'a', w)).toBe(false); // gym has no mirror slot
    expect(f.furnish('gym', 'treadmill', 'a', w)).toBe(true);
  });

  it('rejects occupied slot, unknown slot, and unknown style without spending', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(400);
    expect(f.furnish('kitchen', 'counter', 'a', w)).toBe(true);
    const coins = w.data().coins;
    expect(f.furnish('kitchen', 'counter', 'b', w)).toBe(false); // occupied
    expect(f.furnish('kitchen', 'sofa', 'a', w)).toBe(false); // unknown slot
    expect(f.furnish('kitchen', 'fridge', 'z', w)).toBe(false); // unknown style
    expect(w.data().coins).toBe(coins);
    expect(f.state().rooms.kitchen).toEqual({ counter: 'a' });
  });

  it('rejects when the wallet cannot afford the price', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(20); // 20 coins < 40
    expect(f.furnish('kitchen', 'counter', 'a', w)).toBe(false);
    expect(f.state().rooms.kitchen).toEqual({});
  });

  it('a room is complete only after all 6 of its slots are furnished', () => {
    const f = createFurnishing(memStorage());
    const w = richWallet(1000);
    for (const slot of ROOMS.dance.slice(0, 5)) expect(f.furnish('dance', slot.id, 'a', w)).toBe(true);
    expect(f.isRoomComplete('dance')).toBe(false);
    expect(f.furnish('dance', 'poster', 'c', w)).toBe(true);
    expect(f.isRoomComplete('dance')).toBe(true);
    expect(f.isRoomComplete('kitchen')).toBe(false);
  });

  it('nextAffordableSlot is per-room: first empty slot within budget, or null', () => {
    const f = createFurnishing(memStorage());
    expect(f.nextAffordableSlot('kitchen', 39)).toBeNull();
    expect(f.nextAffordableSlot('kitchen', 40)).toBe('counter');
    expect(f.nextAffordableSlot('gym', 44)).toBeNull();
    expect(f.nextAffordableSlot('gym', 45)).toBe('treadmill');
    const w = richWallet(200);
    f.furnish('kitchen', 'counter', 'a', w);
    expect(f.nextAffordableSlot('kitchen', 40)).toBe('fridge');
    f.furnish('kitchen', 'fridge', 'a', w);
    expect(f.nextAffordableSlot('kitchen', 69)).toBeNull();
    expect(f.nextAffordableSlot('kitchen', 70)).toBe('table');
  });

  it('migrates v1 kitchen-only state silently into the all-rooms shape', () => {
    const s = memStorage();
    s.setItem(
      'omnigame.furnish.v1',
      JSON.stringify({ version: 1, rooms: { kitchen: { counter: 'b', lamp: 'a' } }, videos: { kitchen: true } }),
    );
    const f = createFurnishing(s);
    expect(f.state()).toEqual({
      version: 2,
      rooms: { kitchen: { counter: 'b', lamp: 'a' }, dance: {}, gym: {}, vanity: {} },
      videos: { kitchen: true },
    });
    expect(f.hasFilmedVideo('kitchen')).toBe(true);
  });

  it('persists across instances and recovers from corruption', () => {
    const s = memStorage();
    const f = createFurnishing(s);
    const w = richWallet(100);
    f.furnish('kitchen', 'counter', 'c', w);
    f.markVideoFilmed('kitchen');
    const f2 = createFurnishing(s);
    expect(f2.state().rooms.kitchen).toEqual({ counter: 'c' });
    expect(f2.hasFilmedVideo('kitchen')).toBe(true);
    s.setItem('omnigame.furnish.v1', 'garbage');
    expect(createFurnishing(s).state()).toEqual(EMPTY);
    s.setItem('omnigame.furnish.v1', JSON.stringify({ version: 99 }));
    expect(createFurnishing(s).state()).toEqual(EMPTY);
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
