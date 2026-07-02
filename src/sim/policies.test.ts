import { describe, expect, it } from 'vitest';
import { createRng, findValidMoves, parseLevel, resolveTurn, startLevel } from '../core/match3/index';
import { greedyPolicy, randomPolicy } from './policies';
import { simulateLevel } from './simulate';

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

  it('greedyPolicy scores obstacle goals: picks a box-damaging move when that is the only goal', () => {
    const boxLevel = parseLevel({
      id: 'sim-box-test',
      seed: 5,
      board: { width: 5, height: 5, colorCount: 3, layout: ['.....', '.....', '..b..', '.....', '.....'] },
      moves: 20,
      giftMoves: 0,
      goals: [{ type: 'clearBoxes', count: 1 }],
    });
    const s = startLevel(boxLevel);
    const moves = findValidMoves(s.board);
    const score = (m: (typeof moves)[number]): number => {
      const trial = createRng(0);
      trial.setState(s.rng.getState());
      const r = resolveTurn(s.board, m.a, m.b, trial, boxLevel.board.colorCount);
      return Math.min(1, r.clearedBoxes);
    };
    const best = Math.max(...moves.map(score));
    expect(best).toBeGreaterThan(0); // this layout+seed guarantees a box-damaging move exists
    const chosen = greedyPolicy(createRng(4))(s, moves);
    expect(score(chosen)).toBe(best);
  });

  it('simulateLevel smoke on a boxy level: deterministic and greedy wins some runs', () => {
    const boxy = parseLevel({
      id: 'sim-boxy-smoke',
      seed: 42,
      board: {
        width: 6,
        height: 6,
        colorCount: 3,
        layout: ['......', '......', '..b.b.', '......', '......', '......'],
      },
      moves: 20,
      giftMoves: 0,
      goals: [
        { type: 'clearBoxes', count: 2 },
        { type: 'collect', color: 'red', count: 8 },
      ],
    });
    const s1 = simulateLevel(boxy, 20, greedyPolicy);
    const s2 = simulateLevel(boxy, 20, greedyPolicy);
    expect(s1).toEqual(s2);
    expect(s1.winRate).toBeGreaterThan(0);
  });
});
