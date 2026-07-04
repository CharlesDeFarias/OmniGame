import { describe, expect, it } from 'vitest';
import { advance, resolveCell, startGate } from './index';
import type { Cell, Column, GateLevelDef } from './index';

const gate = (op: 'add' | 'mul', value: number): Cell => ({ kind: 'gate', op, value });
const foe = (count: number): Cell => ({ kind: 'foe', count });
const wall: Cell = { kind: 'wall' };
const empty: Cell = { kind: 'empty' };
const col = (d: number, lanes: [Cell, Cell, Cell]): Column => ({ d, lanes });
const lvl = (columns: Column[], startCount = 5, finishBonusPerSquad = 10): GateLevelDef => ({
  id: 'test',
  seed: 1,
  startCount,
  columns,
  finishBonusPerSquad,
});

describe('gaterunner engine', () => {
  it('startGate initializes in the middle lane with the start count', () => {
    const s = startGate(lvl([col(1, [empty, empty, empty])], 7));
    expect(s).toEqual({ levelId: 'test', lane: 1, count: 7, nextColumnIndex: 0, done: false, won: false, score: 0 });
  });

  it('happy path emits the full event stream through to finish', () => {
    const level = lvl(
      [col(1, [gate('add', 3), empty, foe(2)]), col(2, [empty, foe(1), gate('add', 2)]), col(3, [gate('mul', 2), empty, empty])],
      5,
      10,
    );
    let s = startGate(level);
    const r1 = advance(s, level, 0);
    expect(r1.events).toEqual([{ type: 'gate', op: 'add', value: 3, countAfter: 8 }]);
    const r2 = advance(r1.state, level, 1);
    expect(r2.events).toEqual([{ type: 'foe', lost: 1, countAfter: 7 }]);
    const r3 = advance(r2.state, level, 0);
    expect(r3.events).toEqual([
      { type: 'gate', op: 'mul', value: 2, countAfter: 14 },
      { type: 'finish', count: 14, score: 140 },
    ]);
    expect(r3.state.done).toBe(true);
    expect(r3.state.won).toBe(true);
    expect(r3.state.score).toBe(140);
  });

  it('add gate adds its value', () => {
    const level = lvl([col(1, [gate('add', 9), empty, empty]), col(2, [empty, empty, empty])], 4);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(13);
  });

  it('mul gate multiplies and rounds down', () => {
    // Engine-level guarantee: mul floors even for fractional values validation would reject.
    const level = lvl([col(1, [gate('mul', 2.5), empty, empty]), col(2, [empty, empty, empty])], 5);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(12); // floor(5 * 2.5)
  });

  it('foe subtracts its count', () => {
    const level = lvl([col(1, [foe(3), empty, empty]), col(2, [empty, empty, empty])], 10);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(7);
    expect(r.events).toEqual([{ type: 'foe', lost: 3, countAfter: 7 }]);
  });

  it('foe floors count at 0 and ends the run as a loss', () => {
    const level = lvl([col(1, [foe(99), empty, empty]), col(2, [empty, empty, empty])], 5);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(0);
    expect(r.state.done).toBe(true);
    expect(r.state.won).toBe(false);
    expect(r.state.score).toBe(0);
    expect(r.events).toEqual([{ type: 'foe', lost: 5, countAfter: 0 }]);
  });

  it('wall costs ceil(25%) of the squad', () => {
    const level = lvl([col(1, [wall, empty, empty]), col(2, [empty, empty, empty])], 10);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(7); // lost ceil(2.5) = 3
    expect(r.events).toEqual([{ type: 'wall', lost: 3, countAfter: 7 }]);
  });

  it('wall can wipe a squad of 1 (loss)', () => {
    const level = lvl([col(1, [wall, empty, empty]), col(2, [empty, empty, empty])], 1);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(0);
    expect(r.state.done).toBe(true);
    expect(r.state.won).toBe(false);
  });

  it('empty lane changes nothing and emits no event', () => {
    const level = lvl([col(1, [empty, gate('add', 5), empty]), col(2, [empty, empty, empty])], 6);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(6);
    expect(r.events).toEqual([]);
  });

  it('a wipe on the last column is a loss with no finish event', () => {
    const level = lvl([col(1, [empty, empty, empty]), col(2, [foe(50), empty, empty])], 5, 10);
    const s1 = advance(startGate(level), level, 1).state;
    const r = advance(s1, level, 0);
    expect(r.state.done).toBe(true);
    expect(r.state.won).toBe(false);
    expect(r.state.score).toBe(0);
    expect(r.events).toEqual([{ type: 'foe', lost: 5, countAfter: 0 }]);
  });

  it('lane follows the committed input lane', () => {
    const level = lvl([col(1, [empty, empty, empty]), col(2, [empty, empty, empty])], 5);
    const r = advance(startGate(level), level, 2);
    expect(r.state.lane).toBe(2);
  });

  it('advance never mutates the input state (purity)', () => {
    const level = lvl([col(1, [gate('add', 3), empty, empty]), col(2, [empty, empty, empty])], 5);
    const s = startGate(level);
    const frozen = JSON.stringify(s);
    advance(s, level, 0);
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('post-done advance is inert: state unchanged, no events', () => {
    const level = lvl([col(1, [foe(99), empty, empty]), col(2, [empty, empty, empty]), col(3, [empty, empty, empty]), col(4, [empty, empty, empty]), col(5, [empty, empty, empty])], 5);
    const dead = advance(startGate(level), level, 0).state;
    const r = advance(dead, level, 1);
    expect(r.events).toEqual([]);
    expect(r.state).toEqual(dead);
    expect(r.state).not.toBe(dead); // still returns a fresh object, never the same reference
  });

  it('is deterministic: identical input sequences yield identical states and events', () => {
    const level = lvl(
      [col(1, [gate('add', 2), foe(1), wall]), col(2, [gate('mul', 2), empty, foe(3)]), col(3, [wall, gate('add', 4), empty])],
      6,
      5,
    );
    const runOnce = () => {
      let s = startGate(level);
      const all: unknown[] = [];
      for (const lane of [2, 0, 1] as const) {
        const r = advance(s, level, lane);
        s = r.state;
        all.push(r.events, { ...s });
      }
      return JSON.stringify(all);
    };
    expect(runOnce()).toBe(runOnce());
  });

  it('resolveCell exposes the same math for policy lookahead', () => {
    expect(resolveCell(10, gate('mul', 3)).count).toBe(30);
    expect(resolveCell(10, foe(4)).count).toBe(6);
    expect(resolveCell(10, wall).count).toBe(7);
    expect(resolveCell(10, empty)).toEqual({ count: 10, event: null });
  });
});
