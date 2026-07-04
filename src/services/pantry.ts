import type { IngredientId, Recipe } from '../core/cooking/types';
import type { JournalStorage } from './journal';
import type { Wallet } from './wallet';

export interface PantryData {
  version: 1;
  /** Units in stock per ingredient; absent = 0. */
  stock: Partial<Record<IngredientId, number>>;
}

export interface Pantry {
  stockOf(id: IngredientId): number;
  /** Adds one unit per listed item (repeats stack). */
  addStock(items: IngredientId[]): void;
  /**
   * Star protection (decision #52): if EVERY gather-step ingredient of the recipe
   * has stock >= 1, decrement each by 1 and return true. Otherwise false with NO
   * changes — all-or-nothing, so a half-stocked pantry is never silently drained.
   */
  consumeFor(recipe: Recipe): boolean;
  /** Spends GROCERY_PRICE coins for one unit of the item; false (no stock) when broke. */
  buyItem(id: IngredientId, wallet: Wallet): boolean;
}

/** Coins per grocery item — cheap enough that one match-3 win stocks a recipe or two. */
export const GROCERY_PRICE = 6;

const KEY = 'omnigame.pantry.v1';
const LIST_CAP = 8;

function defaults(): PantryData {
  return { version: 1, stock: {} };
}

function load(storage: JournalStorage): PantryData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return defaults();
    const d = p as Partial<PantryData>;
    if (d.version !== 1) return defaults();
    const stock = d.stock;
    if (typeof stock !== 'object' || stock === null || Array.isArray(stock)) return defaults();
    for (const v of Object.values(stock)) {
      if (!Number.isInteger(v) || (v as number) < 0) return defaults();
    }
    return { version: 1, stock: { ...stock } };
  } catch {
    return defaults();
  }
}

/** Unique gather-step ingredients of a recipe, in first-appearance order. */
function gatherSetOf(recipe: Recipe): IngredientId[] {
  const seen = new Set<IngredientId>();
  for (const step of recipe.steps) {
    if (step.type !== 'gather') continue;
    for (const id of step.ingredients) seen.add(id);
  }
  return [...seen];
}

export function createPantry(storage: JournalStorage): Pantry {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  const stockOf = (id: IngredientId): number => state.stock[id] ?? 0;
  return {
    stockOf,
    addStock(items) {
      for (const id of items) state.stock[id] = stockOf(id) + 1;
      save();
    },
    consumeFor(recipe) {
      const needed = gatherSetOf(recipe);
      if (needed.length === 0) return false;
      if (!needed.every((id) => stockOf(id) >= 1)) return false;
      for (const id of needed) state.stock[id] = stockOf(id) - 1;
      save();
      return true;
    },
    buyItem(id, wallet) {
      if (!wallet.spend(GROCERY_PRICE)) return false;
      state.stock[id] = stockOf(id) + 1;
      save();
      return true;
    },
  };
}

/** The picture shopping list: unique gather ingredients across the given recipes with stock 0, sorted, capped at 8. */
export function groceryListFor(recipes: readonly Recipe[], pantry: Pantry): IngredientId[] {
  const wanted = new Set<IngredientId>();
  for (const recipe of recipes) for (const id of gatherSetOf(recipe)) wanted.add(id);
  return [...wanted]
    .filter((id) => pantry.stockOf(id) === 0)
    .sort()
    .slice(0, LIST_CAP);
}
