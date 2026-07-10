import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at, set } from './board';
import { FINALE_ROCKET_CAP, planFinale } from './finale';
import type { GameState } from './game';
import type { Board, Coord, Piece, PieceColor } from './types';

function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange' };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) cells.push(ch === '.' ? null : ch === 'X' ? { kind: 'blocker', hp: 1 } : { kind: 'normal', color: map[ch]! });
  }
  return { width, height, cells, ice: new Array(cells.length).fill(false) };
}

function wonState(board: Board, movesLeft: number, seed = 42): GameState {
  return {
    level: {
      id: 'finale-test', seed, moves: 20, giftMoves: 0,
      board: { width: board.width, height: board.height, colorCount: 5 },
      goals: [{ type: 'collect', color: 'red', count: 1 }],
    } as GameState['level'],
    board,
    rng: createRng(seed),
    movesLeft,
    goals: [],
    giftUsed: false,
    status: 'won',
  };
}

describe('planFinale', () => {
  const bigBoard = () => boardFrom(['rbgyrb', 'gybrgo', 'yobrgb', 'bgyorp', 'rgybpo', 'obrygb']);

  it('returns nothing when no moves are left or the level was not won', () => {
    expect(planFinale(wonState(bigBoard(), 0))).toEqual([]);
    const lost = wonState(bigBoard(), 3);
    lost.status = 'lost';
    expect(planFinale(lost)).toEqual([]);
    const playing = wonState(bigBoard(), 3);
    playing.status = 'playing';
    expect(planFinale(playing)).toEqual([]);
  });

  it('plans one rocket per leftover move, capped at 8', () => {
    expect(planFinale(wonState(bigBoard(), 3))).toHaveLength(3);
    expect(planFinale(wonState(bigBoard(), 8))).toHaveLength(8);
    expect(planFinale(wonState(bigBoard(), 15))).toHaveLength(FINALE_ROCKET_CAP);
  });

  it('picks distinct normal cells only', () => {
    const b = bigBoard();
    set(b, 0, 0, { kind: 'blocker', hp: 1 });
    set(b, 1, 0, { kind: 'special', special: 'tnt' });
    const rockets = planFinale(wonState(b, 8));
    const seen = new Set<string>();
    for (const r of rockets) {
      const k = `${r.coord.x},${r.coord.y}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(at(b, r.coord.x, r.coord.y)?.kind).toBe('normal');
    }
  });

  it('caps at the number of normal cells when the board is sparse', () => {
    const b = boardFrom(['rX', 'Xb']);
    expect(planFinale(wonState(b, 8))).toHaveLength(2);
  });

  it('targets are the full row or column of the rocket cell', () => {
    const rockets = planFinale(wonState(bigBoard(), 4));
    for (const r of rockets) {
      if (r.vertical) {
        expect(r.targets).toEqual([0, 1, 2, 3, 4, 5].map((y): Coord => ({ x: r.coord.x, y })));
      } else {
        expect(r.targets).toEqual([0, 1, 2, 3, 4, 5].map((x): Coord => ({ x, y: r.coord.y })));
      }
    }
  });

  it('is deterministic for the same finished state', () => {
    expect(planFinale(wonState(bigBoard(), 6))).toEqual(planFinale(wonState(bigBoard(), 6)));
  });

  it('never mutates the state and never consumes the shared game rng', () => {
    const b = bigBoard();
    const state = wonState(b, 8);
    const cellsBefore = b.cells.map((c) => (c === null ? null : { ...c }));
    const rngBefore = state.rng.getState();
    planFinale(state);
    expect(b.cells).toEqual(cellsBefore);
    expect(state.rng.getState()).toBe(rngBefore);
    expect(state.movesLeft).toBe(8);
    expect(state.status).toBe('won');
    expect(state.goals).toEqual([]);
  });
});
