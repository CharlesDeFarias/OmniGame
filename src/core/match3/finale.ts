import { createRng } from '../rng';
import type { GameState } from './game';
import type { Coord } from './types';

/** One auto-firing rocket of the win finale (RM's moves-to-rockets conversion). */
export interface FinaleRocket {
  coord: Coord;
  vertical: boolean;
  /** Cells swept on the finished board: the full row or column of `coord`. */
  targets: Coord[];
}

export const FINALE_ROCKET_CAP = 8;
export const FINALE_COINS_PER_ROCKET = 3;

/**
 * Deterministically plan the win finale: one rocket per leftover move (capped),
 * each on a distinct normal cell of the finished board. Pure bonus layer — the
 * game is already won, so this never mutates the GameState and draws from a
 * private RNG (seeded off level seed + leftover moves), leaving the shared
 * game stream untouched.
 */
export function planFinale(state: GameState, cap = FINALE_ROCKET_CAP): FinaleRocket[] {
  if (state.status !== 'won' || state.movesLeft <= 0) return [];
  const board = state.board;
  const pool: Coord[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.cells[y * board.width + x]?.kind === 'normal') pool.push({ x, y });
    }
  }
  const rng = createRng((state.level.seed ^ 0x51f1a1e0) + state.movesLeft);
  const count = Math.min(state.movesLeft, cap, pool.length);
  const rockets: FinaleRocket[] = [];
  for (let i = 0; i < count; i++) {
    const idx = rng.int(pool.length);
    const coord = pool[idx]!;
    pool.splice(idx, 1);
    const vertical = rng.int(2) === 1;
    const targets: Coord[] = vertical
      ? Array.from({ length: board.height }, (_, y) => ({ x: coord.x, y }))
      : Array.from({ length: board.width }, (_, x) => ({ x, y: coord.y }));
    rockets.push({ coord, vertical, targets });
  }
  return rockets;
}
