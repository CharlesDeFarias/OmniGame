/**
 * Serving mode core (decision #53): three customers order dishes from the
 * unlocked recipe list; each order asks for that recipe's full gather set
 * (gather-only simplification — the customer wants the ingredients assembled).
 * Pure TypeScript, deterministic via the shared seeded RNG, no timers, and
 * relaxed like the cooking engine: wrong taps only cost stars, never fail.
 */
import { createRng } from '../rng';
import { RECIPES } from './recipes';
import type { IngredientId, Recipe } from './types';

export const ORDER_COUNT = 3;

export interface ServingRound {
  /** 3 recipe ids, deterministic pick from the provided unlocked list, favoring variety. */
  orders: string[];
}

export interface ServingState extends ServingRound {
  orderIndex: number;
  /** Ingredients still needed for the current order — order-free within the order. */
  needed: IngredientId[];
  mistakes: number;
  done: boolean;
}

export type ServeEvent =
  | { type: 'served'; id: IngredientId }
  | { type: 'wrong' }
  | { type: 'orderDone'; orderIndex: number }
  | { type: 'servingDone'; stars: 1 | 2 | 3; mistakes: number };

export interface ServeResult {
  state: ServingState;
  correct: boolean;
  events: ServeEvent[];
}

/** Forgiving thresholds across the whole 3-order round. */
export function starsForServing(mistakes: number): 1 | 2 | 3 {
  if (mistakes <= 2) return 3;
  if (mistakes <= 5) return 2;
  return 1;
}

function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** Unique gather-step ingredients of a recipe (same union rule as the pantry). */
function gatherSetOf(recipe: Recipe): IngredientId[] {
  const seen = new Set<IngredientId>();
  for (const step of recipe.steps) {
    if (step.type !== 'gather') continue;
    for (const id of step.ingredients) seen.add(id);
  }
  return [...seen];
}

/**
 * Deterministic order pick: seeded Fisher-Yates over the unlocked list, first 3.
 * Favoring variety means no repeats while 3+ recipes exist; shorter lists cycle
 * (a 1-recipe list serves that dish three times rather than refusing to play).
 */
export function pickOrders(unlockedIds: readonly string[], seed: number): string[] {
  const pool = unlockedIds.filter((id) => recipeById(id) !== undefined);
  if (pool.length === 0) return [];
  const rng = createRng(seed);
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return Array.from({ length: ORDER_COUNT }, (_, i) => bag[i % bag.length]!);
}

function neededFor(orderId: string | undefined): IngredientId[] {
  if (orderId === undefined) return [];
  const recipe = recipeById(orderId);
  return recipe === undefined ? [] : gatherSetOf(recipe);
}

export function startServing(unlockedIds: readonly string[], seed: number): ServingState {
  const orders = pickOrders(unlockedIds, seed);
  return {
    orders,
    orderIndex: 0,
    needed: neededFor(orders[0]),
    mistakes: 0,
    done: orders.length === 0,
  };
}

function clone(state: ServingState): ServingState {
  return { ...state, orders: [...state.orders], needed: [...state.needed] };
}

/** Pure transition: never mutates the input state; wrong serves only count mistakes. */
export function applyServe(state: ServingState, input: IngredientId): ServeResult {
  if (state.done) {
    // Inert after the round (mirrors the cooking engine): incorrect, no mistake charged.
    return { state: clone(state), correct: false, events: [] };
  }
  const next = clone(state);
  if (!next.needed.includes(input)) {
    next.mistakes += 1;
    return { state: next, correct: false, events: [{ type: 'wrong' }] };
  }
  next.needed = next.needed.filter((id) => id !== input);
  const events: ServeEvent[] = [{ type: 'served', id: input }];
  if (next.needed.length === 0) {
    events.push({ type: 'orderDone', orderIndex: next.orderIndex });
    next.orderIndex += 1;
    if (next.orderIndex >= next.orders.length) {
      next.done = true;
      events.push({ type: 'servingDone', stars: starsForServing(next.mistakes), mistakes: next.mistakes });
    } else {
      next.needed = neededFor(next.orders[next.orderIndex]);
    }
  }
  return { state: next, correct: true, events };
}
