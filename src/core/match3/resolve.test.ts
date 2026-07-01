import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { set } from './board';
import { findMatchGroups } from './matches';
import { resolveTurn } from './resolve';
import type { Board, Piece, PieceColor } from './types';

function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange' };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) cells.push(ch === '.' ? null : { kind: 'normal', color: map[ch]! });
  }
  return { width, height, cells };
}

describe('resolveTurn', () => {
  it('returns invalid for a no-match swap and leaves the board untouched', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const before = b.cells.slice();
    const r = resolveTurn(b, { x: 0, y: 0 }, { x: 1, y: 0 }, createRng(1), 5);
    expect(r.valid).toBe(false);
    expect(b.cells).toEqual(before);
  });

  it('resolves a simple 3-match: events in order, no matches remain', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(1), 5);
    expect(r.valid).toBe(true);
    expect(r.events[0]!.type).toBe('swap');
    const types = r.events.map((e) => e.type);
    expect(types).toContain('clear');
    expect(types).toContain('refill');
    expect(findMatchGroups(r.board, null).length).toBe(0);
    expect(r.clearedByColor.red ?? 0).toBeGreaterThanOrEqual(3);
    expect(r.board.cells.every((c) => c !== null)).toBe(true);
  });

  it('spawns a rocket from a 4-match at the swapped cell', () => {
    const b = boardFrom(['rbrr', 'brgg', 'ygby', 'rgyo']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(2), 5);
    expect(r.valid).toBe(true);
    const spawns = r.events.filter((e) => e.type === 'spawn');
    expect(spawns.length).toBeGreaterThanOrEqual(1);
    const hasRocket = r.board.cells.some((c) => c?.kind === 'special' && c.special === 'rocketH');
    expect(hasRocket).toBe(true);
  });

  it('activates a rocket when swapped with a normal piece', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 0, 1, { kind: 'special', special: 'rocketH' });
    const r = resolveTurn(b, { x: 0, y: 1 }, { x: 0, y: 0 }, createRng(3), 5);
    expect(r.valid).toBe(true);
    const clears = r.events.filter((e) => e.type === 'clear');
    expect(clears.length).toBeGreaterThanOrEqual(1);
  });

  it('chains: a rocket cleared by another rocket activates too', () => {
    const b = boardFrom(['rbgy', 'gryb', 'yobr', 'bgyo']);
    set(b, 1, 0, { kind: 'special', special: 'rocketH' });
    set(b, 3, 1, { kind: 'special', special: 'rocketV' });
    const r = resolveTurn(b, { x: 1, y: 0 }, { x: 1, y: 1 }, createRng(4), 5);
    expect(r.valid).toBe(true);
    const cleared = r.events
      .filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear')
      .flatMap((e) => e.cells);
    expect(cleared.some((c) => c.x === 3 && c.y === 3)).toBe(true);
  });

  it('lightball swapped with a normal clears all of that color', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'lightball' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 0, y: 1 }, createRng(5), 5);
    expect(r.valid).toBe(true);
    expect(r.clearedByColor.green ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic per seed', () => {
    const mk = () => boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const r1 = resolveTurn(mk(), { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(7), 5);
    const r2 = resolveTurn(mk(), { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(7), 5);
    expect(r1.events).toEqual(r2.events);
    expect(r1.board).toEqual(r2.board);
  });
});
