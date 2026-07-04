import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canOrder, createRng, parseTowerLevel, startTower, tick } from '../core/tower/index';
import type { TowerLevelDef } from '../core/tower/index';
import { greedySend, randomSend, runTower, simulateTower } from './tower';

const load = (id: string): TowerLevelDef =>
  parseTowerLevel(JSON.parse(readFileSync(`levels/tower/${id}.json`, 'utf8')) as unknown);

const IDS = ['t01', 't02', 't03'] as const;

describe('tower sim', () => {
  it('all three sample levels parse via parseTowerLevel', () => {
    for (const id of IDS) {
      const level = load(id);
      expect(level.id).toBe(id);
      expect(level.towers.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('runTower is deterministic for a fixed policy seed and always ends by maxTicks', () => {
    for (const id of IDS) {
      const level = load(id);
      const a = runTower(level, randomSend(createRng(7)));
      const b = runTower(level, randomSend(createRng(7)));
      expect(a).toEqual(b);
      expect(a.ticks).toBeLessThanOrEqual(level.maxTicks);
      const g1 = runTower(level, greedySend(createRng(7)));
      const g2 = runTower(level, greedySend(createRng(7)));
      expect(g1).toEqual(g2);
      expect(g1.ticks).toBeLessThanOrEqual(level.maxTicks);
    }
  });

  it('both policies only ever issue orders the engine itself accepts', () => {
    const level = load('t03');
    for (const make of [randomSend, greedySend]) {
      const policy = make(createRng(3));
      let state = startTower(level);
      while (!state.done) {
        for (const o of policy(state, level)) {
          expect(canOrder(state, level, o.from, o.to)).toBe(true);
        }
        state = tick(state, level).state;
      }
    }
  });

  it('greedySend beats the tutorial level outright, well before timeout', () => {
    const level = load('t01');
    const r = runTower(level, greedySend(createRng(1)));
    expect(r.won).toBe(true);
    expect(r.ticks).toBeLessThan(level.maxTicks);
  });

  it('calibration smoke: greedy >= 0.9 everywhere; random floors 0.5 / 0.2 / 0.05 (200 runs)', () => {
    const floors: Record<(typeof IDS)[number], number> = { t01: 0.5, t02: 0.2, t03: 0.05 };
    for (const id of IDS) {
      const level = load(id);
      const greedy = simulateTower(level, 200, (rng) => greedySend(rng));
      expect(greedy.winRate, `${id} greedy`).toBeGreaterThanOrEqual(0.9);
      const random = simulateTower(level, 200, (rng) => randomSend(rng));
      expect(random.winRate, `${id} random`).toBeGreaterThanOrEqual(floors[id]);
    }
  });
});
