import { describe, expect, it } from 'vitest';
import { findValidMoves, hasValidMove } from './moves';
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
      cells.push(ch === '.' ? null : { kind: 'normal', color: map[ch]! });
    }
  }
  return { width, height, cells };
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
});
