import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRng, parseGateLevel } from '../core/gaterunner/index';
import type { GateLevelDef } from '../core/gaterunner/index';
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

  it('greedy wins all three levels with healthy margin (200 runs each)', () => {
    for (const id of IDS) {
      const s = simulateGate(load(id), 200, greedyLane);
      expect(s.winRate, `${id} greedy win rate`).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('greedy beats random on every level', () => {
    for (const id of IDS) {
      const level = load(id);
      const g = simulateGate(level, 200, greedyLane);
      const r = simulateGate(level, 200, randomLane);
      expect(g.winRate, `${id} greedy vs random`).toBeGreaterThan(r.winRate);
      expect(g.avgScore).toBeGreaterThan(r.avgScore);
    }
  });

  it('random-policy win-rate floors hold: r01 > 60%, r02 > 30%, r03 >= 10% (200 runs)', () => {
    const floors: Record<(typeof IDS)[number], number> = { r01: 0.6, r02: 0.3, r03: 0.1 };
    for (const id of IDS) {
      const s = simulateGate(load(id), 200, randomLane);
      if (id === 'r03') expect(s.winRate, id).toBeGreaterThanOrEqual(floors[id]);
      else expect(s.winRate, id).toBeGreaterThan(floors[id]);
    }
  });
});
