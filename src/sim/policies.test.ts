import { describe, expect, it } from 'vitest';
import { createRng, findValidMoves, parseLevel, resolveTurn, startLevel } from '../core/match3/index';
import { greedyPolicy, randomPolicy } from './policies';

const level = parseLevel({
  id: 'sim-test',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 20,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 12 }],
});

describe('policies', () => {
  it('randomPolicy returns a listed move, deterministically per seed', () => {
    const s = startLevel(level);
    const moves = findValidMoves(s.board);
    const m1 = randomPolicy(createRng(3))(s, moves);
    const m2 = randomPolicy(createRng(3))(s, moves);
    expect(moves).toContainEqual(m1);
    expect(m1).toEqual(m2);
  });

  it('greedyPolicy returns a listed move and does not advance the game RNG', () => {
    const s = startLevel(level);
    const before = s.rng.getState();
    const moves = findValidMoves(s.board);
    const m = greedyPolicy(createRng(4))(s, moves);
    expect(moves).toContainEqual(m);
    expect(s.rng.getState()).toBe(before);
  });

  it('greedyPolicy is argmax over immediate goal progress', () => {
    const s = startLevel(level);
    const moves = findValidMoves(s.board);
    const chosen = greedyPolicy(createRng(4))(s, moves);
    const score = (m: (typeof moves)[number]): number => {
      const trial = createRng(0);
      trial.setState(s.rng.getState());
      const r = resolveTurn(s.board, m.a, m.b, trial, level.board.colorCount);
      return Math.min(12, r.clearedByColor.red ?? 0);
    };
    const best = Math.max(...moves.map(score));
    expect(score(chosen)).toBe(best);
  });
});
