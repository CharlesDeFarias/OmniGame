import { describe, expect, it } from 'vitest';
import { createRng, parseLevel } from '../core/match3/index';
import { greedyPolicy } from './policies';
import { playLevel } from './run';

const easy = parseLevel({
  id: 'easy-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 30,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 3 }],
});

const brutal = parseLevel({
  id: 'brutal-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 2,
  giftMoves: 0,
  goals: [{ type: 'collect', color: 'red', count: 500 }],
});

describe('playLevel', () => {
  it('wins an easy level with greedy and reports sane numbers', () => {
    const res = playLevel(easy, greedyPolicy(createRng(1)));
    expect(res.won).toBe(true);
    expect(res.movesUsed).toBeGreaterThan(0);
    expect(res.movesUsed).toBeLessThanOrEqual(30 + 5);
  });

  it('loses an impossible level and stops', () => {
    const res = playLevel(brutal, greedyPolicy(createRng(1)));
    expect(res.won).toBe(false);
    expect(res.movesUsed).toBe(2);
  });

  it('is deterministic given level seed + policy seed', () => {
    const r1 = playLevel(easy, greedyPolicy(createRng(7)));
    const r2 = playLevel(easy, greedyPolicy(createRng(7)));
    expect(r1).toEqual(r2);
  });
});
