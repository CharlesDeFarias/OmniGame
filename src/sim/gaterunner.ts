import { advance, createRng, resolveCell, startGate } from '../core/gaterunner/index';
import type { GateLevelDef, GateState, Lane, RNG } from '../core/gaterunner/index';

export type LanePolicy = (state: GateState, level: GateLevelDef) => Lane;

const LANES: readonly Lane[] = [0, 1, 2];

export function randomLane(rng: RNG): LanePolicy {
  return () => rng.pick(LANES);
}

/** Argmax over immediate countAfter (single-sourced via resolveCell);
 *  ties broken by the seeded rng, so runs are deterministic per seed. */
export function greedyLane(rng: RNG): LanePolicy {
  return (state, level) => {
    const column = level.columns[state.nextColumnIndex];
    if (column === undefined) return state.lane;
    let bestCount = -1;
    let best: Lane[] = [];
    for (const lane of LANES) {
      const after = resolveCell(state.count, column.lanes[lane]).count;
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
}

/** Drives a full run headlessly. Column count bounds the loop, so it always terminates. */
export function runGate(level: GateLevelDef, policy: LanePolicy): GateRunResult {
  let state = startGate(level);
  while (!state.done) {
    state = advance(state, level, policy(state, level)).state;
  }
  return { won: state.won, finalCount: state.count, score: state.score };
}

export interface GateSimStats {
  runs: number;
  winRate: number;
  avgScore: number;
}

/** Fixed seed schedule derived from the level seed — fully deterministic. */
export function simulateGate(
  level: GateLevelDef,
  runs: number,
  makePolicy: (rng: RNG) => LanePolicy,
): GateSimStats {
  let wins = 0;
  let totalScore = 0;
  for (let i = 0; i < runs; i++) {
    const r = runGate(level, makePolicy(createRng(level.seed + i * 7919)));
    if (r.won) wins++;
    totalScore += r.score;
  }
  return { runs, winRate: wins / runs, avgScore: totalScore / runs };
}
