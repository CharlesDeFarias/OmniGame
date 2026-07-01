import { ALL_COLORS, type PieceColor } from './types';
import type { Goal } from './goals';

export interface LevelDef {
  id: string;
  seed: number;
  board: { width: number; height: number; colorCount: number };
  moves: number;
  giftMoves: number;
  goals: Goal[];
}

export class LevelError extends Error {
  override name = 'LevelError';
}

function fail(msg: string): never {
  throw new LevelError(msg);
}

export function parseLevel(input: unknown): LevelDef {
  if (typeof input !== 'object' || input === null) fail('level must be an object');
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) fail('id must be a non-empty string');
  if (typeof o.seed !== 'number' || !Number.isInteger(o.seed)) fail('seed must be an integer');
  const b = o.board as Record<string, unknown> | null | undefined;
  if (typeof b !== 'object' || b === null) fail('board must be an object');
  if (!Number.isInteger(b.width) || (b.width as number) < 3 || (b.width as number) > 9) fail('board.width must be an integer 3-9');
  if (!Number.isInteger(b.height) || (b.height as number) < 3 || (b.height as number) > 9) fail('board.height must be an integer 3-9');
  if (!Number.isInteger(b.colorCount) || (b.colorCount as number) < 3 || (b.colorCount as number) > 6) fail('board.colorCount must be an integer 3-6');
  if (!Number.isInteger(o.moves) || (o.moves as number) < 1) fail('moves must be an integer >= 1');
  if (!Number.isInteger(o.giftMoves) || (o.giftMoves as number) < 0) fail('giftMoves must be an integer >= 0');
  if (!Array.isArray(o.goals) || o.goals.length === 0) fail('goals must be a non-empty array');
  const goals: Goal[] = o.goals.map((g: unknown) => {
    if (typeof g !== 'object' || g === null) fail('goal must be an object');
    const go = g as Record<string, unknown>;
    if (go.type !== 'collect') fail('goal.type must be "collect"');
    const colorIdx = ALL_COLORS.indexOf(go.color as PieceColor);
    if (colorIdx === -1) fail(`goal.color invalid: ${String(go.color)}`);
    if (colorIdx >= (b.colorCount as number)) fail(`goal.color outside level palette: ${String(go.color)}`);
    if (!Number.isInteger(go.count) || (go.count as number) < 1) fail('goal.count must be an integer >= 1');
    return { type: 'collect', color: go.color as PieceColor, count: go.count as number };
  });
  return {
    id: o.id,
    seed: o.seed,
    board: { width: b.width as number, height: b.height as number, colorCount: b.colorCount as number },
    moves: o.moves as number,
    giftMoves: o.giftMoves as number,
    goals,
  };
}
