import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/core/match3/index';
import { greedyPolicy, randomPolicy } from '../src/sim/policies';
import { simulateLevel } from '../src/sim/simulate';

const file = process.argv[2];
const runs = Number(process.argv[3] ?? 200);
if (!file || !Number.isInteger(runs) || runs < 1) {
  console.error('usage: npm run simulate -- <level.json> [runs]');
  process.exit(1);
}
const level = parseLevel(JSON.parse(readFileSync(file, 'utf8')) as unknown);
const policies = [
  ['greedy', greedyPolicy],
  ['random', randomPolicy],
] as const;
for (const [name, factory] of policies) {
  const s = simulateLevel(level, runs, factory);
  console.log(
    `${level.id} ${name.padEnd(6)} runs=${s.runs} win=${(s.winRate * 100).toFixed(1)}% ` +
    `avgMoves=${s.avgMovesUsed.toFixed(1)} gift=${(s.giftRate * 100).toFixed(1)}% shuffle=${(s.shuffleRate * 100).toFixed(1)}%`,
  );
}
