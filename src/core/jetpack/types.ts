/** Jetpack runner core (decision #62): pure TS, zero Phaser. World units:
 *  y in [0,1] (0 = ceiling, 1 = floor), distance in meters. */

export interface JetLevelDef {
  id: string;
  seed: number;
  /** Run length in meters; the finish flag stands here. */
  length: number;
}

/** A zap bar the player must fly around: a vertical span at a distance. */
export interface Obstacle {
  d: number;
  /** Blocked band [top, bottom] in y units; the gap is everything else. */
  top: number;
  bottom: number;
}

export interface Coin {
  d: number;
  y: number;
  taken: boolean;
}

export interface JetState {
  level: JetLevelDef;
  obstacles: Obstacle[];
  coins: Coin[];
  /** Player vertical position [0,1] and velocity (y units/second). */
  y: number;
  vy: number;
  /** Distance flown so far (meters). */
  dist: number;
  collected: number;
  hearts: number;
  /** Seconds of blink-invincibility left after a hit. */
  invincibleFor: number;
  status: 'flying' | 'finished' | 'expired';
}

export type JetEvent =
  | { type: 'coin'; index: number }
  | { type: 'hit'; obstacle: number; heartsLeft: number }
  | { type: 'finish'; coins: number; hearts: number }
  /** Hearts ran out: the run ends here with progress kept (never-strand). */
  | { type: 'expired'; coins: number; dist: number };
