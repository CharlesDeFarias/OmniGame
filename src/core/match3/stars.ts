import type { GameStatus } from './game';

export interface StarInput {
  status: GameStatus;
  giftUsed: boolean;
  movesLeft: number;
  /** The level's base move budget (LevelDef.moves). */
  baseMoves: number;
}

/** 0 = not won; 1 = won via gift; 2 = clean but tight; 3 = clean with >= 25% of budget left. */
export function starsFor(s: StarInput): 0 | 1 | 2 | 3 {
  if (s.status !== 'won') return 0;
  if (s.giftUsed) return 1;
  return s.movesLeft >= s.baseMoves * 0.25 ? 3 : 2;
}
