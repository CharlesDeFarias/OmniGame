import { createRng } from '../core/match3/index';
import type { LevelDef, RNG } from '../core/match3/index';
import type { Policy } from './policies';
import { playLevel } from './run';

export interface SimStats {
  runs: number;
  winRate: number;
  avgMovesUsed: number;
  giftRate: number;
  shuffleRate: number;
}

/** Runs the level across `runs` board variants (seed offset per run) with an independently
 *  seeded policy per run. Measures the level CONFIG, not one particular board. */
export function simulateLevel(
  level: LevelDef,
  runs: number,
  policyFor: (rng: RNG) => Policy,
  seedBase = 1,
): SimStats {
  let wins = 0;
  let movesSum = 0;
  let gifts = 0;
  let shuffled = 0;
  for (let i = 0; i < runs; i++) {
    const variant: LevelDef = { ...level, seed: level.seed + i * 7919 };
    const res = playLevel(variant, policyFor(createRng(seedBase + i)));
    if (res.won) wins++;
    movesSum += res.movesUsed;
    if (res.giftUsed) gifts++;
    if (res.shuffles > 0) shuffled++;
  }
  return {
    runs,
    winRate: wins / runs,
    avgMovesUsed: movesSum / runs,
    giftRate: gifts / runs,
    shuffleRate: shuffled / runs,
  };
}
