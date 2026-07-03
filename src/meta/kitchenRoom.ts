/** Kitchen room furnishing catalog (plan 6 fixed numbers; retune in 6.5). */

export interface FurnitureChoice {
  styleId: string;
  price: number;
}

export interface RoomSlot {
  id: string;
  textureBase: string;
  choices: FurnitureChoice[];
}

const STYLE_IDS = ['a', 'b', 'c'];

function slot(id: string, price: number): RoomSlot {
  return {
    id,
    textureBase: `furn-${id}`,
    choices: STYLE_IDS.map((styleId) => ({ styleId, price })),
  };
}

/** 6 slots x 3 aesthetic styles; prices equal within a slot: 40 for slots 1-2, 70 for 3-4, 110 for 5-6. */
export const KITCHEN_SLOTS: RoomSlot[] = [
  slot('counter', 40),
  slot('fridge', 40),
  slot('table', 70),
  slot('lamp', 70),
  slot('plant', 110),
  slot('art', 110),
];
