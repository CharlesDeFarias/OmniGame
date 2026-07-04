import { describe, expect, it } from 'vitest';
import { GateLevelError, parseGateLevel } from './index';

const gate = (op: 'add' | 'mul', value: number) => ({ kind: 'gate', op, value });
const foe = (count: number) => ({ kind: 'foe', count });
const wall = { kind: 'wall' };
const empty = { kind: 'empty' };

function validLevel(): Record<string, unknown> {
  return {
    id: 'r-test',
    seed: 42,
    startCount: 5,
    finishBonusPerSquad: 10,
    columns: [
      { d: 1, lanes: [gate('add', 3), empty, foe(2)] },
      { d: 3, lanes: [empty, gate('mul', 2), wall] },
      { d: 4, lanes: [foe(10), gate('add', 5), empty] },
      { d: 6, lanes: [wall, empty, gate('add', 1)] },
      { d: 9, lanes: [gate('mul', 3), foe(200), empty] },
    ],
  };
}

describe('parseGateLevel', () => {
  it('parses a valid level and round-trips its values', () => {
    const level = parseGateLevel(validLevel());
    expect(level.id).toBe('r-test');
    expect(level.seed).toBe(42);
    expect(level.startCount).toBe(5);
    expect(level.finishBonusPerSquad).toBe(10);
    expect(level.columns).toHaveLength(5);
    expect(level.columns[1]?.d).toBe(3);
    expect(level.columns[1]?.lanes[1]).toEqual({ kind: 'gate', op: 'mul', value: 2 });
    expect(level.columns[4]?.lanes[1]).toEqual({ kind: 'foe', count: 200 });
  });

  it('rejects non-object input and missing/empty id', () => {
    expect(() => parseGateLevel(null)).toThrow(GateLevelError);
    expect(() => parseGateLevel({ ...validLevel(), id: '' })).toThrow(GateLevelError);
    expect(() => parseGateLevel({ ...validLevel(), seed: 1.5 })).toThrow(GateLevelError);
  });

  it('rejects columns whose d is not strictly increasing or not an integer', () => {
    const dup = validLevel();
    (dup.columns as { d: number }[])[2]!.d = 3; // equal to previous
    expect(() => parseGateLevel(dup)).toThrow(/strictly increasing/);
    const frac = validLevel();
    (frac.columns as { d: number }[])[0]!.d = 1.5;
    expect(() => parseGateLevel(frac)).toThrow(GateLevelError);
  });

  it('rejects fewer than 5 or more than 30 columns', () => {
    const few = validLevel();
    (few.columns as unknown[]).length = 4;
    expect(() => parseGateLevel(few)).toThrow(/5-30/);
    const many = validLevel();
    const cols = many.columns as { d: number; lanes: unknown[] }[];
    for (let i = 0; i < 26; i++) cols.push({ d: 10 + i, lanes: [empty, empty, empty] });
    expect(cols).toHaveLength(31);
    expect(() => parseGateLevel(many)).toThrow(/5-30/);
  });

  it('rejects startCount outside 1-50', () => {
    expect(() => parseGateLevel({ ...validLevel(), startCount: 0 })).toThrow(/startCount/);
    expect(() => parseGateLevel({ ...validLevel(), startCount: 51 })).toThrow(/startCount/);
  });

  it('rejects insane gate values (add outside 1-50, mul outside 2-3)', () => {
    for (const bad of [gate('add', 0), gate('add', 51), gate('mul', 1), gate('mul', 4), gate('mul', 2.5)]) {
      const level = validLevel();
      (level.columns as { lanes: unknown[] }[])[0]!.lanes[0] = bad;
      expect(() => parseGateLevel(level)).toThrow(GateLevelError);
    }
  });

  it('rejects foe counts outside 1-200', () => {
    for (const bad of [foe(0), foe(201), foe(1.5)]) {
      const level = validLevel();
      (level.columns as { lanes: unknown[] }[])[0]!.lanes[2] = bad;
      expect(() => parseGateLevel(level)).toThrow(/foe count/);
    }
  });

  it('rejects a guaranteed-loss column (no gate or empty lane)', () => {
    const level = validLevel();
    (level.columns as { lanes: unknown[] }[])[0]!.lanes = [foe(5), wall, foe(1)];
    expect(() => parseGateLevel(level)).toThrow(/guaranteed-loss/);
  });

  it('rejects malformed lanes: wrong arity or unknown cell kind', () => {
    const two = validLevel();
    (two.columns as { lanes: unknown[] }[])[0]!.lanes = [empty, empty];
    expect(() => parseGateLevel(two)).toThrow(/3 cells/);
    const bad = validLevel();
    (bad.columns as { lanes: unknown[] }[])[0]!.lanes = [{ kind: 'portal' }, empty, empty];
    expect(() => parseGateLevel(bad)).toThrow(/kind/);
  });

  it('rejects a bad finishBonusPerSquad', () => {
    expect(() => parseGateLevel({ ...validLevel(), finishBonusPerSquad: 0 })).toThrow(/finishBonusPerSquad/);
    expect(() => parseGateLevel({ ...validLevel(), finishBonusPerSquad: undefined })).toThrow(/finishBonusPerSquad/);
  });
});
