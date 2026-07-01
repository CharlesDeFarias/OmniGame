import { describe, expect, it } from 'vitest';
import { canSwap, isAdjacent } from './swap';
import { set } from './board';
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

describe('swap', () => {
  it('isAdjacent: orthogonal neighbors only', () => {
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 0 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('rejects non-adjacent swaps', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({ valid: false, reason: 'not-adjacent' });
  });

  it('rejects swaps that produce no match', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ valid: false, reason: 'no-match' });
  });

  it('accepts a swap that produces a match at a swapped cell', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    expect(canSwap(b, { x: 1, y: 1 }, { x: 1, y: 0 })).toEqual({ valid: true });
  });

  it('accepts any adjacent swap involving a special piece', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 0, 0, { kind: 'special', special: 'rocketH' });
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ valid: true });
  });

  it('rejects swaps involving an empty cell', () => {
    const b = boardFrom(['.bg', 'gry', 'yob']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ valid: false, reason: 'empty-cell' });
  });
});
