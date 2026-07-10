import { describe, expect, it } from 'vitest';
import { at, set } from './board';
import { startLevel, applyAssist, applyMove, goalHintsFrom } from './game';
import type { LevelDef } from './level';
import { findValidMoves } from './moves';
import type { PieceColor } from './types';

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

describe('applyAssist', () => {
  const assistLevel: LevelDef = {
    id: 'assist-1',
    seed: 77,
    board: { width: 6, height: 6, colorCount: 4 },
    moves: 10,
    giftMoves: 2,
    goals: [{ type: 'collect', color: 'red', count: 200 }],
  };

  it('hammer clears exactly the chosen cell and consumes no move', () => {
    const s = startLevel(assistLevel);
    const target = { x: 2, y: 3 };
    const r = applyAssist(s, 'hammer', target);
    expect(r.invalid).toBeUndefined();
    expect(r.state.movesLeft).toBe(10);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toEqual([target]);
    expect(r.state.board.cells.every((c) => c !== null)).toBe(true);
  });

  it('hammer on a special activates it (booster-wave semantics)', () => {
    const s = startLevel(assistLevel);
    set(s.board, 1, 4, { kind: 'special', special: 'rocketH' });
    const r = applyAssist(s, 'hammer', { x: 1, y: 4 });
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells.length).toBeGreaterThanOrEqual(6);
    expect(clears[0]!.activations).toMatchObject([{ special: 'rocketH', coord: { x: 1, y: 4 } }]);
  });

  it('hammer on a box lands a direct hit: damage, no clear', () => {
    const s = startLevel(assistLevel);
    set(s.board, 3, 3, { kind: 'blocker', hp: 2 });
    const r = applyAssist(s, 'hammer', { x: 3, y: 3 });
    const damages = r.events.filter((e): e is Extract<typeof e, { type: 'damage' }> => e.type === 'damage');
    expect(damages[0]!.cells).toEqual([{ x: 3, y: 3 }]);
    expect(at(r.state.board, 3, 3)).toEqual({ kind: 'blocker', hp: 1 });
  });

  it('rowClear sweeps the full row of the target and settles the board', () => {
    const s = startLevel(assistLevel);
    const r = applyAssist(s, 'rowClear', { x: 4, y: 2 });
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    for (let x = 0; x < 6; x++) expect(clears[0]!.cells).toContainEqual({ x, y: 2 });
    expect(r.state.movesLeft).toBe(10);
    expect(r.state.board.cells.every((c) => c !== null)).toBe(true);
  });

  it('shuffle permutes the board (same piece multiset) without consuming a move', () => {
    const s = startLevel(assistLevel);
    const countBy = (cells: (typeof s.board.cells)): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const c of cells) {
        const k = c === null ? 'null' : c.kind === 'normal' ? `n:${c.color}` : c.kind;
        out[k] = (out[k] ?? 0) + 1;
      }
      return out;
    };
    const before = countBy(s.board.cells);
    const r = applyAssist(s, 'shuffle');
    expect(r.events).toEqual([{ type: 'shuffle' }]);
    expect(r.state.movesLeft).toBe(10);
    expect(countBy(r.state.board.cells)).toEqual(before);
  });

  it('assists deliberately draw from the shared rng stream', () => {
    const s = startLevel(assistLevel);
    const before = s.rng.getState();
    applyAssist(s, 'hammer', { x: 0, y: 0 });
    expect(s.rng.getState()).not.toBe(before);
  });

  it('an assist that completes the last goal wins the level', () => {
    const s = startLevel(assistLevel);
    let redAt: { x: number; y: number } | null = null;
    for (let y = 0; y < 6 && redAt === null; y++) {
      for (let x = 0; x < 6 && redAt === null; x++) {
        const p = at(s.board, x, y);
        if (p?.kind === 'normal' && p.color === ('red' as PieceColor)) redAt = { x, y };
      }
    }
    expect(redAt).not.toBeNull();
    const oneRed = { ...s, goals: [{ goal: { type: 'collect' as const, color: 'red' as PieceColor, count: 1 }, collected: 0 }] };
    const r = applyAssist(oneRed, 'hammer', redAt!);
    expect(r.state.status).toBe('won');
  });

  it('rejects assists when the level is not in play', () => {
    const s = startLevel(assistLevel);
    const r = applyAssist({ ...s, status: 'won' }, 'hammer', { x: 0, y: 0 });
    expect(r.invalid).toBe(true);
    expect(r.reason).toBe('not-playing');
  });

  it('rowClear on an all-hp2-box row: empty clear event, every box damaged, none destroyed', () => {
    const boxyRow: LevelDef = {
      ...assistLevel,
      id: 'assist-boxrow',
      board: { width: 4, height: 4, colorCount: 4, layout: ['....', 'BBBB', '....', '....'] },
    };
    const s = startLevel(boxyRow);
    const r = applyAssist(s, 'rowClear', { x: 0, y: 1 });
    expect(r.invalid).toBeUndefined();
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toEqual([]);
    const damages = r.events.filter((e): e is Extract<typeof e, { type: 'damage' }> => e.type === 'damage');
    expect(damages[0]!.cells).toHaveLength(4);
    for (let x = 0; x < 4; x++) expect(at(r.state.board, x, 1)).toEqual({ kind: 'blocker', hp: 1 });
  });

  it('rejects out-of-bounds targets', () => {
    const s = startLevel(assistLevel);
    const r = applyAssist(s, 'hammer', { x: 9, y: 9 });
    expect(r.invalid).toBe(true);
  });

  it('is deterministic per seed', () => {
    const r1 = applyAssist(startLevel(assistLevel), 'rowClear', { x: 0, y: 5 });
    const r2 = applyAssist(startLevel(assistLevel), 'rowClear', { x: 0, y: 5 });
    expect(r1.events).toEqual(r2.events);
    expect(r1.state.board).toEqual(r2.state.board);
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
