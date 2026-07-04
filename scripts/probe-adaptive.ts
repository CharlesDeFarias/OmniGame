import { readFileSync } from 'node:fs';
import { createRng, parseLevel } from '../src/core/match3/index';
import type { LevelDef } from '../src/core/match3/index';
import { greedyPolicy } from '../src/sim/policies';
import { playLevel } from '../src/sim/run';
import { applyTierTo, describeTier } from '../src/services/adaptive';

/** Adaptive-v2 verification probe: greedy win rates at tiers 0/+1/+2 on representative
 *  collect-only levels (injection only fires on all-collect goals; only kitchen has them).
 *  Mirrors simulateLevel's variant scheme (seed + i*7919, policy rng seedBase 1 + i) but
 *  applies applyTierTo INSIDE the variant loop so injection stays per-seed deterministic.
 *  Floor: win rate must stay >= 0.40 at +2; decreases should be monotonic-ish with tier. */

const RUNS = Number(process.argv[2] ?? 300);
const FLOOR = 0.4;
const FILES = ['levels/kitchen/002.json', 'levels/kitchen/005.json', 'levels/kitchen/012.json'];

function probe(level: LevelDef, tier: number): { win: number; avgMoves: number; gift: number } {
  let wins = 0;
  let movesSum = 0;
  let gifts = 0;
  for (let i = 0; i < RUNS; i++) {
    const variant: LevelDef = { ...level, seed: level.seed + i * 7919 };
    const tiered = applyTierTo(variant, tier);
    const res = playLevel(tiered, greedyPolicy(createRng(1 + i)));
    if (res.won) wins++;
    movesSum += res.movesUsed;
    if (res.giftUsed) gifts++;
  }
  return { win: wins / RUNS, avgMoves: movesSum / RUNS, gift: gifts / RUNS };
}

let ok = true;
for (const file of FILES) {
  const level = parseLevel(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  let prev = Infinity;
  for (const tier of [0, 1, 2]) {
    const d = describeTier(tier);
    const s = probe(level, tier);
    const floorFail = tier === 2 && s.win < FLOOR;
    const monoNote = s.win > prev + 0.03 ? ' [non-monotonic]' : '';
    if (floorFail) ok = false;
    console.log(
      `${level.id} tier=+${tier} (moves${d.movesDelta >= 0 ? '+' : ''}${d.movesDelta}, ` +
      `ice+${d.ice}, box+${d.boxes}) runs=${RUNS} win=${(s.win * 100).toFixed(1)}% ` +
      `avgMoves=${s.avgMoves.toFixed(1)} gift=${(s.gift * 100).toFixed(1)}%` +
      `${floorFail ? ' [BELOW 0.40 FLOOR]' : ''}${monoNote}`,
    );
    prev = s.win;
  }
  console.log('');
}
if (!ok) {
  console.error('FAIL: a level dipped below the 0.40 win-rate floor at tier +2');
  process.exit(1);
}
console.log('OK: all probed levels hold win >= 0.40 at tier +2');
