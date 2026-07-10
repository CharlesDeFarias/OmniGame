import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at, index, set } from './board';
import { findMatchGroups } from './matches';
import { resolveTurn } from './resolve';
import type { Board, Piece, PieceColor } from './types';

function boardFrom(rows: string[]): Board {
  const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange' };
  const height = rows.length;
  const width = rows[0]!.length;
  const cells: (Piece | null)[] = [];
  for (const row of rows) {
    for (const ch of row) cells.push(ch === '.' ? null : ch === 'X' ? { kind: 'blocker', hp: 1 } : { kind: 'normal', color: map[ch]! });
  }
  return { width, height, cells, ice: new Array(cells.length).fill(false) };
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

  it('throws on colorCount < 3 instead of cascading forever', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    expect(() => resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(1), 2)).toThrow(/colorCount/);
  });

  it('lightball swapped with a normal fires once: first clear is exactly that color plus itself', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'lightball' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 0, y: 1 }, createRng(5), 5);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toHaveLength(3);
  });

  it('rocket+rocket combo fires once: first clear is exactly the cross', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'rocketH' });
    set(b, 2, 1, { kind: 'special', special: 'rocketV' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 2, y: 1 }, createRng(6), 5);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toHaveLength(5);
  });

  it('spawns the special where the dragged piece landed', () => {
    const b = boardFrom(['rbrr', 'brgg', 'ygby', 'rgyo']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(2), 5);
    const spawns = r.events.filter((e): e is Extract<typeof e, { type: 'spawn' }> => e.type === 'spawn');
    expect(spawns[0]!.coord).toEqual({ x: 1, y: 0 });
  });
});

describe('special activations on clear events', () => {
  const clearsOf = (r: ReturnType<typeof resolveTurn>) =>
    r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');

  it('plain 3-match clears carry no activations', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(1), 5);
    for (const c of clearsOf(r)) expect(c.activations).toBeUndefined();
  });

  it('a swapped rocket records one activation with its row as targets', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 0, 1, { kind: 'special', special: 'rocketH' });
    const r = resolveTurn(b, { x: 0, y: 1 }, { x: 0, y: 0 }, createRng(3), 5);
    const acts = clearsOf(r)[0]!.activations!;
    expect(acts).toHaveLength(1);
    expect(acts[0]!.special).toBe('rocketH');
    expect(acts[0]!.coord).toEqual({ x: 0, y: 0 });
    expect(acts[0]!.targets).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('a chained rocket records a second activation after the swapped one', () => {
    const b = boardFrom(['rbgy', 'gryb', 'yobr', 'bgyo']);
    set(b, 1, 0, { kind: 'special', special: 'rocketH' });
    set(b, 3, 1, { kind: 'special', special: 'rocketV' });
    const r = resolveTurn(b, { x: 1, y: 0 }, { x: 1, y: 1 }, createRng(4), 5);
    const acts = clearsOf(r)[0]!.activations!;
    expect(acts.length).toBe(2);
    expect(acts[0]).toMatchObject({ special: 'rocketH', coord: { x: 1, y: 1 } });
    expect(acts[1]).toMatchObject({ special: 'rocketV', coord: { x: 3, y: 1 } });
    expect(acts[1]!.targets).toEqual([0, 1, 2, 3].map((y) => ({ x: 3, y })));
  });

  it('a special combo records both swapped specials with the combined targets', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'rocketH' });
    set(b, 2, 1, { kind: 'special', special: 'rocketV' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 2, y: 1 }, createRng(6), 5);
    const acts = clearsOf(r)[0]!.activations!;
    expect(acts).toHaveLength(2);
    // pa (rocketH) landed at b=(2,1); pb (rocketV) landed at a=(1,1).
    expect(acts[0]).toMatchObject({ special: 'rocketH', coord: { x: 2, y: 1 } });
    expect(acts[1]).toMatchObject({ special: 'rocketV', coord: { x: 1, y: 1 } });
    expect(acts[0]!.targets).toEqual(acts[1]!.targets);
    expect(acts[0]!.targets.length).toBe(5);
  });

  it('lightball swapped with a normal targets exactly that color', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    set(b, 1, 1, { kind: 'special', special: 'lightball' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 0, y: 1 }, createRng(5), 5);
    const acts = clearsOf(r)[0]!.activations!;
    expect(acts).toHaveLength(1);
    expect(acts[0]!.special).toBe('lightball');
    expect(acts[0]!.coord).toEqual({ x: 0, y: 1 });
    expect(acts[0]!.targets).toEqual([{ x: 2, y: 0 }, { x: 1, y: 1 }]);
  });

  it('resolution stays deterministic per seed with activations attached (pure annotation)', () => {
    const mk = () => {
      const b = boardFrom(['rbgy', 'gryb', 'yobr', 'bgyo']);
      set(b, 1, 0, { kind: 'special', special: 'rocketH' });
      set(b, 3, 1, { kind: 'special', special: 'rocketV' });
      return b;
    };
    const r1 = resolveTurn(mk(), { x: 1, y: 0 }, { x: 1, y: 1 }, createRng(4), 5);
    const r2 = resolveTurn(mk(), { x: 1, y: 0 }, { x: 1, y: 1 }, createRng(4), 5);
    expect(r1.events).toEqual(r2.events);
    expect(r1.board).toEqual(r2.board);
  });
});

