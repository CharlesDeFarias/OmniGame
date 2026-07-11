import { createRng } from '../rng';
import { DISHES } from './dishes';
import type { Customer, DinerEvent, Ingredient, ShiftState } from './types';

export const CUSTOMERS_PER_SHIFT = 5;
/** Patience drained per tick unit; ~2 minutes of real time at 1 unit/second. */
export const PATIENCE_DRAIN = 0.008;
/** Serving with at least this much patience left earns the tip. */
export const TIP_THRESHOLD = 0.3;

/**
 * Deterministic shift: customer i's dish is drawn from the dishes at least as
 * tall as customer i-1's — the gentle in-shift ramp (spec 2026-07-10).
 */
export function startShift(seed: number, shieldAvailable: boolean): ShiftState {
  const rng = createRng(seed);
  const customers: Customer[] = [];
  let minHeight = 0;
  for (let i = 0; i < CUSTOMERS_PER_SHIFT; i++) {
    const pool = DISHES.filter((d) => d.stack.length >= minHeight);
    const dish = pool.length > 0 ? rng.pick(pool) : rng.pick(DISHES);
    minHeight = dish.stack.length;
    customers.push({ dish, patience: 1, served: false, mistakes: 0, shieldUsed: false });
  }
  return { seed, customers, current: 0, built: 0, mistakes: 0, shieldAvailable, status: 'serving' };
}

/** Tap an ingredient button. Correct = stack it; wrong = gentle reject (shielded once). */
export function tapIngredient(state: ShiftState, ingredient: Ingredient): { state: ShiftState; events: DinerEvent[] } {
  if (state.status !== 'serving') return { state, events: [] };
  const customer = state.customers[state.current];
  if (customer === undefined) return { state, events: [] };
  const needed = customer.dish.stack[state.built];
  if (needed === ingredient) {
    const built = state.built + 1;
    const events: DinerEvent[] = [{ type: 'placed', ingredient, layer: state.built }];
    if (built === customer.dish.stack.length) events.push({ type: 'ready' });
    return { state: { ...state, built }, events };
  }
  // Wrong tap: the build never resets (never-strand). The pantry shield
  // absorbs exactly the first mistake of the shift.
  if (state.shieldAvailable) {
    const customers = state.customers.slice();
    customers[state.current] = { ...customer, shieldUsed: true };
    return {
      state: { ...state, customers, shieldAvailable: false },
      events: [{ type: 'rejected', ingredient, shielded: true }],
    };
  }
  const customers = state.customers.slice();
  customers[state.current] = { ...customer, mistakes: customer.mistakes + 1 };
  return {
    state: { ...state, customers, mistakes: state.mistakes + 1 },
    events: [{ type: 'rejected', ingredient, shielded: false }],
  };
}

/** Drain the current customer's patience. Zero never fails anything — it only costs the tip. */
export function tickPatience(state: ShiftState, dt: number): ShiftState {
  if (state.status !== 'serving') return state;
  const customer = state.customers[state.current];
  if (customer === undefined) return state;
  const patience = Math.max(0, customer.patience - dt * PATIENCE_DRAIN);
  if (patience === customer.patience) return state;
  const customers = state.customers.slice();
  customers[state.current] = { ...customer, patience };
  return { ...state, customers };
}

/** Serve a completed build: cheer, tip by remaining patience, next customer. */
export function serveReady(state: ShiftState): { state: ShiftState; events: DinerEvent[] } {
  if (state.status !== 'serving') return { state, events: [] };
  const customer = state.customers[state.current];
  if (customer === undefined || state.built < customer.dish.stack.length) return { state, events: [] };
  const customers = state.customers.slice();
  customers[state.current] = { ...customer, served: true };
  const tipped = customer.patience >= TIP_THRESHOLD;
  const events: DinerEvent[] = [{ type: 'served', customer: state.current, tipped }];
  const current = state.current + 1;
  const done = current >= customers.length;
  if (done) {
    const stars: 1 | 2 | 3 = state.mistakes === 0 ? 3 : state.mistakes <= 2 ? 2 : 1;
    events.push({ type: 'shiftEnd', stars, mistakes: state.mistakes });
  }
  return {
    state: { ...state, customers, current, built: 0, status: done ? 'done' : 'serving' },
    events,
  };
}
