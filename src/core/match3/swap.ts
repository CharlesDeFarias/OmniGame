import { at, cloneBoard, set } from './board';
import { findMatchGroups } from './matches';
import type { Board, Coord } from './types';

export interface SwapCheck {
  valid: boolean;
  reason?: 'not-adjacent' | 'no-match' | 'empty-cell';
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function swapPieces(board: Board, a: Coord, b: Coord): void {
  const pa = at(board, a.x, a.y);
  const pb = at(board, b.x, b.y);
  set(board, a.x, a.y, pb);
  set(board, b.x, b.y, pa);
}

export function canSwap(board: Board, a: Coord, b: Coord): SwapCheck {
  if (!isAdjacent(a, b)) return { valid: false, reason: 'not-adjacent' };
  const pa = at(board, a.x, a.y);
  const pb = at(board, b.x, b.y);
  if (pa === null || pb === null) return { valid: false, reason: 'empty-cell' };
  if (pa.kind === 'special' || pb.kind === 'special') return { valid: true };
  const test = cloneBoard(board);
  swapPieces(test, a, b);
  const groups = findMatchGroups(test, null);
  const hit = groups.some((g) =>
    g.cells.some((c) => (c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y)),
  );
  return hit ? { valid: true } : { valid: false, reason: 'no-match' };
}
