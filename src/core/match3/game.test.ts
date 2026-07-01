import { describe, expect, it } from 'vitest';
import { startLevel, applyMove } from './game';
import type { LevelDef } from './level';
import { canSwap } from './swap';

const level: LevelDef = {
  id: 'test-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 3,
  giftMoves: 2,
  goals: [{ type: 'collect', color: 'red', count: 200 }],
};

/** Find any valid move by brute force so tests don't depend on a specific layout. */
function findValidMove(state: ReturnType<typeof startLevel>): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const b = state.board;
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const to = { x: x + d.x, y: y + d.y };
        if (to.x >= b.width || to.y >= b.height) continue;
        if (canSwap(b, { x, y }, to).valid) return { a: { x, y }, b: to };
      }
    }
  }
  throw new Error('no valid move found');
}

describe('game', () => {
  it('starts with the level board and full moves', () => {
    const s = startLevel(level);
    expect(s.movesLeft).toBe(3);
    expect(s.status).toBe('playing');
    expect(s.board.width).toBe(6);
  });

  it('an invalid swap consumes no move', () => {
    const s = startLevel(level);
    const r = applyMove(s, { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(r.invalid).toBe(true);
    expect(r.state.movesLeft).toBe(3);
  });

  it('a valid move decrements movesLeft and reports events', () => {
    const s = startLevel(level);
    const mv = findValidMove(s);
    const r = applyMove(s, mv.a, mv.b);
    expect(r.invalid).toBeUndefined();
    expect(r.state.movesLeft).toBe(2);
    expect(r.events.length).toBeGreaterThan(0);
  });

  it('grants the gift exactly once, then loses', () => {
    let s = startLevel(level);
    let gifted = false;
    for (let guard = 0; guard < 50 && s.status === 'playing'; guard++) {
      const mv = findValidMove(s);
      const r = applyMove(s, mv.a, mv.b);
      s = r.state;
      if (r.gift !== undefined) {
        expect(r.gift).toBe(2);
        expect(s.movesLeft).toBe(2);
        gifted = true;
      }
    }
    expect(gifted).toBe(true);
    expect(s.status).toBe('lost');
  });

  it('wins when goals complete and rejects further moves', () => {
    const easy: LevelDef = { ...level, moves: 30, goals: [{ type: 'collect', color: 'red', count: 1 }] };
    let s = startLevel(easy);
    for (let guard = 0; guard < 50 && s.status === 'playing'; guard++) {
      const mv = findValidMove(s);
      s = applyMove(s, mv.a, mv.b).state;
    }
    expect(s.status).toBe('won');
    const after = applyMove(s, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(after.invalid).toBe(true);
  });
});
