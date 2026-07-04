/** Tower-conquest core types (game #5 seed). Pure data — zero Phaser. */

export type Owner = 'player' | 'enemy' | 'neutral';

/** Armies only ever belong to a side that can send: player or enemy. */
export type ArmyOwner = 'player' | 'enemy';

export type EnemyPolicy = 'passive' | 'defensive' | 'aggressive';

export interface TowerDef {
  id: string;
  owner: Owner;
  troops: number;
  /** Owned towers grow by this each tick (capped at maxTroops); neutral towers never grow. */
  growthPerTick: number;
  maxTroops: number;
  /** Layout hints for the future renderer, 0-100 in both axes. */
  x: number;
  y: number;
}

export interface TowerLevelDef {
  id: string;
  seed: number;
  towers: TowerDef[];
  /** Symmetric adjacency: sends are only legal along an edge. Stored once per pair. */
  edges: Array<[string, string]>;
  enemyPolicy: EnemyPolicy;
  /** Timeout tick. Generous ending: at maxTicks the player LOSES only if the enemy owns MORE towers. */
  maxTicks: number;
}

/** Mutable per-tower state; static properties (growth, cap, position) stay on the level def. */
export interface TowerSnapshot {
  id: string;
  owner: Owner;
  troops: number;
}

export interface Army {
  owner: ArmyOwner;
  from: string;
  to: string;
  troops: number;
  /** Fixed travel of 2 ticks; the army arrives on the tick this reaches 0. */
  ticksRemaining: number;
}

export interface TowerState {
  levelId: string;
  towers: TowerSnapshot[];
  armies: Army[];
  tick: number;
  /** Serialized AI rng (tie-breaks only), threaded through tick() so state stays pure data. */
  rngState: number;
  done: boolean;
  won: boolean;
}

/** Renderer-facing events. `sent` fires for player orders and AI sends alike;
 *  `arrived.result` is from the ARRIVING army's perspective:
 *  reinforced = merged into a friendly tower, captured = flipped the tower,
 *  defended = absorbed by the defenders, neutralized = exact tie (tower goes neutral at 0). */
export type TowerEvent =
  | { type: 'sent'; from: string; to: string; owner: ArmyOwner; troops: number }
  | { type: 'arrived'; to: string; owner: ArmyOwner; result: 'reinforced' | 'captured' | 'defended' | 'neutralized' }
  | { type: 'gameOver'; won: boolean };
