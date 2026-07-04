import { describe, expect, it } from 'vitest';
import { startLevel, applyMove, goalHintsFrom } from './game';
import type { LevelDef } from './level';
import { findValidMoves } from './moves';

const level: LevelDef = {
  id: 'test-1',
  seed: 1001,
  board: { width: 6, height: 6, colorCount: 4 },
  moves: 3,
  giftMoves: 2,
  goals: [{ type: 'collect', color: 'red', count: 200 }],
};

/** Find any valid move so tests don't depend on a specific layout. */
function findValidMove(state: ReturnType<typeof startLevel>): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const moves = findValidMoves(state.board);
  if (moves.length === 0) throw new Error('no valid move found');
  return moves[0]!;
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

  it('startLevel auto-shuffles a deadlocked opening board', () => {
    const dl: LevelDef = {
      id: 'deadlock-1',
      seed: 4424,
      board: { width: 4, height: 4, colorCount: 3 },
      moves: 5,
      giftMoves: 0,
      goals: [{ type: 'collect', color: 'red', count: 5 }],
    };
    const s = startLevel(dl);
    expect(findValidMoves(s.board).length).toBeGreaterThan(0);
  });

  it('wins a box level once the box is destroyed (obstacle goal credited through applyMove)', () => {
    const boxy: LevelDef = {
      id: 'boxy-1',
      seed: 7,
      board: { width: 4, height: 4, colorCount: 3, layout: ['....', '..b.', '....', '....'] },
      moves: 30,
      giftMoves: 0,
      goals: [{ type: 'clearBoxes', count: 1 }],
    };
    let s = startLevel(boxy);
    for (let guard = 0; guard < 30 && s.status === 'playing'; guard++) {
      const mv = findValidMove(s);
      s = applyMove(s, mv.a, mv.b).state;
    }
    expect(s.status).toBe('won');
    expect(s.goals[0]!.collected).toBe(1);
  });

  it('reports why an invalid move was rejected', () => {
    const s = startLevel(level);
    const r1 = applyMove(s, { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(r1.invalid).toBe(true);
    expect(r1.reason).toBe('not-adjacent');
    const r2 = applyMove({ ...s, status: 'won' }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(r2.reason).toBe('not-playing');
  });
});

describe('goalHintsFrom', () => {
  it('collects remaining goal colors and obstacle wants, dropping completed goals', () => {
    expect(goalHintsFrom([
      { goal: { type: 'collect', color: 'red', count: 10 }, collected: 3 },
      { goal: { type: 'collect', color: 'blue', count: 5 }, collected: 5 },
      { goal: { type: 'clearBoxes', count: 2 }, collected: 0 },
      { goal: { type: 'clearIce', count: 4 }, collected: 4 },
    ])).toEqual({ colors: ['red'], wantBoxes: true, wantIce: false });
  });
});

describe('pre-level booster placement (startBoosters)', () => {
  it('places up to 2 boosters at the central cell and the cell to its left', () => {
    const s = startLevel(level, { startBoosters: ['tnt', 'rocketH'] });
    // 6x6: central = (3,3), left = (2,3)
    expect(s.board.cells[3 * 6 + 3]).toEqual({ kind: 'special', special: 'tnt' });
    expect(s.board.cells[3 * 6 + 2]).toEqual({ kind: 'special', special: 'rocketH' });
  });

  it('caps at 2 boosters', () => {
    const s = startLevel(level, { startBoosters: ['tnt', 'rocketH', 'lightball'] });
    const specials = s.board.cells.filter((c) => c?.kind === 'special');
    expect(specials).toHaveLength(2);
  });

  it('leaves the rest of the board and the RNG stream untouched', () => {
    const plain = startLevel(level);
    const boosted = startLevel(level, { startBoosters: ['lightball'] });
    expect(boosted.rng.getState()).toBe(plain.rng.getState());
    expect(boosted.board.ice).toEqual(plain.board.ice);
    for (let i = 0; i < plain.board.cells.length; i++) {
      if (i === 3 * 6 + 3) continue; // the substituted cell
      expect(boosted.board.cells[i]).toEqual(plain.board.cells[i]);
    }
    expect(boosted.board.cells[3 * 6 + 3]).toEqual({ kind: 'special', special: 'lightball' });
  });

  it('walks outward to the nearest normal cells when central cells are blockers', () => {
    const layoutLevel: LevelDef = {
      ...level,
      board: {
        width: 5, height: 5, colorCount: 4,
        layout: ['.....', '.....', '.bb..', '.....', '.....'],
      },
    };
    // central = (2,2) blocked, left = (1,2) blocked; scanline walk finds (3,2) then (4,2)... first normal outward.
    const s = startLevel(layoutLevel, { startBoosters: ['tnt', 'rocketV'] });
    expect(s.board.cells[2 * 5 + 3]).toEqual({ kind: 'special', special: 'tnt' });
    expect(s.board.cells[2 * 5 + 0]).toEqual({ kind: 'special', special: 'rocketV' });
  });

  it('no boosters (undefined or empty) is identical to today', () => {
    const plain = startLevel(level);
    for (const s of [startLevel(level, {}), startLevel(level, { startBoosters: [] })]) {
      expect(s.board).toEqual(plain.board);
      expect(s.rng.getState()).toBe(plain.rng.getState());
      expect(s.movesLeft).toBe(plain.movesLeft);
      expect(s.goals).toEqual(plain.goals);
      expect(s.status).toBe(plain.status);
    }
  });
});
