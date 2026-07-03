import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { simulateLevel } from './simulate';

const sets = [
  { dir: 'kitchen', ids: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020'] },
  { dir: 'dance', ids: ['021', '022', '023', '024', '025', '026', '027', '028', '029', '030'] },
  { dir: 'gym', ids: ['031', '032', '033', '034', '035', '036', '037', '038', '039', '040'] },
  { dir: 'vanity', ids: ['041', '042', '043', '044', '045', '046', '047', '048', '049', '050'] },
];

for (const { dir, ids } of sets) {
  describe(`${dir} chapter smoke calibration`, () => {
    for (const id of ids) {
      it(`${dir}-${id} parses and is winnable by greedy`, () => {
        const level = parseLevel(JSON.parse(readFileSync(`levels/${dir}/${id}.json`, 'utf8')) as unknown);
        const s = simulateLevel(level, 30, greedyPolicy);
        expect(s.winRate).toBeGreaterThanOrEqual(0.4);
      });
    }
  });
}