describe('resolveTurn with obstacles', () => {
  /** Box hp1 at (1,1); swapping (0,3) up creates an L-group (col 0 rows 0-2 + row 2)
   *  whose cleared cells touch the box at BOTH (0,1) and (1,2). */
  function lShapeBoxBoard(): Board {
    return boardFrom(['rbgy', 'rXby', 'grrb', 'ryob']);
  }

  /** Box at (1,1); swapping (0,3) up creates a plain vertical 3-match in col 0
   *  touching the box only at (0,1). No special spawns, no cascades reach col 1. */
  function verticalBoxBoard(): Board {
    return boardFrom(['rbgy', 'rXby', 'gybo', 'rgyb']);
  }

  it('damages an adjacent box exactly once per wave even when two cleared cells touch it', () => {
    const b = lShapeBoxBoard();
    const r = resolveTurn(b, { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(11), 5);
    expect(r.valid).toBe(true);
    expect(r.clearedBoxes).toBe(1);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toContainEqual({ x: 1, y: 1 });
    expect(r.board.cells.some((c) => c?.kind === 'blocker')).toBe(false);
  });

  it('hp2 box survives the first wave with a damage event, then dies to a second turn', () => {
    const b = verticalBoxBoard();
    set(b, 1, 1, { kind: 'blocker', hp: 2 });
    const r1 = resolveTurn(b, { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(12), 5);
    expect(r1.valid).toBe(true);
    expect(r1.clearedBoxes).toBe(0);
    const damages = r1.events.filter((e): e is Extract<typeof e, { type: 'damage' }> => e.type === 'damage');
    expect(damages.length).toBeGreaterThanOrEqual(1);
    expect(damages[0]!.cells).toContainEqual({ x: 1, y: 1 });
    expect(at(r1.board, 1, 1)).toEqual({ kind: 'blocker', hp: 1 });
    // No clear event may contain a surviving box.
    const clearedCells1 = r1.events
      .filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear')
      .flatMap((e) => e.cells);
    expect(clearedCells1.some((c) => c.x === 1 && c.y === 1)).toBe(false);

    // Rebuild the same deterministic layout around the now-hp1 box and hit it again.
    const rows = ['rbgy', 'r.by', 'gybo', 'rgyb'];
    const map: Record<string, PieceColor> = { r: 'red', b: 'blue', g: 'green', y: 'yellow', o: 'orange' };
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (x === 1 && y === 1) continue;
        set(r1.board, x, y, { kind: 'normal', color: map[rows[y]![x]!]! });
      }
    }
    const r2 = resolveTurn(r1.board, { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(13), 5);
    expect(r2.valid).toBe(true);
    expect(r2.clearedBoxes).toBe(1);
    const clears2 = r2.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears2[0]!.cells).toContainEqual({ x: 1, y: 1 });
    expect(r2.board.cells.some((c) => c?.kind === 'blocker')).toBe(false);
  });

  it('booster row through a box damages it as a direct hit without nulling it', () => {
    const b = boardFrom(['rbX', 'gyy', 'oyr']);
    set(b, 2, 0, { kind: 'blocker', hp: 2 });
    set(b, 1, 1, { kind: 'special', special: 'rocketH' });
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(14), 5);
    expect(r.valid).toBe(true);
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    // Normals + the rocket in the row cleared; the box is NOT in the clear.
    expect(clears[0]!.cells).toContainEqual({ x: 0, y: 0 });
    expect(clears[0]!.cells).toContainEqual({ x: 1, y: 0 });
    expect(clears[0]!.cells.some((c) => c.x === 2 && c.y === 0)).toBe(false);
    const damages = r.events.filter((e): e is Extract<typeof e, { type: 'damage' }> => e.type === 'damage');
    expect(damages[0]!.cells).toEqual([{ x: 2, y: 0 }]);
    expect(r.clearedBoxes).toBe(0);
    expect(at(r.board, 2, 0)).toEqual({ kind: 'blocker', hp: 1 });
  });

  it('breaks ice under a cleared piece: flag off, count, iceClear event', () => {
    const b = boardFrom(['rbr', 'brg', 'ygb', 'rgy']);
    b.ice[index(b, 0, 0)] = true;
    const r = resolveTurn(b, { x: 1, y: 1 }, { x: 1, y: 0 }, createRng(1), 5);
    expect(r.valid).toBe(true);
    expect(r.clearedIce).toBe(1);
    expect(r.board.ice[index(r.board, 0, 0)]).toBe(false);
    const iceEvents = r.events.filter((e): e is Extract<typeof e, { type: 'iceClear' }> => e.type === 'iceClear');
    expect(iceEvents.length).toBe(1);
    expect(iceEvents[0]!.cells).toContainEqual({ x: 0, y: 0 });
    expect(r.clearedBoxes).toBe(0);
  });

  it('breaks ice under a destroyed box', () => {
    const b = verticalBoxBoard();
    b.ice[index(b, 1, 1)] = true;
    const r = resolveTurn(b, { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(15), 5);
    expect(r.valid).toBe(true);
    expect(r.clearedBoxes).toBe(1);
    expect(r.clearedIce).toBe(1);
    expect(r.board.ice[index(r.board, 1, 1)]).toBe(false);
    const iceEvents = r.events.filter((e): e is Extract<typeof e, { type: 'iceClear' }> => e.type === 'iceClear');
    expect(iceEvents[0]!.cells).toContainEqual({ x: 1, y: 1 });
    const clears = r.events.filter((e): e is Extract<typeof e, { type: 'clear' }> => e.type === 'clear');
    expect(clears[0]!.cells).toContainEqual({ x: 1, y: 1 });
  });

  it('never counts boxes in clearedByColor and cascades still settle around a surviving box', () => {
    const b = verticalBoxBoard();
    set(b, 1, 1, { kind: 'blocker', hp: 2 });
    const r = resolveTurn(b, { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(16), 5);
    expect(r.valid).toBe(true);
    // Only colored normals are counted; totals match at least the initial 3-match.
    expect(r.clearedByColor.red ?? 0).toBeGreaterThanOrEqual(3);
    for (const n of Object.values(r.clearedByColor)) expect(n).toBeGreaterThan(0);
    // Box survived in place; board is settled: full, no matches, blocker intact.
    expect(r.board.cells.filter((c) => c?.kind === 'blocker').length).toBe(1);
    expect(at(r.board, 1, 1)).toEqual({ kind: 'blocker', hp: 1 });
    expect(r.board.cells.every((c) => c !== null)).toBe(true);
    expect(findMatchGroups(r.board, null).length).toBe(0);
  });

  it('is deterministic per seed with boxes and ice (damage + iceClear events identical)', () => {
    const mk = (): Board => {
      const b = verticalBoxBoard();
      set(b, 1, 1, { kind: 'blocker', hp: 2 });
      b.ice[index(b, 0, 0)] = true;
      return b;
    };
    const r1 = resolveTurn(mk(), { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(17), 5);
    const r2 = resolveTurn(mk(), { x: 0, y: 3 }, { x: 0, y: 2 }, createRng(17), 5);
    expect(r1.events.some((e) => e.type === 'damage')).toBe(true);
    expect(r1.events.some((e) => e.type === 'iceClear')).toBe(true);
    expect(r1.events).toEqual(r2.events);
    expect(r1.board).toEqual(r2.board);
    expect(r1.clearedBoxes).toBe(r2.clearedBoxes);
    expect(r1.clearedIce).toBe(r2.clearedIce);
  });

  it('returns zero obstacle counts on an invalid swap', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const r = resolveTurn(b, { x: 0, y: 0 }, { x: 1, y: 0 }, createRng(1), 5);
    expect(r.valid).toBe(false);
    expect(r.clearedBoxes).toBe(0);
    expect(r.clearedIce).toBe(0);
  });
});
