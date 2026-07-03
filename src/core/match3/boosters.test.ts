import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { boosterTargets, comboTargets, mostCommonColor } from './boosters';
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

const K = (cs: { x: number; y: number }[]) => cs.map((c) => `${c.x},${c.y}`).sort();

describe('boosterTargets', () => {
  it('rocketH clears its row; rocketV its column', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(K(boosterTargets(b, { x: 1, y: 1 }, 'rocketH', createRng(1)))).toEqual(K([
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    ]));
    expect(K(boosterTargets(b, { x: 1, y: 1 }, 'rocketV', createRng(1)))).toEqual(K([
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
    ]));
  });

  it('tnt clears 3x3 clipped to the board', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    expect(boosterTargets(b, { x: 0, y: 0 }, 'tnt', createRng(1))).toHaveLength(4);
    expect(boosterTargets(b, { x: 1, y: 1 }, 'tnt', createRng(1))).toHaveLength(9);
  });

  it('lightball alone targets every cell of the most common color', () => {
    const b = boardFrom(['rrg', 'gry', 'yrb']);
    expect(mostCommonColor(b)).toBe('red');
    const t = boosterTargets(b, { x: 2, y: 2 }, 'lightball', createRng(1));
    expect(K(t)).toEqual(K([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]));
  });

  it('propeller targets its orthogonal neighbors plus one extra cell', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const t = boosterTargets(b, { x: 1, y: 1 }, 'propeller', createRng(1));
    expect(t.length).toBe(5);
    expect(K(t.slice(0, 4))).toEqual(K([{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 2 }]));
  });
});

describe('comboTargets', () => {
  it('rocket+rocket clears row and column', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const t = comboTargets(b, { coord: { x: 1, y: 1 }, special: 'rocketH' }, { coord: { x: 2, y: 1 }, special: 'rocketV' }, createRng(1));
    expect(t.length).toBe(5);
  });

  it('lightball+lightball clears the whole board', () => {
    const b = boardFrom(['rbg', 'gry', 'yob']);
    const t = comboTargets(b, { coord: { x: 0, y: 0 }, special: 'lightball' }, { coord: { x: 1, y: 0 }, special: 'lightball' }, createRng(1));
    expect(t).toHaveLength(9);
  });

  it('tnt+tnt clears a 5x5 area clipped to the board', () => {
    const b = boardFrom(['rbgyo', 'gryob', 'yobrg', 'bgyor', 'oyrbg']);
    const t = comboTargets(b, { coord: { x: 2, y: 2 }, special: 'tnt' }, { coord: { x: 3, y: 2 }, special: 'tnt' }, createRng(1));
    expect(t).toHaveLength(25);
  });
});
