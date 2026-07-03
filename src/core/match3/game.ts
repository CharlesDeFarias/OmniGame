import { createRng, type RNG } from '../rng';
import { createBoard } from './board';
import { applyCleared, goalsComplete, initGoals, type GoalState } from './goals';
import type { LevelDef } from './level';
import { hasValidMove, shuffleBoard } from './moves';
import { resolveTurn, type ResolveEvent } from './resolve';
import type { Board, Coord } from './types';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  level: LevelDef;
  board: Board;
  /** Shared and mutated across moves — GameStates are forward-only, not replayable snapshots unless you capture rng.getState() alongside. */
  rng: RNG;
  movesLeft: number;
  goals: GoalState[];
  giftUsed: boolean;
  status: GameStatus;
}

export interface MoveOutcome {
  state: GameState;
  events: ResolveEvent[];
  /** Number of moves granted by the one-time forgiveness gift, if it fired. */
  gift?: number;
  invalid?: true;
  /** Why the move was rejected (for renderer feedback, e.g. wiggle). */
  reason?: 'not-adjacent' | 'no-match' | 'empty-cell' | 'blocked' | 'not-playing';
}

export function startLevel(level: LevelDef): GameState {
  const rng = createRng(level.seed);
  const board = createBoard(level.board.width, level.board.height, rng, level.board.colorCount, level.board.layout);
  if (!hasValidMove(board)) shuffleBoard(board, rng);
  return {
    level,
    board,
    rng,
    movesLeft: level.moves,
    goals: initGoals(level.goals),
    giftUsed: false,
    status: 'playing',
  };
}

export function applyMove(state: GameState, a: Coord, b: Coord): MoveOutcome {
  if (state.status !== 'playing') return { state, events: [], invalid: true, reason: 'not-playing' };
  const result = resolveTurn(state.board, a, b, state.rng, state.level.board.colorCount);
  if (!result.valid) return { state, events: [], invalid: true, reason: result.reason };

  const goals = applyCleared(state.goals, result.clearedByColor, result.clearedBoxes, result.clearedIce);
  let movesLeft = state.movesLeft - 1;
  let giftUsed = state.giftUsed;
  let status: GameStatus = 'playing';
  let gift: number | undefined;

  if (goalsComplete(goals)) {
    status = 'won';
  } else if (movesLeft <= 0) {
    if (!giftUsed && state.level.giftMoves > 0) {
      movesLeft = state.level.giftMoves;
      giftUsed = true;
      gift = state.level.giftMoves;
    } else {
      status = 'lost';
    }
  }

  let events = result.events;
  if (status === 'playing' && !hasValidMove(result.board)) {
    shuffleBoard(result.board, state.rng);
    events = [...events, { type: 'shuffle' }];
  }

  const next: GameState = {
    level: state.level,
    board: result.board,
    rng: state.rng,
    movesLeft,
    goals,
    giftUsed,
    status,
  };
  return gift === undefined ? { state: next, events } : { state: next, events, gift };
}
