import { at } from './board';
import type { Board, Coord, PieceColor } from './types';

export interface Run {
  color: PieceColor;
  dir: 'h' | 'v';
  cells: Coord[];
}

export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < board.height; y++) {
    let x = 0;
    while (x < board.width) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') { x++; continue; }
      let end = x + 1;
      while (end < board.width) {
        const q = at(board, end, y);
        if (q?.kind === 'normal' && q.color === p.color) end++;
        else break;
      }
      if (end - x >= 3) {
        const cells: Coord[] = [];
        for (let i = x; i < end; i++) cells.push({ x: i, y });
        runs.push({ color: p.color, dir: 'h', cells });
      }
      x = end;
    }
  }
  for (let x = 0; x < board.width; x++) {
    let y = 0;
    while (y < board.height) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') { y++; continue; }
      let end = y + 1;
      while (end < board.height) {
        const q = at(board, x, end);
        if (q?.kind === 'normal' && q.color === p.color) end++;
        else break;
      }
      if (end - y >= 3) {
        const cells: Coord[] = [];
        for (let i = y; i < end; i++) cells.push({ x, y: i });
        runs.push({ color: p.color, dir: 'v', cells });
      }
      y = end;
    }
  }
  return runs;
}
