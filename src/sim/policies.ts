import { createRng, resolveTurn } from '../core/match3/index';
import type { GameState, Move, RNG } from '../core/match3/index';

export type Policy = (state: GameState, moves: Move[]) => Move;

export function randomPolicy(rng: RNG): Policy {
  return (_state, moves) => rng.pick(moves);
}

/** Argmax over immediate goal progress: trial-resolves each move on the (never-mutated) board
 *  with a transplanted RNG copy, so the trial predicts exactly what applyMove would do. */
export function greedyPolicy(rng: RNG): Policy {
  return (state, moves) => {
    let bestScore = -1;
    let best: Move[] = [];
    for (const m of moves) {
      const trialRng = createRng(0);
      trialRng.setState(state.rng.getState());
      const r = resolveTurn(state.board, m.a, m.b, trialRng, state.level.board.colorCount);
      let score = 0;
      for (const g of state.goals) {
        const need = g.goal.count - g.collected;
        if (need > 0) score += Math.min(need, r.clearedByColor[g.goal.color] ?? 0);
      }
      if (score > bestScore) {
        bestScore = score;
        best = [m];
      } else if (score === bestScore) {
        best.push(m);
      }
    }
    return rng.pick(best);
  };
}
