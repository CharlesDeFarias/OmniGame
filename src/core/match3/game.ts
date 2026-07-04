import { createRng, type RNG } from '../rng';
import { createBoard } from './board';
import type { GoalHints } from './boosters';
import { applyCleared, goalsComplete, initGoals, type GoalState } from './goals';
import type { LevelDef } from './level';
import { hasValidMove, shuffleBoard } from './moves';
import { resolveTurn, type ResolveEvent } from './resolve';
import type { Board, Coord, PieceColor, SpecialKind } from './types';

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

export interface StartOptions {
  /** Pre-level boosters (RM-style): up to 2 specials substituted onto the generated
   *  board before play. Pure substitution AFTER generation — draws no RNG, so the
   *  board and stream are identical to a plain start except the swapped cells. */
  startBoosters?: SpecialKind[];
}

/** Substitute `special` for the nearest normal piece to `anchor`, walking the
 *  row-major scanline outward (idx, idx+1, idx-1, idx+2, ...) past blockers,
 *  holes, and already-placed specials. */
function placeStartBooster(board: Board, anchor: number, special: SpecialKind): void {
  const n = board.cells.length;
  for (let offset = 0; offset < n; offset++) {
    for (const idx of offset === 0 ? [anchor] : [anchor + offset, anchor - offset]) {
      if (idx < 0 || idx >= n) continue;
      if (board.cells[idx]?.kind === 'normal') {
        board.cells[idx] = { kind: 'special', special };
        return;
      }
    }
  }
}

export function startLevel(level: LevelDef, options?: StartOptions): GameState {
  const rng = createRng(level.seed);
  const board = createBoard(level.board.width, level.board.height, rng, level.board.colorCount, level.board.layout);
  if (!hasValidMove(board)) shuffleBoard(board, rng);
  const boosters = options?.startBoosters?.slice(0, 2) ?? [];
  const cx = Math.floor(level.board.width / 2);
  const cy = Math.floor(level.board.height / 2);
  const anchors = [cy * level.board.width + cx, cy * level.board.width + (cx - 1)];
  boosters.forEach((special, i) => placeStartBooster(board, anchors[i]!, special));
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

/** Remaining-need summary for smart propeller targeting: colors still owed by collect
 *  goals, and whether box/ice goals still have work left. Completed goals drop out. */
export function goalHintsFrom(goals: GoalState[]): GoalHints {
  const colors: PieceColor[] = [];
  let wantBoxes = false;
  let wantIce = false;
  for (const g of goals) {
    if (g.collected >= g.goal.count) continue;
    if (g.goal.type === 'collect') colors.push(g.goal.color);
    else if (g.goal.type === 'clearBoxes') wantBoxes = true;
    else wantIce = true;
  }
  return { colors, wantBoxes, wantIce };
}

export function applyMove(state: GameState, a: Coord, b: Coord): MoveOutcome {
  if (state.status !== 'playing') return { state, events: [], invalid: true, reason: 'not-playing' };
  const result = resolveTurn(state.board, a, b, state.rng, state.level.board.colorCount, goalHintsFrom(state.goals));
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
