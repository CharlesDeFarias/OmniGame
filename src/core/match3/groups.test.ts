import type { Board, Piece, PieceColor } from './types';
import { describe, expect, it } from 'vitest';
import { findMatchGroups } from './matches';

/** Build a board from ASCII rows, e.g. ['rrb', 'bgg']. r/b/g/y/p/o = colors, '.' = empty. */
export function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange' };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) cells.push(ch === '.' ? null : { kind: 'normal', color: map[ch]! });
  }
  return { width, height, cells };
}

describe('findMatchGroups', () => {
  it('classifies a 3-run as plain (no special)', () => {
    const g = findMatchGroups(boardFrom(['rrrb', 'bgyb', 'ygbr']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBeNull();
    expect(g[0]!.cells).toHaveLength(3);
  });

  it('classifies a 4-run as rocket with matching orientation', () => {
    const h = findMatchGroups(boardFrom(['rrrr', 'bgyb', 'ygbr', 'goyg']), null);
    expect(h[0]!.special).toBe('rocketH');
    const v = findMatchGroups(boardFrom(['rb', 'rg', 'ry', 'rb']), null);
    expect(v[0]!.special).toBe('rocketV');
  });

  it('classifies a 5-run as lightball even when crossed', () => {
    const g = findMatchGroups(boardFrom(['rrrrr', 'bgyby', 'ygbrg']), null);
    expect(g[0]!.special).toBe('lightball');
  });

  it('classifies an L-shape as tnt and merges the two runs into one group', () => {
    const g = findMatchGroups(boardFrom(['rgg', 'rby', 'rrr']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBe('tnt');
    expect(g[0]!.cells).toHaveLength(5);
  });

  it('classifies a standalone 2x2 as propeller', () => {
    const g = findMatchGroups(boardFrom(['rrb', 'rrg', 'byg']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBe('propeller');
    expect(g[0]!.cells).toHaveLength(4);
  });

  it('spawns the special at the swapped cell when it is in the group', () => {
    const g = findMatchGroups(boardFrom(['rrrr', 'bgyb', 'ygbr', 'goyg']), { x: 2, y: 0 });
    expect(g[0]!.origin).toEqual({ x: 2, y: 0 });
  });

  it('merges a 2x2 that overlaps a run into the group without upgrading', () => {
    const g = findMatchGroups(boardFrom(['rrr', 'rrg', 'byg']), null);
    expect(g).toHaveLength(1);
    expect(g[0]!.special).toBeNull();
    expect(g[0]!.cells).toHaveLength(5);
  });
});
