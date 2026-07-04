import { RECIPES } from '../core/cooking/recipes';
import type { JournalStorage } from './journal';
import type { Wallet } from './wallet';

export interface CookingData {
  version: 1;
  /** Best star count per recipe id (1-3); absent = never completed. */
  best: Record<string, number>;
  /** How many recipes are unlocked, counting from index 0. Starts at 1. */
  unlocked: number;
}

export interface CookingProgress {
  data(): CookingData;
  isUnlocked(index: number): boolean;
  bestFor(recipeId: string): number;
  /** Serving mode (decision #53): unlocked once 5 distinct recipes have a best entry. */
  servingUnlocked(): boolean;
  /** Records a finished recipe: bumps best (max), unlocks the next recipe when the frontier one is beaten, pays the wallet. */
  recordCompletion(
    recipeId: string,
    recipeIndex: number,
    stars: 1 | 2 | 3,
    wallet: Wallet,
  ): { newBest: boolean; unlockedNext: boolean };
}

const KEY = 'omnigame.cooking.v1';
const RECIPE_COUNT = RECIPES.length;
/** Serving mode opens once this many distinct recipes have been completed. */
const SERVING_UNLOCK_AT = 5;

function defaults(): CookingData {
  return { version: 1, best: {}, unlocked: 1 };
}

function isStarCount(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 3;
}

function load(storage: JournalStorage): CookingData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return defaults();
    const d = p as Partial<CookingData>;
    if (d.version !== 1) return defaults();
    const unlocked = d.unlocked;
    if (!Number.isInteger(unlocked) || (unlocked as number) < 1 || (unlocked as number) > RECIPE_COUNT) {
      return defaults();
    }
    const best = d.best;
    if (typeof best !== 'object' || best === null || Array.isArray(best)) return defaults();
    for (const v of Object.values(best)) {
      if (!isStarCount(v)) return defaults();
    }
    return { version: 1, best: { ...best }, unlocked: unlocked as number };
  } catch {
    return defaults();
  }
}

export function createCooking(storage: JournalStorage): CookingProgress {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  return {
    data: () => ({ version: 1, best: { ...state.best }, unlocked: state.unlocked }),
    isUnlocked: (index) => index >= 0 && index < state.unlocked,
    bestFor: (recipeId) => state.best[recipeId] ?? 0,
    servingUnlocked: () => Object.keys(state.best).length >= SERVING_UNLOCK_AT,
    recordCompletion(recipeId, recipeIndex, stars, wallet) {
      const prev = state.best[recipeId] ?? 0;
      const newBest = stars > prev;
      if (newBest) state.best[recipeId] = stars;
      let unlockedNext = false;
      if (recipeIndex === state.unlocked - 1 && state.unlocked < RECIPE_COUNT) {
        state.unlocked += 1;
        unlockedNext = true;
      }
      save();
      wallet.earnCooking(stars);
      return { newBest, unlockedNext };
    },
  };
}
