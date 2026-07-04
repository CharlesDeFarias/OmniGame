import { describe, expect, it } from 'vitest';
import { RECIPES } from './recipes';
import type { IngredientId, Recipe } from './types';
import { applyServe, startServing, starsForServing, type ServingState } from './serving';

const FIVE = RECIPES.slice(0, 5).map((r) => r.id);

function gatherSetOf(recipe: Recipe): IngredientId[] {
  const seen = new Set<IngredientId>();
  for (const step of recipe.steps) {
    if (step.type === 'gather') step.ingredients.forEach((i) => seen.add(i));
  }
  return [...seen];
}

function recipeById(id: string): Recipe {
  const r = RECIPES.find((x) => x.id === id);
  if (r === undefined) throw new Error(`unknown recipe ${id}`);
  return r;
}

/** Serves every needed ingredient of the current order, in the given order. */
function serveOrder(state: ServingState, reversed = false): ServingState {
  const items = reversed ? [...state.needed].reverse() : [...state.needed];
  let s = state;
  for (const id of items) {
    const r = applyServe(s, id);
    expect(r.correct).toBe(true);
    s = r.state;
  }
  return s;
}

describe('serving mode core (decision #53)', () => {
  it('is deterministic: same unlocked list + seed always yields the same 3 orders', () => {
    const a = startServing(FIVE, 42);
    const b = startServing(FIVE, 42);
    expect(a.orders).toEqual(b.orders);
    expect(a.orders).toHaveLength(3);
    // No Math.random anywhere: repeated calls can never drift.
    for (let i = 0; i < 5; i += 1) expect(startServing(FIVE, 42).orders).toEqual(a.orders);
  });

  it('varies across seeds and favors variety: 3 distinct orders when 3+ recipes are unlocked', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const s = startServing(FIVE, seed);
      expect(new Set(s.orders).size).toBe(3);
      s.orders.forEach((id) => expect(FIVE).toContain(id));
      seen.add(JSON.stringify(s.orders));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('repeats gracefully when fewer than 3 recipes are unlocked; empty list is done at once', () => {
    const one = startServing(['toast'], 7);
    expect(one.orders).toEqual(['toast', 'toast', 'toast']);
    expect(one.done).toBe(false);
    const none = startServing([], 7);
    expect(none.done).toBe(true);
    expect(none.orders).toEqual([]);
  });

  it("asks for the current order's full gather set, servable in any order", () => {
    const s0 = startServing(FIVE, 3);
    const expected = gatherSetOf(recipeById(s0.orders[0]!));
    expect([...s0.needed].sort()).toEqual([...expected].sort());
    // Reverse order works: order-free within an order.
    const s1 = serveOrder(s0, true);
    expect(s1.orderIndex).toBe(1);
    expect(s1.mistakes).toBe(0);
  });

  it('wrong ingredients count a mistake without touching the needed set (immutably)', () => {
    const s0 = startServing(FIVE, 3);
    const wrong = (['bread', 'salt', 'egg', 'milk'] as IngredientId[]).find((id) => !s0.needed.includes(id))!;
    const r = applyServe(s0, wrong);
    expect(r.correct).toBe(false);
    expect(r.events).toEqual([{ type: 'wrong' }]);
    expect(r.state.mistakes).toBe(1);
    expect(r.state.needed).toEqual(s0.needed);
    expect(s0.mistakes).toBe(0); // input state untouched
  });

  it('completing an order emits orderDone and loads the next gather set', () => {
    const s0 = startServing(FIVE, 9);
    let s = s0;
    for (let i = 0; i < s0.needed.length - 1; i += 1) s = applyServe(s, s.needed[0]!).state;
    const r = applyServe(s, s.needed[0]!);
    expect(r.events.some((e) => e.type === 'orderDone' && e.orderIndex === 0)).toBe(true);
    expect(r.state.orderIndex).toBe(1);
    expect([...r.state.needed].sort()).toEqual(gatherSetOf(recipeById(s0.orders[1]!)).sort());
  });

  it('finishes after 3 orders: clean play emits servingDone with 3 stars', () => {
    let s = startServing(FIVE, 11);
    s = serveOrder(s);
    s = serveOrder(s);
    const items = [...s.needed];
    let lastEvents: unknown[] = [];
    for (const id of items) {
      const r = applyServe(s, id);
      s = r.state;
      lastEvents = r.events;
    }
    expect(s.done).toBe(true);
    expect(lastEvents[lastEvents.length - 1]).toEqual({ type: 'servingDone', stars: 3, mistakes: 0 });
  });

  it('scores by total mistakes: <=2 three stars, <=5 two, else one', () => {
    expect(starsForServing(0)).toBe(3);
    expect(starsForServing(2)).toBe(3);
    expect(starsForServing(3)).toBe(2);
    expect(starsForServing(5)).toBe(2);
    expect(starsForServing(6)).toBe(1);
    // Integrated: 3 wrong taps across a full round land 2 stars.
    let s = startServing(FIVE, 13);
    for (let i = 0; i < 3; i += 1) {
      const wrong = (['bread', 'salt', 'egg', 'milk', 'oil'] as IngredientId[]).find((id) => !s.needed.includes(id))!;
      s = applyServe(s, wrong).state;
    }
    let events: unknown[] = [];
    while (!s.done) {
      const r = applyServe(s, s.needed[0]!);
      s = r.state;
      events = r.events;
    }
    expect(events[events.length - 1]).toEqual({ type: 'servingDone', stars: 2, mistakes: 3 });
  });

  it('is inert after done: extra inputs neither charge mistakes nor emit events', () => {
    let s = startServing(FIVE, 11);
    while (!s.done) s = applyServe(s, s.needed[0]!).state;
    const r = applyServe(s, 'bread');
    expect(r.correct).toBe(false);
    expect(r.events).toEqual([]);
    expect(r.state.mistakes).toBe(s.mistakes);
  });
});
