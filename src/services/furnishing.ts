import { KITCHEN_SLOTS } from '../meta/kitchenRoom';
import type { JournalStorage } from './journal';
import type { Wallet } from './wallet';

export interface FurnishState {
  version: 1;
  rooms: { kitchen: Record<string, string> };
  videos: Record<string, true>;
}

export interface Furnishing {
  state(): FurnishState;
  furnish(slotId: string, styleId: string, wallet: Wallet): boolean;
  isRoomComplete(room: 'kitchen'): boolean;
  nextAffordableSlot(coins: number): string | null;
  markVideoFilmed(room: string): void;
  hasFilmedVideo(room: string): boolean;
}

const KEY = 'omnigame.furnish.v1';

function defaults(): FurnishState {
  return { version: 1, rooms: { kitchen: {} }, videos: {} };
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === 'string');
}

function load(storage: JournalStorage): FurnishState {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const s = JSON.parse(raw) as Partial<FurnishState> | null;
    if (
      s === null ||
      typeof s !== 'object' ||
      s.version !== 1 ||
      typeof s.rooms !== 'object' ||
      s.rooms === null ||
      !isStringRecord(s.rooms.kitchen)
    ) {
      return defaults();
    }
    const videos =
      typeof s.videos === 'object' && s.videos !== null && !Array.isArray(s.videos)
        ? Object.fromEntries(Object.keys(s.videos).map((k) => [k, true as const]))
        : {};
    return { version: 1, rooms: { kitchen: { ...s.rooms.kitchen } }, videos };
  } catch {
    return defaults();
  }
}

export function createFurnishing(storage: JournalStorage): Furnishing {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  return {
    state: () => ({
      version: 1,
      rooms: { kitchen: { ...state.rooms.kitchen } },
      videos: { ...state.videos },
    }),
    furnish(slotId, styleId, wallet) {
      const slot = KITCHEN_SLOTS.find((s) => s.id === slotId);
      if (!slot) return false;
      const choice = slot.choices.find((c) => c.styleId === styleId);
      if (!choice) return false;
      if (state.rooms.kitchen[slotId] !== undefined) return false;
      if (!wallet.spend(choice.price)) return false;
      state.rooms.kitchen[slotId] = styleId;
      save();
      return true;
    },
    isRoomComplete(room) {
      return KITCHEN_SLOTS.every((s) => state.rooms[room][s.id] !== undefined);
    },
    nextAffordableSlot(coins) {
      const slot = KITCHEN_SLOTS.find(
        (s) => state.rooms.kitchen[s.id] === undefined && (s.choices[0]?.price ?? Infinity) <= coins,
      );
      return slot ? slot.id : null;
    },
    markVideoFilmed(room) {
      state.videos[room] = true;
      save();
    },
    hasFilmedVideo(room) {
      return state.videos[room] === true;
    },
  };
}
