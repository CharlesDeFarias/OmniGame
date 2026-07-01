import type { RNG } from '../rng';
import { at, set } from './board';
import { ALL_COLORS, type Board, type Coord, type Piece } from './types';

export interface FallMove { from: Coord; to: Coord; }

export function applyGravity(board: Board): FallMove[] {
  const moves: FallMove[] = [];
  for (let x = 0; x < board.width; x++) {
    let writeY = board.height - 1;
    for (let y = board.height - 1; y >= 0; y--) {
      const p = at(board, x, y);
      if (p === null) continue;
      if (y !== writeY) {
        set(board, x, writeY, p);
        set(board, x, y, null);
        moves.push({ from: { x, y }, to: { x, y: writeY } });
      }
      writeY--;
    }
  }
  return moves;
}

export function refill(board: Board, rng: RNG, colorCount: number): { coord: Coord; piece: Piece }[] {
  const palette = ALL_COLORS.slice(0, colorCount);
  const fills: { coord: Coord; piece: Piece }[] = [];
  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      if (at(board, x, y) === null) {
        const piece: Piece = { kind: 'normal', color: rng.pick(palette) };
        set(board, x, y, piece);
        fills.push({ coord: { x, y }, piece });
      }
    }
  }
  return fills;
}
