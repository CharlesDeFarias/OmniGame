import { applyMove, findValidMoves, startLevel } from '../core/match3/index';
import type { LevelDef } from '../core/match3/index';
import type { Policy } from './policies';

export interface PlayResult {
  won: boolean;
  movesUsed: number;
  giftUsed: boolean;
  shuffles: number;
}

/** Drives a full level headlessly. Precondition honored by the engine: a 'playing' state
 *  always has at least one valid move (deadlocks auto-shuffle), so `moves` is never empty. */
export function playLevel(level: LevelDef, policy: Policy, maxSteps = 500): PlayResult {
  let state = startLevel(level);
  let movesUsed = 0;
  let shuffles = 0;
  for (let step = 0; step < maxSteps && state.status === 'playing'; step++) {
    const moves = findValidMoves(state.board);
    const mv = policy(state, moves);
    const out = applyMove(state, mv.a, mv.b);
    if (out.invalid) throw new Error(`policy returned invalid move at step ${step}`);
    state = out.state;
    movesUsed++;
    if (out.events.some((e) => e.type === 'shuffle')) shuffles++;
  }
  return { won: state.status === 'won', movesUsed, giftUsed: state.giftUsed, shuffles };
}
