import { CHAPTERS, type ChapterId } from '../meta/chapters';
import { ROOMS } from '../meta/rooms';
import type { JournalStorage } from './journal';
import type { Wallet } from './wallet';

export interface FurnishState {
  version: 2;
  rooms: Record<ChapterId, Record<string, string>>;
  videos: Record<string, true>;
}

export interface Furnishing {
  state(): FurnishState;
  furnish(chapter: ChapterId, slotId: string, styleId: string, wallet: Wallet): boolean;
  isRoomComplete(chapter: ChapterId): boolean;
  nextAffordableSlot(chapter: ChapterId, coins: number): string | null;
  markVideoFilmed(room: string): void;
  hasFilmedVideo(room: string): boolean;
}

/** Storage key is historical (predates v2); the version field inside governs the shape. */
const KEY = 'omnigame.furnish.v1';

const CHAPTER_IDS = CHAPTERS.map((c) => c.id);

function emptyRooms(): Record<ChapterId, Record<string, string>> {
  return { kitchen: {}, dance: {}, gym: {}, vanity: {} };
}

function defaults(): FurnishState {
  return { version: 2, rooms: emptyRooms(), videos: {} };
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === 'string');
}

function readVideos(v: unknown): Record<string, true> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).map((k) => [k, true as const]))
    : {};
}

function load(storage: JournalStorage): FurnishState {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const s = JSON.parse(raw) as Partial<FurnishState> | null;
    if (s === null || typeof s !== 'object' || typeof s.rooms !== 'object' || s.rooms === null) {
      return defaults();
    }
    // v1 migration: kitchen-only rooms record spreads into the all-chapters shape.
    if ((s.version as number) === 1) {
      if (!isStringRecord(s.rooms.kitchen)) return defaults();
      return {
        version: 2,
        rooms: { ...emptyRooms(), kitchen: { ...s.rooms.kitchen } },
        videos: readVideos(s.videos),
      };
    }
    if (s.version !== 2) return defaults();
    const rooms = emptyRooms();
    for (const id of CHAPTER_IDS) {
      const room = (s.rooms as Record<string, unknown>)[id] ?? {};
      if (!isStringRecord(room)) return defaults();
      rooms[id] = { ...room };
    }
    return { version: 2, rooms, videos: readVideos(s.videos) };
  } catch {
    return defaults();
  }
}

export function createFurnishing(storage: JournalStorage): Furnishing {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  return {
    state: () => ({
      version: 2,
      rooms: Object.fromEntries(
        CHAPTER_IDS.map((id) => [id, { ...state.rooms[id] }]),
      ) as Record<ChapterId, Record<string, string>>,
      videos: { ...state.videos },
    }),
    furnish(chapter, slotId, styleId, wallet) {
      const slot = ROOMS[chapter].find((s) => s.id === slotId);
      if (!slot) return false;
      const choice = slot.choices.find((c) => c.styleId === styleId);
      if (!choice) return false;
      if (state.rooms[chapter][slotId] !== undefined) return false;
      if (!wallet.spend(choice.price)) return false;
      state.rooms[chapter][slotId] = styleId;
      save();
      return true;
    },
    isRoomComplete(chapter) {
      return ROOMS[chapter].every((s) => state.rooms[chapter][s.id] !== undefined);
    },
    nextAffordableSlot(chapter, coins) {
      const slot = ROOMS[chapter].find(
        (s) => state.rooms[chapter][s.id] === undefined && (s.choices[0]?.price ?? Infinity) <= coins,
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
