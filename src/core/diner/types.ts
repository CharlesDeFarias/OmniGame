/** Diner cooking core (decision #62): pure TS, zero Phaser. */

/** Every stackable thing in the diner, across all dish families. */
export type Ingredient =
  | 'bun-bottom' | 'patty' | 'cheese' | 'lettuce' | 'tomato' | 'bun-top'
  | 'plate' | 'pancake' | 'butter' | 'syrup'
  | 'cup' | 'juice' | 'straw';

export type DishFamily = 'burger' | 'breakfast' | 'drink';

/** A dish is an ordered bottom-to-top ingredient stack. */
export interface Dish {
  id: string;
  family: DishFamily;
  /** Bottom-to-top build order; length is the difficulty. */
  stack: readonly Ingredient[];
}

export interface Customer {
  dish: Dish;
  /** 0..1, drains over time; affects TIP only, never failure. */
  patience: number;
  served: boolean;
  /** Mistakes made while building THIS order. */
  mistakes: number;
  /** Whether the pantry shield absorbed a mistake for this customer. */
  shieldUsed: boolean;
}

export interface ShiftState {
  /** Deterministic: same seed = same customer queue. */
  seed: number;
  customers: Customer[];
  /** Index of the customer at the counter; === customers.length when done. */
  current: number;
  /** Build progress: how many layers of the current order are correctly placed. */
  built: number;
  /** Total mistakes this shift (drives stars). */
  mistakes: number;
  /** One free mistake if the pantry had stock (grocery star-protection). */
  shieldAvailable: boolean;
  status: 'serving' | 'done';
}

export type DinerEvent =
  | { type: 'placed'; ingredient: Ingredient; layer: number }
  | { type: 'rejected'; ingredient: Ingredient; shielded: boolean }
  | { type: 'ready' }
  | { type: 'served'; customer: number; tipped: boolean }
  | { type: 'shiftEnd'; stars: 1 | 2 | 3; mistakes: number };
