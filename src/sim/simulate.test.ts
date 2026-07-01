import { describe, expect, it } from 'vitest';
import { parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { simulateLevel } from './simulate';

const easy = parseLevel({
  id: 'easy-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 30,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 3 }],
});

describe('simulateLevel', () => {
  it('aggregates stats over distinct boards and is deterministic', () => {
    const s1 = simulateLevel(easy, 20, greedyPolicy);
    const s2 = simulateLevel(easy, 20, greedyPolicy);
    expect(s1).toEqual(s2);
    expect(s1.runs).toBe(20);
    expect(s1.winRate).toBeGreaterThan(0.9);
    expect(s1.avgMovesUsed).toBeGreaterThan(0);
    expect(s1.winRate).toBeLessThanOrEqual(1);
  });
});
