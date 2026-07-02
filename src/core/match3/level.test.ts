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

describe('parseLevel layout + obstacle goals', () => {
  const layout7 = [
    'b......',
    '.......',
    '...B...',
    '.......',
    '.i.....',
    '.......',
    '.......',
  ];

  it('accepts a valid layout and returns it', () => {
    const lvl = parseLevel({ ...good, board: { ...good.board, layout: layout7 } });
    expect(lvl.board.layout).toEqual(layout7);
  });

  it('rejects layout with wrong row count', () => {
    expect(() =>
      parseLevel({ ...good, board: { ...good.board, layout: layout7.slice(0, 6) } }),
    ).toThrow(/layout/);
  });

  it('rejects layout with wrong row length', () => {
    const bad = [...layout7.slice(0, 6), '......'];
    expect(() => parseLevel({ ...good, board: { ...good.board, layout: bad } })).toThrow(/layout/);
  });

  it('rejects layout with invalid characters', () => {
    const bad = [...layout7.slice(0, 6), 'x......'];
    expect(() => parseLevel({ ...good, board: { ...good.board, layout: bad } })).toThrow(/layout/);
    expect(() =>
      parseLevel({ ...good, board: { ...good.board, layout: [...layout7.slice(0, 6), 123] } }),
    ).toThrow(/layout/);
  });

  it('parses clearBoxes and clearIce goals', () => {
    const lvl = parseLevel({
      ...good,
      goals: [
        { type: 'clearBoxes', count: 4 },
        { type: 'clearIce', count: 6 },
      ],
    });
    expect(lvl.goals).toEqual([
      { type: 'clearBoxes', count: 4 },
      { type: 'clearIce', count: 6 },
    ]);
  });

  it('rejects clearBoxes with count 0 and unknown goal types', () => {
    expect(() => parseLevel({ ...good, goals: [{ type: 'clearBoxes', count: 0 }] })).toThrow(/count/);
    expect(() => parseLevel({ ...good, goals: [{ type: 'clearWindows', count: 1 }] })).toThrow(/type/);
  });

  it('palette cross-check applies only to collect goals', () => {
    expect(() =>
      parseLevel({ ...good, goals: [{ type: 'collect', color: 'purple', count: 3 }] }),
    ).toThrow(/palette/);
    expect(() => parseLevel({ ...good, goals: [{ type: 'clearIce', count: 3 }] })).not.toThrow();
  });
});
