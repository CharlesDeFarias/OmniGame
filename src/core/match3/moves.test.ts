import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at, createBoard, set } from './board';
import { findMatchGroups } from './matches';
import { findValidMoves, hasValidMove, shuffleBoard } from './moves';
import type { Board, Piece, PieceColor } from './types';

/** Build a board from ASCII rows, e.g. ['rrb', 'bgg']. r/b/g/y/p/o = colors, '.' = empty. */
function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = {
    r: 'red',
    b: 'blue',
    g: 'green',
    y: 'yellow',
    p: 'purple',
    o: 'orange',
  };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) {
      cells.push(ch === '.' ? null : ch === 'X' ? { kind: 'blocker', hp: 1 } : { kind: 'normal', color: map[ch]! });
    }
  }
  return { width, height, cells, ice: new Array(cells.length).fill(false) };
}

describe('findValidMoves', () => {
  it('finds no moves on a deadlocked latin-square board', () => {
    const b = boardFrom(['rbg', 'bgr', 'grb']);
    expect(findValidMoves(b)).toEqual([]);
    expect(hasValidMove(b)).toBe(false);
  });

  it('finds the known move on a simple board', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const moves = findValidMoves(b);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves).toContainEqual({ a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
  });

  it('enumerates each candidate pair once (right and down only)', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const seen = new Set(
      findValidMoves(b).map((m) => `${m.a.x},${m.a.y}-${m.b.x},${m.b.y}`),
    );
    expect(seen.size).toBe(findValidMoves(b).length);
  });

  it('excludes swaps involving a box, even when the swap would line up a match', () => {
    // Swapping the box at (0,0) with the red at (1,0) would put red atop column 0
    // (r,r,r vertical) if boxes were swappable -- it must be excluded.
    const b = boardFrom(['Xrg', 'rgb', 'rgy']);
    const moves = findValidMoves(b);
    expect(moves).not.toContainEqual({ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } });
    expect(moves.some((m) => (m.a.x === 0 && m.a.y === 0) || (m.b.x === 0 && m.b.y === 0))).toBe(false);
    // ...while a legitimate move elsewhere is still found: (1,0)<->(2,0) makes col 1 = g,g,g.
    expect(moves).toContainEqual({ a: { x: 1, y: 0 }, b: { x: 2, y: 0 } });
  });
});

describe('shuffleBoard', () => {
  const pieceMultiset = (b: ReturnType<typeof createBoard>): string =>
    b.cells.map((c) => JSON.stringify(c)).sort().join('|');

  it('preserves pieces, removes matches, guarantees a valid move, deterministic per seed', () => {
    const mk = () => createBoard(6, 6, createRng(11), 4);
    const b1 = mk();
    const b2 = mk();
    const before = pieceMultiset(b1);
    shuffleBoard(b1, createRng(99));
    shuffleBoard(b2, createRng(99));
    expect(pieceMultiset(b1)).toBe(before);
    expect(findMatchGroups(b1, null)).toHaveLength(0);
    expect(hasValidMove(b1)).toBe(true);
    expect(b1).toEqual(b2);
  });

  it('rescues the discovered createBoard deadlock', () => {
    const b = createBoard(4, 4, createRng(4424), 3);
    expect(hasValidMove(b)).toBe(false);
    shuffleBoard(b, createRng(1));
    expect(hasValidMove(b)).toBe(true);
    expect(findMatchGroups(b, null)).toHaveLength(0);
  });

  it('leaves boxes and ice untouched, preserving the non-blocker multiset', () => {
    const b = boardFrom(['rbXgy', 'bgrby', 'yXogr', 'gborb', 'ybgyo']);
    set(b, 2, 0, { kind: 'blocker', hp: 2 }); // distinct hp to prove it is preserved, not rebuilt
    b.ice[0] = true;
    b.ice[7] = true;
    b.ice[24] = true;
    const iceBefore = [...b.ice];
    const nonBlockers = (board: typeof b): string =>
      board.cells
        .filter((c) => c !== null && c.kind !== 'blocker')
        .map((c) => JSON.stringify(c))
        .sort()
        .join('|');
    const before = nonBlockers(b);
    shuffleBoard(b, createRng(7));
    expect(at(b, 2, 0)).toEqual({ kind: 'blocker', hp: 2 });
    expect(at(b, 1, 2)).toEqual({ kind: 'blocker', hp: 1 });
    expect(b.cells.filter((c) => c !== null && c.kind === 'blocker')).toHaveLength(2);
    expect(b.ice).toEqual(iceBefore);
    expect(nonBlockers(b)).toBe(before);
    expect(findMatchGroups(b, null)).toHaveLength(0);
    expect(hasValidMove(b)).toBe(true);
  });
});
