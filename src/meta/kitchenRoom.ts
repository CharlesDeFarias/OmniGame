/** Back-compat shim: kitchen catalog moved to rooms.ts in plan 6.5. Prefer importing from './rooms'. */

export { KITCHEN_SLOTS } from './rooms';
export type { FurnitureChoice, RoomSlot } from './rooms';
