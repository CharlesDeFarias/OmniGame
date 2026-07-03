import { describe, expect, it } from 'vitest';
import { ROOMS, CHAPTER_COIN_BONUS_PER_INDEX } from './rooms';
import { KITCHEN_SLOTS } from './kitchenRoom';
import { CHAPTERS } from './chapters';

describe('rooms catalog', () => {
  it('has a 6-slot room for every chapter, each slot with 3 priced styles a/b/c', () => {
    for (const ch of CHAPTERS) {
      const slots = ROOMS[ch.id];
      expect(slots, ch.id).toHaveLength(6);
      for (const slot of slots) {
        expect(slot.choices.map((c) => c.styleId)).toEqual(['a', 'b', 'c']);
        for (const c of slot.choices) expect(c.price).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the kitchen slots exactly as plan 6 shipped them (back-compat)', () => {
    expect(ROOMS.kitchen).toBe(KITCHEN_SLOTS);
    expect(KITCHEN_SLOTS.map((s) => s.id)).toEqual(['counter', 'fridge', 'table', 'lamp', 'plant', 'art']);
    const tierPrices = [40, 40, 70, 70, 110, 110];
    KITCHEN_SLOTS.forEach((slot, i) => {
      expect(slot.textureBase).toBe(`furn-${slot.id}`);
      slot.choices.forEach((c) => expect(c.price).toBe(tierPrices[i]));
    });
  });

  it('names the new rooms per the plan', () => {
    expect(ROOMS.dance.map((s) => s.id)).toEqual(['mirror', 'barre', 'speaker', 'discoball', 'mat', 'poster']);
    expect(ROOMS.gym.map((s) => s.id)).toEqual(['treadmill', 'weights', 'bench', 'fan', 'mat', 'chart']);
    expect(ROOMS.vanity.map((s) => s.id)).toEqual(['mirror-lights', 'chair', 'desk', 'rack', 'ringlight', 'shelf']);
  });

  it('prices the new rooms per the economy probe (totals 360/420/460, ascending tiers)', () => {
    const total = (id: 'dance' | 'gym' | 'vanity'): number =>
      ROOMS[id].reduce((a, s) => a + (s.choices[0]?.price ?? 0), 0);
    expect(ROOMS.dance.map((s) => s.choices[0]!.price)).toEqual([40, 40, 60, 60, 80, 80]);
    expect(ROOMS.gym.map((s) => s.choices[0]!.price)).toEqual([45, 45, 70, 70, 95, 95]);
    expect(ROOMS.vanity.map((s) => s.choices[0]!.price)).toEqual([50, 50, 75, 75, 105, 105]);
    expect([total('dance'), total('gym'), total('vanity')]).toEqual([360, 420, 460]);
  });

  it('gives new rooms chapter-scoped texture bases so per-room art cannot collide (dance mat vs gym mat)', () => {
    const danceMat = ROOMS.dance.find((s) => s.id === 'mat')!;
    const gymMat = ROOMS.gym.find((s) => s.id === 'mat')!;
    expect(danceMat.textureBase).toBe('furn-dance-mat');
    expect(gymMat.textureBase).toBe('furn-gym-mat');
    expect(danceMat.textureBase).not.toBe(gymMat.textureBase);
  });

  it('exposes the probe-chosen coin bonus (+5 coins per win per chapter index)', () => {
    expect(CHAPTER_COIN_BONUS_PER_INDEX).toBe(5);
  });
});
