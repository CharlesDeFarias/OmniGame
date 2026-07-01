import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLevel } from './level';

const good = {
  id: 'kitchen-001',
  seed: 1001,
  board: { width: 7, height: 7, colorCount: 4 },
  moves: 20,
  giftMoves: 5,
  goals: [{ type: 'collect', color: 'red', count: 15 }],
};

describe('parseLevel', () => {
  it('accepts a valid level', () => {
    expect(parseLevel(good)).toEqual(good);
  });

  it('rejects non-objects and missing fields', () => {
    expect(() => parseLevel(null)).toThrow(/level/i);
    expect(() => parseLevel({ ...good, id: undefined })).toThrow(/id/);
    expect(() => parseLevel({ ...good, goals: [] })).toThrow(/goals/);
  });

  it('rejects out-of-range board and moves', () => {
    expect(() => parseLevel({ ...good, board: { ...good.board, width: 2 } })).toThrow(/width/);
    expect(() => parseLevel({ ...good, board: { ...good.board, colorCount: 7 } })).toThrow(/colorCount/);
    expect(() => parseLevel({ ...good, moves: 0 })).toThrow(/moves/);
  });

  it('rejects bad goal colors', () => {
    expect(() =>
      parseLevel({ ...good, goals: [{ type: 'collect', color: 'pink', count: 3 }] }),
    ).toThrow(/color/);
  });

  it('parses the real kitchen-001 level file', () => {
    const raw = JSON.parse(readFileSync('levels/kitchen/001.json', 'utf8')) as unknown;
    const level = parseLevel(raw);
    expect(level.id).toBe('kitchen-001');
    expect(level.board.width).toBeLessThanOrEqual(7);
  });

  it('rejects NaN and non-integer numerics', () => {
    expect(() => parseLevel({ ...good, board: { ...good.board, width: NaN } })).toThrow(/width/);
    expect(() => parseLevel({ ...good, moves: 19.5 })).toThrow(/moves/);
  });

  it('rejects goal colors outside the level palette', () => {
    expect(() =>
      parseLevel({ ...good, goals: [{ type: 'collect', color: 'purple', count: 3 }] }),
    ).toThrow(/palette/);
  });
});
