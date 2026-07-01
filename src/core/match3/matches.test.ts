import type { Board, Piece, PieceColor } from './types';
import { describe, expect, it } from 'vitest';
import { findRuns } from './matches';

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

describe('findRuns', () => {
  it('finds a horizontal run of 3', () => {
    const b = boardFrom(['rrrb', 'bgyb', 'ygbr']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ color: 'red', dir: 'h' });
    expect(runs[0]!.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('finds a vertical run of 4', () => {
    const b = boardFrom(['rb', 'rg', 'ry', 'rb', 'gy']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ color: 'red', dir: 'v' });
    expect(runs[0]!.cells).toHaveLength(4);
  });

  it('finds nothing on a clean board', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(findRuns(b)).toHaveLength(0);
  });

  it('finds multiple runs including overlapping L-shape', () => {
    const b = boardFrom(['rgg', 'rby', 'rrr']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(2);
    const dirs = runs.map((r) => r.dir).sort();
    expect(dirs).toEqual(['h', 'v']);
  });

  it('ignores empty cells', () => {
    const b = boardFrom(['r.r', 'rbr', 'rgr']);
    const runs = findRuns(b);
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.dir === 'v')).toBe(true);
  });
});
