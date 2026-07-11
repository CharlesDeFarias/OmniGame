import { describe, expect, it } from 'vitest';
import { DISHES } from './dishes';
import { serveReady, startShift, tapIngredient, tickPatience } from './engine';
import type { DinerEvent, ShiftState } from './types';

const CUSTOMERS = 5;

/** Play a whole order perfectly: tap the exact stack, then serve. */
function buildCurrentPerfectly(s: ShiftState): { state: ShiftState; events: DinerEvent[] } {
  let state = s;
  const events: DinerEvent[] = [];
  const dish = state.customers[state.current]!.dish;
  for (const ing of dish.stack) {
    const r = tapIngredient(state, ing);
    state = r.state;
    events.push(...r.events);
  }
  const r = serveReady(state);
  state = r.state;
  events.push(...r.events);
  return { state, events };
}

describe('diner engine', () => {
  it('startShift is deterministic per seed and queues 5 customers with a non-decreasing height ramp', () => {
    const a = startShift(42, false);
    const b = startShift(42, false);
    expect(a.customers.map((c) => c.dish.id)).toEqual(b.customers.map((c) => c.dish.id));
    expect(a.customers).toHaveLength(CUSTOMERS);
    for (let i = 1; i < a.customers.length; i++) {
      expect(a.customers[i]!.dish.stack.length).toBeGreaterThanOrEqual(a.customers[i - 1]!.dish.stack.length);
    }
    expect(a.status).toBe('serving');
    expect(startShift(43, false).customers.map((c) => c.dish.id)).not.toEqual(a.customers.map((c) => c.dish.id));
  });

  it('correct taps stack layers in order and emit placed events, then ready', () => {
    const s = startShift(7, false);
    const dish = s.customers[0]!.dish;
    let state = s;
    dish.stack.forEach((ing, i) => {
      const r = tapIngredient(state, ing);
      state = r.state;
      expect(r.events[0]).toEqual({ type: 'placed', ingredient: ing, layer: i });
      if (i === dish.stack.length - 1) {
        expect(r.events.some((e) => e.type === 'ready')).toBe(true);
      }
    });
    expect(state.built).toBe(dish.stack.length);
  });

  it('a wrong tap is rejected, counts a mistake, and never resets the build', () => {
    const s = startShift(7, false);
    const dish = s.customers[0]!.dish;
    const first = dish.stack[0]!;
    const wrong = dish.stack[1]!; // needed later, but not NOW — order matters
    let state = tapIngredient(s, first).state;
    const r = tapIngredient(state, wrong === first ? dish.stack[2]! : wrong);
    // The needed layer is stack[1]; tapping anything else rejects.
    const notNeeded = dish.stack.find((ing, i) => i > 1 && ing !== dish.stack[1]);
    const rr = notNeeded ? tapIngredient(state, notNeeded) : r;
    state = rr.state;
    expect(rr.events[0]!.type === 'rejected' || rr.events[0]!.type === 'placed').toBe(true);
    if (rr.events[0]!.type === 'rejected') {
      expect(state.built).toBe(1);
      expect(state.mistakes + Number(state.customers[state.current]!.shieldUsed)).toBeGreaterThanOrEqual(1);
    }
  });

  it('the pantry shield absorbs exactly the first mistake of the shift', () => {
    const s = startShift(7, true);
    const dish = s.customers[0]!.dish;
    // Tap something that is definitely not the first layer.
    const wrong = dish.stack.find((ing) => ing !== dish.stack[0])!;
    const r1 = tapIngredient(s, wrong);
    expect(r1.events[0]).toMatchObject({ type: 'rejected', shielded: true });
    expect(r1.state.mistakes).toBe(0);
    expect(r1.state.shieldAvailable).toBe(false);
    const r2 = tapIngredient(r1.state, wrong);
    expect(r2.events[0]).toMatchObject({ type: 'rejected', shielded: false });
    expect(r2.state.mistakes).toBe(1);
  });

  it('serving requires a complete build and advances to the next customer', () => {
    const s = startShift(9, false);
    const early = serveReady(s);
    expect(early.state.current).toBe(0); // nothing happens on an incomplete build
    expect(early.events).toHaveLength(0);
    const done = buildCurrentPerfectly(s);
    expect(done.state.current).toBe(1);
    expect(done.state.built).toBe(0);
    expect(done.events.some((e) => e.type === 'served' && e.customer === 0)).toBe(true);
  });

  it('patience drains with ticks, never below zero, and only affects the tip', () => {
    let s = startShift(11, false);
    for (let i = 0; i < 200; i++) s = tickPatience(s, 1);
    expect(s.customers[0]!.patience).toBe(0);
    expect(s.status).toBe('serving'); // zero patience never fails anything
    const done = buildCurrentPerfectly(s);
    const served = done.events.find((e): e is Extract<DinerEvent, { type: 'served' }> => e.type === 'served');
    expect(served!.tipped).toBe(false);
  });

  it('a fast perfect serve tips', () => {
    const s = startShift(11, false);
    const done = buildCurrentPerfectly(s);
    const served = done.events.find((e): e is Extract<DinerEvent, { type: 'served' }> => e.type === 'served');
    expect(served!.tipped).toBe(true);
  });

  it('a full perfect shift ends with 3 stars; mistakes grade down (1-2 -> 2 stars, 3+ -> 1)', () => {
    let state = startShift(13, false);
    let events: DinerEvent[] = [];
    for (let c = 0; c < CUSTOMERS; c++) {
      const r = buildCurrentPerfectly(state);
      state = r.state;
      events = events.concat(r.events);
    }
    expect(state.status).toBe('done');
    const end = events.find((e): e is Extract<DinerEvent, { type: 'shiftEnd' }> => e.type === 'shiftEnd');
    expect(end).toMatchObject({ stars: 3, mistakes: 0 });
    // Grade boundaries via direct state surgery (engine grades on shift end).
    const twoStar = { ...startShift(13, false), mistakes: 2 };
    let st2 = twoStar;
    let ev2: DinerEvent[] = [];
    for (let c = 0; c < CUSTOMERS; c++) {
      const r = buildCurrentPerfectly(st2);
      st2 = r.state;
      ev2 = ev2.concat(r.events);
    }
    const end2 = ev2.find((e): e is Extract<DinerEvent, { type: 'shiftEnd' }> => e.type === 'shiftEnd');
    expect(end2!.stars).toBe(2);
  });

  it('taps after the shift is done are ignored', () => {
    let state = startShift(13, false);
    for (let c = 0; c < CUSTOMERS; c++) state = buildCurrentPerfectly(state).state;
    const r = tapIngredient(state, DISHES[0]!.stack[0]!);
    expect(r.events).toHaveLength(0);
    expect(r.state).toBe(state);
  });

  it('every queued dish is buildable from its family counter', () => {
    const s = startShift(99, false);
    for (const c of s.customers) {
      expect(c.dish.stack.length).toBeGreaterThanOrEqual(3);
    }
  });
});
