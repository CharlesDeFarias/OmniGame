import { WARDROBE } from '../meta/wardrobe';
import type { JournalStorage } from './journal';
import type { Wallet } from './wallet';

export interface WardrobeState {
  version: 1;
  owned: string[];
  equipped: string | null;
}

export interface Wardrobe {
  state(): WardrobeState;
  /** Spends the outfit's price via the wallet; refuses unknown ids and double-buys. */
  buy(id: string, wallet: Wallet): boolean;
  /** Equips an owned outfit only. */
  equip(id: string): boolean;
  /** Equipped outfit's avatar tint, or null when wearing a base outfit. */
  equippedColor(): number | null;
}

const KEY = 'omnigame.wardrobe.v1';

function defaults(): WardrobeState {
  return { version: 1, owned: [], equipped: null };
}

function load(storage: JournalStorage): WardrobeState {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const s = JSON.parse(raw) as Partial<WardrobeState> | null;
    if (
      s === null ||
      typeof s !== 'object' ||
      s.version !== 1 ||
      !Array.isArray(s.owned) ||
      !s.owned.every((x) => typeof x === 'string') ||
      (s.equipped !== null && typeof s.equipped !== 'string')
    ) {
      return defaults();
    }
    return { version: 1, owned: [...s.owned], equipped: s.equipped ?? null };
  } catch {
    return defaults();
  }
}

export function createWardrobe(storage: JournalStorage): Wardrobe {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  return {
    state: () => ({ version: 1, owned: [...state.owned], equipped: state.equipped }),
    buy(id, wallet) {
      const item = WARDROBE.find((o) => o.id === id);
      if (!item) return false;
      if (state.owned.includes(id)) return false;
      if (!wallet.spend(item.price)) return false;
      state.owned.push(id);
      save();
      return true;
    },
    equip(id) {
      if (!state.owned.includes(id)) return false;
      state.equipped = id;
      save();
      return true;
    },
    equippedColor() {
      if (state.equipped === null) return null;
      return WARDROBE.find((o) => o.id === state.equipped)?.outfitColor ?? null;
    },
  };
}
