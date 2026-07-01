import { at, set } from './board';
import { findMatchGroups } from './matches';
import type { RNG } from '../rng';
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

export class ShuffleError extends Error { override name = 'ShuffleError'; }

/** Fisher-Yates over occupied cells: same piece multiset, new positions. Retries until the
 *  arrangement has no immediate matches and at least one valid move. Deterministic per RNG state. */
export function shuffleBoard(board: Board, rng: RNG, maxAttempts = 50): void {
  const coords: Coord[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (at(board, x, y) !== null) coords.push({ x, y });
    }
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = coords.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const ci = coords[i]!;
      const cj = coords[j]!;
      const tmp = at(board, ci.x, ci.y);
      set(board, ci.x, ci.y, at(board, cj.x, cj.y));
      set(board, cj.x, cj.y, tmp);
    }
    if (findMatchGroups(board, null).length === 0 && hasValidMove(board)) return;
  }
  throw new ShuffleError(`no playable arrangement found in ${maxAttempts} shuffles`);
}
