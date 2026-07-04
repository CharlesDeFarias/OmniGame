import { describe, expect, it } from 'vitest';
import { advance, coinsForScore, reachableLanes, resolveCell, startGate } from './index';
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
  it('startGate initializes in the middle lane with the start count and no revival spent', () => {
    const s = startGate(lvl([col(1, [empty, empty, empty])], 7));
    expect(s).toEqual({
      levelId: 'test',
      lane: 1,
      count: 7,
      nextColumnIndex: 0,
      done: false,
      won: false,
      revived: false,
      score: 0,
    });
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

  describe('adjacent-lane constraint', () => {
    it('clamps a 2-lane jump one step toward the input and resolves the middle lane', () => {
      const level = lvl(
        [col(1, [empty, empty, empty]), col(2, [gate('add', 40), gate('add', 7), gate('add', 40)]), col(3, [empty, empty, empty])],
        5,
      );
      const atLane0 = advance(startGate(level), level, 0).state;
      expect(atLane0.lane).toBe(0);
      const r = advance(atLane0, level, 2); // 0 -> 2 is unreachable; clamps to 1
      expect(r.state.lane).toBe(1);
      expect(r.state.count).toBe(12); // resolved lane 1's add 7, not lane 2's add 40
      expect(r.events).toEqual([{ type: 'gate', op: 'add', value: 7, countAfter: 12 }]);
    });

    it('reachableLanes returns lane plus valid neighbors', () => {
      expect(reachableLanes(0)).toEqual([0, 1]);
      expect(reachableLanes(1)).toEqual([0, 1, 2]);
      expect(reachableLanes(2)).toEqual([1, 2]);
    });
  });

  describe('hard walls', () => {
    it('deflects a sideways move into a wall: deflect event, wall never entered, previous lane resolves', () => {
      const level = lvl([col(1, [wall, empty, gate('add', 2)]), col(2, [empty, empty, empty])], 8);
      const r = advance(startGate(level), level, 0);
      expect(r.events).toEqual([{ type: 'deflect', lane: 0 }]); // previous lane is empty: no cell event
      expect(r.state.lane).toBe(1); // stayed put
      expect(r.state.count).toBe(8); // no wall damage — the wall was never entered
    });

    it('a deflected squad resolves its previous lane cell after the deflect event', () => {
      const level = lvl([col(1, [wall, gate('add', 5), empty]), col(2, [empty, empty, empty])], 6);
      const r = advance(startGate(level), level, 0);
      expect(r.events).toEqual([
        { type: 'deflect', lane: 0 },
        { type: 'gate', op: 'add', value: 5, countAfter: 11 },
      ]);
      expect(r.state.lane).toBe(1);
      expect(r.state.count).toBe(11);
    });

    it('a head-on wall (in the squad own lane) still crashes for ceil(25%)', () => {
      const level = lvl([col(1, [empty, wall, empty]), col(2, [empty, empty, empty])], 10);
      const r = advance(startGate(level), level, 1);
      expect(r.state.count).toBe(7); // lost ceil(2.5) = 3
      expect(r.events).toEqual([{ type: 'wall', lost: 3, countAfter: 7 }]);
    });
  });

  describe('one-time revival', () => {
    it('first wipe revives to max(1, ceil(startCount/2)) and the run continues', () => {
      const level = lvl([col(1, [foe(99), empty, empty]), col(2, [empty, empty, empty])], 5);
      const r = advance(startGate(level), level, 0);
      expect(r.events).toEqual([
        { type: 'foe', lost: 5, countAfter: 0 },
        { type: 'revive', count: 3 }, // ceil(5/2)
      ]);
      expect(r.state.count).toBe(3);
      expect(r.state.revived).toBe(true);
      expect(r.state.done).toBe(false);
    });

    it('a head-on wall wipe of a squad of 1 revives to 1 (max floor)', () => {
      const level = lvl([col(1, [empty, wall, empty]), col(2, [empty, empty, empty])], 1);
      const r = advance(startGate(level), level, 1);
      expect(r.events).toEqual([
        { type: 'wall', lost: 1, countAfter: 0 },
        { type: 'revive', count: 1 }, // max(1, ceil(1/2))
      ]);
      expect(r.state.count).toBe(1);
      expect(r.state.done).toBe(false);
    });

    it('second wipe loses: revival is one-time', () => {
      const level = lvl(
        [col(1, [foe(99), empty, empty]), col(2, [foe(99), empty, empty]), col(3, [empty, empty, empty])],
        5,
      );
      const s1 = advance(startGate(level), level, 0).state; // wiped, revived to 3
      const r = advance(s1, level, 0); // wiped again
      expect(r.events).toEqual([{ type: 'foe', lost: 3, countAfter: 0 }]);
      expect(r.state.count).toBe(0);
      expect(r.state.done).toBe(true);
      expect(r.state.won).toBe(false);
      expect(r.state.score).toBe(0);
    });

    it('a revival on the last column still finishes as a win', () => {
      const level = lvl([col(1, [empty, empty, empty]), col(2, [foe(50), empty, empty])], 5, 10);
      const s1 = advance(startGate(level), level, 1).state;
      const r = advance(s1, level, 0);
      expect(r.events).toEqual([
        { type: 'foe', lost: 5, countAfter: 0 },
        { type: 'revive', count: 3 },
        { type: 'finish', count: 3, score: 30 },
      ]);
      expect(r.state.done).toBe(true);
      expect(r.state.won).toBe(true);
      expect(r.state.score).toBe(30);
    });

    it('a wipe on the last column with the revival spent is a loss with no finish event', () => {
      const level = lvl([col(1, [empty, empty, empty]), col(2, [foe(50), empty, empty])], 5, 10);
      const s1 = { ...advance(startGate(level), level, 1).state, revived: true };
      const r = advance(s1, level, 0);
      expect(r.state.done).toBe(true);
      expect(r.state.won).toBe(false);
      expect(r.state.score).toBe(0);
      expect(r.events).toEqual([{ type: 'foe', lost: 5, countAfter: 0 }]);
    });
  });

  describe('coinsForScore', () => {
    it('follows min(60, 20 + floor(sqrt(score)))', () => {
      expect(coinsForScore(0)).toBe(20);
      expect(coinsForScore(25)).toBe(25);
      expect(coinsForScore(270)).toBe(36); // r01-greedy-ish score
      expect(coinsForScore(1599)).toBe(59);
      expect(coinsForScore(1600)).toBe(60);
    });

    it('never exceeds the 60-coin match-3 ceiling and never drops below 20', () => {
      expect(coinsForScore(10_000_000)).toBe(60);
      expect(coinsForScore(-5)).toBe(20); // defensive: negative scores clamp
    });

    it('is monotonically non-decreasing', () => {
      let prev = -1;
      for (let s = 0; s <= 5000; s += 37) {
        const c = coinsForScore(s);
        expect(c).toBeGreaterThanOrEqual(prev);
        prev = c;
      }
    });
  });

  it('empty lane changes nothing and emits no event', () => {
    const level = lvl([col(1, [empty, gate('add', 5), empty]), col(2, [empty, empty, empty])], 6);
    const r = advance(startGate(level), level, 0);
    expect(r.state.count).toBe(6);
    expect(r.events).toEqual([]);
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
    const level = lvl(
      [col(1, [foe(99), empty, empty]), col(2, [foe(99), empty, empty]), col(3, [empty, empty, empty]), col(4, [empty, empty, empty]), col(5, [empty, empty, empty])],
      5,
    );
    const s1 = advance(startGate(level), level, 0).state; // wipe #1 -> revived
    const dead = advance(s1, level, 0).state; // wipe #2 -> done, lost
    expect(dead.done).toBe(true);
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
