import type { RNG } from '../rng';
import { ALL_COLORS, type Board, type Piece, type PieceColor } from './types';

export function index(board: Board, x: number, y: number): number {
  return y * board.width + x;
}

export function inBounds(board: Board, x: number, y: number): boolean {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function at(board: Board, x: number, y: number): Piece | null {
  if (!inBounds(board, x, y)) return null;
  return board.cells[index(board, x, y)] ?? null;
}

export function set(board: Board, x: number, y: number, piece: Piece | null): void {
  if (!inBounds(board, x, y)) throw new Error(`set out of bounds: ${x},${y}`);
  board.cells[index(board, x, y)] = piece;
}

export function cloneBoard(board: Board): Board {
  return { width: board.width, height: board.height, cells: board.cells.slice(), ice: board.ice.slice() };
}

/** Fill so no 3-in-a-row exists at creation: exclude the color of (x-1,x-2) and (y-1,y-2) runs.
 * Optional layout (row-major strings, validated in parseLevel): 'b' = box hp1, 'B' = box hp2,
 * 'i' = ice under a normally-spawned piece, '.' = normal spawn. */
export function createBoard(width: number, height: number, rng: RNG, colorCount: number, layout?: string[]): Board {
  const palette = ALL_COLORS.slice(0, colorCount);
  const board: Board = {
    width,
    height,
    cells: new Array(width * height).fill(null),
    ice: new Array(width * height).fill(false),
  };
  if (layout) {
    if (layout.length !== height || layout.some((row) => row.length !== width)) {
      throw new Error(`layout must be ${height} rows of ${width} chars`);
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = layout[y]![x]!;
        if (ch === 'b') set(board, x, y, { kind: 'blocker', hp: 1 });
        else if (ch === 'B') set(board, x, y, { kind: 'blocker', hp: 2 });
        else if (ch === 'i') board.ice[index(board, x, y)] = true;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (at(board, x, y) !== null) continue;
      const banned = new Set<PieceColor>();
      const l1 = at(board, x - 1, y);
      const l2 = at(board, x - 2, y);
      if (l1?.kind === 'normal' && l2?.kind === 'normal' && l1.color === l2.color) banned.add(l1.color);
      const u1 = at(board, x, y - 1);
      const u2 = at(board, x, y - 2);
      if (u1?.kind === 'normal' && u2?.kind === 'normal' && u1.color === u2.color) banned.add(u1.color);
      const options = palette.filter((c) => !banned.has(c));
      set(board, x, y, { kind: 'normal', color: rng.pick(options) });
    }
  }
  return board;
}
