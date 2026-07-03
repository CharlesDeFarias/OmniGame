import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { at, cloneBoard, createBoard, index, set } from './board';
import { ALL_COLORS } from './types';

describe('board', () => {
  it('creates a board of the right size, fully populated', () => {
    const board = createBoard(7, 7, createRng(1), 5);
    expect(board.width).toBe(7);
    expect(board.height).toBe(7);
    expect(board.cells).toHaveLength(49);
    expect(board.cells.every((c) => c !== null)).toBe(true);
  });

  it('uses only the first N colors', () => {
    const board = createBoard(7, 7, createRng(1), 4);
    const allowed = new Set(ALL_COLORS.slice(0, 4));
    for (const cell of board.cells) {
      if (cell?.kind === 'normal') expect(allowed.has(cell.color)).toBe(true);
    }
  });

  it('never contains a starting match of 3', () => {
    for (let seed = 0; seed < 20; seed++) {
      const b = createBoard(7, 7, createRng(seed), 5);
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const p = at(b, x, y);
          if (p?.kind !== 'normal') continue;
          if (x >= 2) {
            const a1 = at(b, x - 1, y);
            const a2 = at(b, x - 2, y);
            expect(a1?.kind === 'normal' && a1.color === p.color && a2?.kind === 'normal' && a2.color === p.color).toBe(false);
          }
          if (y >= 2) {
            const a1 = at(b, x, y - 1);
            const a2 = at(b, x, y - 2);
            expect(a1?.kind === 'normal' && a1.color === p.color && a2?.kind === 'normal' && a2.color === p.color).toBe(false);
          }
        }
      }
    }
  });

  it('is deterministic per seed', () => {
    const a = createBoard(7, 7, createRng(5), 5);
    const b = createBoard(7, 7, createRng(5), 5);
    expect(a).toEqual(b);
  });

  it('at/set/index round-trip', () => {
    const board = createBoard(3, 3, createRng(1), 5);
    expect(index(board, 2, 1)).toBe(5);
    set(board, 2, 1, { kind: 'normal', color: 'red' });
    expect(at(board, 2, 1)).toEqual({ kind: 'normal', color: 'red' });
    expect(at(board, -1, 0)).toBeNull();
    expect(at(board, 3, 0)).toBeNull();
  });
});

describe('createBoard with layout', () => {
  const layout = [
    'b......',
    '.......',
    '...B...',
    '.......',
    '.i.....',
    '.......',
    '......i',
  ];

  it('places boxes with the right hp at the right coords', () => {
    const b = createBoard(7, 7, createRng(1), 5, layout);
    expect(at(b, 0, 0)).toEqual({ kind: 'blocker', hp: 1 });
    expect(at(b, 3, 2)).toEqual({ kind: 'blocker', hp: 2 });
    let blockers = 0;
    for (const cell of b.cells) if (cell?.kind === 'blocker') blockers++;
    expect(blockers).toBe(2);
  });

  it('sets ice flags exactly where i appears; pieces still spawn there', () => {
    const b = createBoard(7, 7, createRng(1), 5, layout);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const expected = layout[y]![x] === 'i';
        expect(b.ice[index(b, x, y)]).toBe(expected);
      }
    }
    expect(at(b, 1, 4)?.kind).toBe('normal');
    expect(at(b, 6, 6)?.kind).toBe('normal');
  });

  it('normal cells still have no starting match of 3', () => {
    for (let seed = 0; seed < 20; seed++) {
      const b = createBoard(7, 7, createRng(seed), 4, layout);
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const p = at(b, x, y);
          if (p?.kind !== 'normal') continue;
          if (x >= 2) {
            const a1 = at(b, x - 1, y);
            const a2 = at(b, x - 2, y);
            expect(a1?.kind === 'normal' && a1.color === p.color && a2?.kind === 'normal' && a2.color === p.color).toBe(false);
          }
          if (y >= 2) {
            const a1 = at(b, x, y - 1);
            const a2 = at(b, x, y - 2);
            expect(a1?.kind === 'normal' && a1.color === p.color && a2?.kind === 'normal' && a2.color === p.color).toBe(false);
          }
        }
      }
    }
  });

  it('is deterministic per seed with a layout', () => {
    const a = createBoard(7, 7, createRng(5), 5, layout);
    const b = createBoard(7, 7, createRng(5), 5, layout);
    expect(a).toEqual(b);
  });

  it('throws on layout length mismatch', () => {
    expect(() => createBoard(7, 7, createRng(1), 5, ['...'])).toThrow(/layout/);
    expect(() => createBoard(3, 3, createRng(1), 5, ['....', '....', '....'])).toThrow(/layout/);
  });

  it('back-compat: no layout means no blockers and ice all false', () => {
    const b = createBoard(7, 7, createRng(1), 5);
    expect(b.ice).toHaveLength(49);
    expect(b.ice.every((f) => f === false)).toBe(true);
    expect(b.cells.every((c) => c?.kind === 'normal')).toBe(true);
  });

  it('cloneBoard copies ice independently', () => {
    const b = createBoard(7, 7, createRng(1), 5, layout);
    const c = cloneBoard(b);
    expect(c.ice).toEqual(b.ice);
    c.ice[0] = !c.ice[0];
    expect(b.ice[0]).not.toBe(c.ice[0]);
  });
});
