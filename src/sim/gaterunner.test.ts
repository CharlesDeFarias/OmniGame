import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRng, parseGateLevel, startGate } from '../core/gaterunner/index';
import type { GateLevelDef, Lane } from '../core/gaterunner/index';
import { greedyLane, randomLane, runGate, simulateGate } from './gaterunner';

const load = (id: string): GateLevelDef =>
  parseGateLevel(JSON.parse(readFileSync(`levels/runner/${id}.json`, 'utf8')) as unknown);

const IDS = ['r01', 'r02', 'r03'] as const;

describe('gaterunner sim', () => {
  it('all three sample levels parse via parseGateLevel', () => {
    for (const id of IDS) {
      const level = load(id);
      expect(level.id).toBe(id);
      expect(level.columns.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('runGate is deterministic for a fixed policy seed', () => {
    const level = load('r02');
    const a = runGate(level, randomLane(createRng(7)));
    const b = runGate(level, randomLane(createRng(7)));
    expect(a).toEqual(b);
    const g1 = runGate(level, greedyLane(createRng(7)));
    const g2 = runGate(level, greedyLane(createRng(7)));
    expect(g1).toEqual(g2);
  });

  it('randomLane only picks lanes reachable from the current lane', () => {
    const level = load('r01');
    for (let seed = 0; seed < 50; seed++) {
      const policy = randomLane(createRng(seed));
      const edge = { ...startGate(level), lane: 0 as Lane };
      expect([0, 1]).toContain(policy(edge, level));
      const other = { ...startGate(level), lane: 2 as Lane };
      expect([1, 2]).toContain(policy(other, level));
    }
  });

  it('greedyLane never reaches for an unreachable lane, even when it holds the best gate', () => {
    // Column 0: lane 2 has the fat gate, but from lane 0 only {0, 1} are reachable.
    const level = parseGateLevel({
      id: 'reach-test',
      seed: 1,
      startCount: 5,
      finishBonusPerSquad: 10,
      columns: [
        { d: 1, lanes: [{ kind: 'gate', op: 'add', value: 1 }, { kind: 'empty' }, { kind: 'gate', op: 'add', value: 50 }] },
        { d: 2, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
        { d: 3, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
        { d: 4, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
        { d: 5, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
      ],
    });
    for (let seed = 0; seed < 20; seed++) {
      const policy = greedyLane(createRng(seed));
      const edge = { ...startGate(level), lane: 0 as Lane };
      expect(policy(edge, level)).toBe(0); // add 1 beats empty; add 50 is out of reach
    }
  });

  it('greedyLane treats a sideways wall as a non-option (it would deflect back anyway)', () => {
    // From lane 1: lane 0 is a wall (deflects back = same as staying), lane 2 is the win.
    const level = parseGateLevel({
      id: 'wall-skip-test',
      seed: 1,
      startCount: 10,
      finishBonusPerSquad: 10,
      columns: [
        { d: 1, lanes: [{ kind: 'wall' }, { kind: 'foe', count: 2 }, { kind: 'gate', op: 'add', value: 1 }] },
        { d: 2, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
        { d: 3, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
        { d: 4, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
        { d: 5, lanes: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] },
      ],
    });
    for (let seed = 0; seed < 20; seed++) {
      expect(greedyLane(createRng(seed))(startGate(level), level)).toBe(2);
    }
  });

  it('greedy wins all three levels with healthy margin (200 runs each)', () => {
    // Adjacency means 100% is no longer structural — 0.80 is the calibration floor
    // (decision #51); actual rates live in docs/superpowers/calibration.
    for (const id of IDS) {
      const s = simulateGate(load(id), 200, greedyLane);
      expect(s.winRate, `${id} greedy win rate`).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('greedy is at least as good as random on wins and strictly better on score', () => {
    // Revival + gentle levels let random saturate r01 at 1.0 too, so winRate is >=;
    // avgScore stays a strict separator on every level.
    for (const id of IDS) {
      const level = load(id);
      const g = simulateGate(level, 200, greedyLane);
      const r = simulateGate(level, 200, randomLane);
      expect(g.winRate, `${id} greedy vs random`).toBeGreaterThanOrEqual(r.winRate);
      expect(g.avgScore).toBeGreaterThan(r.avgScore);
    }
  });

  it('random-policy win-rate floors hold: r01 >= 60%, r02 >= 30%, r03 >= 10% (200 runs)', () => {
    const floors: Record<(typeof IDS)[number], number> = { r01: 0.6, r02: 0.3, r03: 0.1 };
    for (const id of IDS) {
      const s = simulateGate(load(id), 200, randomLane);
      expect(s.winRate, id).toBeGreaterThanOrEqual(floors[id]);
    }
  });

  it('greedy coin payout lands in the 25-60 economy band on every level (200 runs)', () => {
    for (const id of IDS) {
      const s = simulateGate(load(id), 200, greedyLane);
      expect(s.avgCoinsPerWin, `${id} coins/win`).toBeGreaterThanOrEqual(25);
      expect(s.avgCoinsPerWin, `${id} coins/win`).toBeLessThanOrEqual(60);
    }
  });
});
