import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { simulateLevel } from './simulate';

const ids = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];

describe('kitchen chapter smoke calibration', () => {
  for (const id of ids) {
    it(`kitchen-${id} parses and is winnable by greedy`, () => {
      const level = parseLevel(JSON.parse(readFileSync(`levels/kitchen/${id}.json`, 'utf8')) as unknown);
      const s = simulateLevel(level, 30, greedyPolicy);
      expect(s.winRate).toBeGreaterThanOrEqual(0.4);
    });
  }
});
