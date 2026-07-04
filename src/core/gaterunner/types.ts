/** Gate-runner core types (game #3 seed). Pure data — zero Phaser. */

/** Three horizontal lanes; the player commits one before each column resolves. */
export type Lane = 0 | 1 | 2;

export type GateOp = 'add' | 'mul';

export type Cell =
  | { kind: 'gate'; op: GateOp; value: number }
  | { kind: 'foe'; count: number }
  | { kind: 'wall' }
  | { kind: 'empty' };

export interface Column {
  /** Distance along the run in integer ticks; strictly increasing across a level. */
  d: number;
  lanes: [Cell, Cell, Cell];
}

export interface GateLevelDef {
  id: string;
  seed: number;
  startCount: number;
  columns: Column[];
  finishBonusPerSquad: number;
}

export interface GateState {
  levelId: string;
  lane: Lane;
  count: number;
  nextColumnIndex: number;
  done: boolean;
  won: boolean;
  score: number;
}

/** Renderer-facing events, one advance at a time. `empty` cells emit nothing. */
export type GateEvent =
  | { type: 'gate'; op: GateOp; value: number; countAfter: number }
  | { type: 'foe'; lost: number; countAfter: number }
  | { type: 'wall'; lost: number; countAfter: number }
  | { type: 'finish'; count: number; score: number };
