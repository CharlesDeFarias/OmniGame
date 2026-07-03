/**
 * Furnishable-room catalogs for all four chapters (plan 6.5 generalization of kitchenRoom.ts).
 *
 * PRICES — economy probe output (scripts/probe-economy.ts, 2026-07-03), 2-star pace = 40 coins/win:
 *
 *   === Option A: flat 40/win ===
 *   dance  total=360 completeLvl=9  leftover=40  (10%)   FAIL (leftover < 15%)
 *   gym    total=420 completeLvl=11 leftover=-20 (-5%)   FAIL (not completable in 10 levels)
 *   vanity total=460 completeLvl=12 leftover=-60 (-15%)  FAIL
 *   === Option B: 40 + chapterIndex*5 per win ===   <-- CHOSEN
 *   dance  perWin=45 total=360 completeLvl=8 leftover=90 (20%)   OK
 *   gym    perWin=50 total=420 completeLvl=9 leftover=80 (16%)   OK
 *   vanity perWin=55 total=460 completeLvl=9 leftover=90 (16.4%) OK
 *
 * Flat 40/win would force every new room to total 300-340 (no price progression across
 * chapters), so the per-chapter coin bonus (+5 coins/win per chapter index) is adopted:
 * rooms get pricier as the career grows, targets hold (complete ~level 8-9 of the chapter,
 * 15-25% of chapter income left over for the wardrobe sink). Kitchen keeps its calibrated
 * plan-6 numbers (440 total over 20 levels, affordable ~level 11) unchanged.
 */

import type { ChapterId } from './chapters';

export interface FurnitureChoice {
  styleId: string;
  price: number;
}

export interface RoomSlot {
  id: string;
  textureBase: string;
  choices: FurnitureChoice[];
}

/** Wallet coin bonus per win: +CHAPTER_COIN_BONUS_PER_INDEX * chapterIndex (probe option B). */
export const CHAPTER_COIN_BONUS_PER_INDEX = 5;

const STYLE_IDS = ['a', 'b', 'c'];

function slot(id: string, price: number, textureBase = `furn-${id}`): RoomSlot {
  return {
    id,
    textureBase,
    choices: STYLE_IDS.map((styleId) => ({ styleId, price })),
  };
}

/** New rooms scope textures by chapter so shared slot names (dance/gym 'mat') get distinct art. */
function chapterSlot(chapter: ChapterId, id: string, price: number): RoomSlot {
  return slot(id, price, `furn-${chapter}-${id}`);
}

/** Kitchen: plan-6 shipped numbers, untouched. 6 slots x 3 styles; 40/40/70/70/110/110. */
export const KITCHEN_SLOTS: RoomSlot[] = [
  slot('counter', 40),
  slot('fridge', 40),
  slot('table', 70),
  slot('lamp', 70),
  slot('plant', 110),
  slot('art', 110),
];

export const ROOMS: Record<ChapterId, RoomSlot[]> = {
  kitchen: KITCHEN_SLOTS,
  // Dance studio: total 360 (complete lvl 8 at 45/win, 20% leftover).
  dance: [
    chapterSlot('dance', 'mirror', 40),
    chapterSlot('dance', 'barre', 40),
    chapterSlot('dance', 'speaker', 60),
    chapterSlot('dance', 'discoball', 60),
    chapterSlot('dance', 'mat', 80),
    chapterSlot('dance', 'poster', 80),
  ],
  // Gym: total 420 (complete lvl 9 at 50/win, 16% leftover).
  gym: [
    chapterSlot('gym', 'treadmill', 45),
    chapterSlot('gym', 'weights', 45),
    chapterSlot('gym', 'bench', 70),
    chapterSlot('gym', 'fan', 70),
    chapterSlot('gym', 'mat', 95),
    chapterSlot('gym', 'chart', 95),
  ],
  // Vanity/makeup room: total 460 (complete lvl 9 at 55/win, 16.4% leftover).
  vanity: [
    chapterSlot('vanity', 'mirror-lights', 50),
    chapterSlot('vanity', 'chair', 50),
    chapterSlot('vanity', 'desk', 75),
    chapterSlot('vanity', 'rack', 75),
    chapterSlot('vanity', 'ringlight', 105),
    chapterSlot('vanity', 'shelf', 105),
  ],
};
