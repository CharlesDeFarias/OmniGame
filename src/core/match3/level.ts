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

class LevelError extends Error {}

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
  if (typeof b.width !== 'number' || b.width < 3 || b.width > 9) fail('board.width must be 3-9');
  if (typeof b.height !== 'number' || b.height < 3 || b.height > 9) fail('board.height must be 3-9');
  if (typeof b.colorCount !== 'number' || b.colorCount < 3 || b.colorCount > 6) fail('board.colorCount must be 3-6');
  if (typeof o.moves !== 'number' || o.moves < 1) fail('moves must be >= 1');
  if (typeof o.giftMoves !== 'number' || o.giftMoves < 0) fail('giftMoves must be >= 0');
  if (!Array.isArray(o.goals) || o.goals.length === 0) fail('goals must be a non-empty array');
  const goals: Goal[] = o.goals.map((g: unknown) => {
    if (typeof g !== 'object' || g === null) fail('goal must be an object');
    const go = g as Record<string, unknown>;
    if (go.type !== 'collect') fail('goal.type must be "collect"');
    if (!ALL_COLORS.includes(go.color as PieceColor)) fail(`goal.color invalid: ${String(go.color)}`);
    if (typeof go.count !== 'number' || go.count < 1) fail('goal.count must be >= 1');
    return { type: 'collect', color: go.color as PieceColor, count: go.count };
  });
  return {
    id: o.id,
    seed: o.seed,
    board: { width: b.width, height: b.height, colorCount: b.colorCount },
    moves: o.moves,
    giftMoves: o.giftMoves,
    goals,
  };
}
