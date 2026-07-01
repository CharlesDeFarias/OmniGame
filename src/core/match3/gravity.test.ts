import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at } from './board';
import { applyGravity, refill } from './gravity';
import type { Board, Piece, PieceColor } from './types';

/** Build a board from ASCII rows, e.g. ['rrb', 'bgg']. r/b/g/y/p/o = colors, '.' = empty. */
function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange' };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) cells.push(ch === '.' ? null : { kind: 'normal', color: map[ch]! });
  }
  return { width, height, cells };
}

describe('gravity', () => {
  it('drops pieces into empty cells below', () => {
    const b = boardFrom(['r', '.', 'b', '.']);
    const moves = applyGravity(b);
    expect(at(b, 0, 3)).toEqual({ kind: 'normal', color: 'blue' });
    expect(at(b, 0, 2)).toEqual({ kind: 'normal', color: 'red' });
    expect(at(b, 0, 0)).toBeNull();
    expect(at(b, 0, 1)).toBeNull();
    expect(moves).toEqual([
      { from: { x: 0, y: 2 }, to: { x: 0, y: 3 } },
      { from: { x: 0, y: 0 }, to: { x: 0, y: 2 } },
    ]);
  });

  it('does nothing on a full column', () => {
    const b = boardFrom(['r', 'b', 'g']);
    expect(applyGravity(b)).toEqual([]);
  });

  it('refill fills all nulls with normal pieces from the palette', () => {
    const b = boardFrom(['..', 'rb']);
    const fills = refill(b, createRng(3), 5);
    expect(fills).toHaveLength(2);
    expect(b.cells.every((c) => c !== null)).toBe(true);
    for (const f of fills) expect(f.piece.kind).toBe('normal');
  });

  it('refill is deterministic per seed', () => {
    const b1 = boardFrom(['..', 'rb']);
    const b2 = boardFrom(['..', 'rb']);
    refill(b1, createRng(9), 5);
    refill(b2, createRng(9), 5);
    expect(b1).toEqual(b2);
  });
});
