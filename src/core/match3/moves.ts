import { canSwap } from './swap';
import type { Board, Coord } from './types';

export interface Move {
  a: Coord;
  b: Coord;
}

const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
] as const;

export function findValidMoves(board: Board): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      for (const d of DIRS) {
        const to = { x: x + d.x, y: y + d.y };
        if (to.x >= board.width || to.y >= board.height) continue;
        if (canSwap(board, { x, y }, to).valid) {
          out.push({ a: { x, y }, b: to });
        }
      }
    }
  }
  return out;
}

export function hasValidMove(board: Board): boolean {
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      for (const d of DIRS) {
        const to = { x: x + d.x, y: y + d.y };
        if (to.x >= board.width || to.y >= board.height) continue;
        if (canSwap(board, { x, y }, to).valid) {
          return true;
        }
      }
    }
  }
  return false;
}
