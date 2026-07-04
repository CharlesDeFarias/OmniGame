import { advance, coinsForScore, createRng, reachableLanes, resolveCell, startGate } from '../core/gaterunner/index';
import type { GateLevelDef, GateState, Lane, RNG } from '../core/gaterunner/index';

export type LanePolicy = (state: GateState, level: GateLevelDef) => Lane;

/** Picks uniformly among the lanes reachable from the current lane (adjacency rule). */
export function randomLane(rng: RNG): LanePolicy {
  return (state) => rng.pick(reachableLanes(state.lane));
}

/** Argmax over immediate countAfter (single-sourced via resolveCell) across the
 *  REACHABLE lanes only. Sideways wall lanes are skipped: they deflect back and
 *  resolve the current lane anyway, so they duplicate the stay option. A wall in
 *  the current lane is evaluated head-on (25% crash) — greedy dodges it when an
 *  adjacent lane is better. Ties broken by the seeded rng, so runs are
 *  deterministic per seed. */
export function greedyLane(rng: RNG): LanePolicy {
  return (state, level) => {
    const column = level.columns[state.nextColumnIndex];
    if (column === undefined) return state.lane;
    let bestCount = -1;
    let best: Lane[] = [];
    for (const lane of reachableLanes(state.lane)) {
      const cell = column.lanes[lane];
      if (lane !== state.lane && cell.kind === 'wall') continue; // deflects back — same as staying
      const after = resolveCell(state.count, cell).count;
      if (after > bestCount) {
        bestCount = after;
        best = [lane];
      } else if (after === bestCount) {
        best.push(lane);
      }
    }
    return rng.pick(best);
  };
}

export interface GateRunResult {
  won: boolean;
  finalCount: number;
  score: number;
  /** Coins the run would pay out: coinsForScore(score) on a win, 0 on a loss. */
  coins: number;
}

/** Drives a full run headlessly. Column count bounds the loop, so it always terminates. */
export function runGate(level: GateLevelDef, policy: LanePolicy): GateRunResult {
  let state = startGate(level);
  while (!state.done) {
    state = advance(state, level, policy(state, level)).state;
  }
  return {
    won: state.won,
    finalCount: state.count,
    score: state.score,
    coins: state.won ? coinsForScore(state.score) : 0,
  };
}

export interface GateSimStats {
  runs: number;
  winRate: number;
  avgScore: number;
  /** Mean coins per WINNING run (economy probe); 0 if nothing was won. */
  avgCoinsPerWin: number;
}

/** Fixed seed schedule derived from the level seed — fully deterministic. */
export function simulateGate(
  level: GateLevelDef,
  runs: number,
  makePolicy: (rng: RNG) => LanePolicy,
): GateSimStats {
  let wins = 0;
  let totalScore = 0;
  let totalWinCoins = 0;
  for (let i = 0; i < runs; i++) {
    const r = runGate(level, makePolicy(createRng(level.seed + i * 7919)));
    if (r.won) {
      wins++;
      totalWinCoins += r.coins;
    }
    totalScore += r.score;
  }
  return {
    runs,
    winRate: wins / runs,
    avgScore: totalScore / runs,
    avgCoinsPerWin: wins === 0 ? 0 : totalWinCoins / wins,
  };
}
