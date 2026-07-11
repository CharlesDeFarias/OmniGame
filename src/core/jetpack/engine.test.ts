import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { INVINCIBLE_SECONDS, PLAYER_RD, START_HEARTS, SPEED, starsForRun, startRun, step } from './engine';
import { generateLevel, JET_LEVELS, MIN_BAR, OBSTACLE_EVERY } from './level';
import type { JetState } from './types';

const DT = 1 / 60;

function run(state: JetState, seconds: number, holding: boolean): JetState {
  let s = state;
  for (let t = 0; t < seconds; t += DT) s = step(s, DT, holding).state;
  return s;
}

describe('jetpack level generation', () => {
  it('is deterministic per seed and every obstacle leaves a generous one-sided gap', () => {
    for (const def of JET_LEVELS) {
      const a = generateLevel(def);
      const b = generateLevel(def);
      expect(a).toEqual(b);
      expect(a.obstacles.length).toBeGreaterThan(3);
      for (const o of a.obstacles) {
        // One-sided: the bar touches exactly one edge, so the gap is open sky.
        expect(o.top === 0 || o.bottom === 1).toBe(true);
        const blocked = o.bottom - o.top;
        expect(blocked).toBeLessThanOrEqual(0.6);
        expect(o.d).toBeLessThanOrEqual(def.length - 30);
      }
      expect(a.coins.length).toBeGreaterThan(10);
      for (const c of a.coins) {
        expect(c.y).toBeGreaterThan(0);
        expect(c.y).toBeLessThan(1);
      }
    }
  });

  it('every bar is clearly visible: blocked height >= MIN_BAR on shipped seeds and 500 random ones', () => {
    const rng = createRng(20260710);
    const seeds = [...JET_LEVELS.map((l) => l.seed)];
    for (let i = 0; i < 500; i++) seeds.push(rng.int(1_000_000));
    for (const seed of seeds) {
      const { obstacles } = generateLevel({ id: `probe-${seed}`, seed, length: 600 });
      for (const o of obstacles) {
        expect(o.bottom - o.top).toBeGreaterThanOrEqual(MIN_BAR);
      }
    }
  });

  it('forgiveness invariant: one hit always grants safe passage through the NEXT bar', () => {
    // Emergent tuning contract (review finding): the blink window must outlast
    // the worst-case travel to the far edge of the following bar's collision
    // window. Breaks silently if SPEED/OBSTACLE_EVERY/INVINCIBLE_SECONDS drift.
    expect(INVINCIBLE_SECONDS * SPEED).toBeGreaterThan(OBSTACLE_EVERY + 2 * PLAYER_RD);
  });
});

describe('jetpack engine', () => {
  const level = JET_LEVELS[0]!;

  it('holding thrusts up, releasing falls, and y stays clamped to [0,1]', () => {
    const s0 = startRun(level);
    const up = run(s0, 2, true);
    expect(up.y).toBe(0);
    const down = run(s0, 2, false);
    expect(down.y).toBe(1);
  });

  it('advances distance at SPEED and finishes at the level length', () => {
    const s0 = startRun(level);
    const s1 = step(s0, 1, false).state;
    expect(s1.dist).toBeCloseTo(SPEED, 5);
    let s = s0;
    let finish = false;
    for (let t = 0; t < 60 && !finish; t += DT) {
      const r = step(s, DT, s.y > 0.5);
      s = r.state;
      finish = r.events.some((e) => e.type === 'finish');
      if (s.status === 'expired') break;
    }
    if (s.status === 'finished') {
      expect(s.dist).toBeGreaterThanOrEqual(level.length);
      expect(finish).toBe(true);
    } else {
      expect(s.status).toBe('expired');
    }
  });

  it('a hit costs one heart, grants invincibility, and cannot double-count', () => {
    const s0 = startRun(level);
    // Steer INTO the first obstacle's blocked band deliberately.
    const first = s0.obstacles[0]!;
    const targetY = first.top === 0 ? Math.max(0.02, first.bottom / 2) : Math.min(0.98, (first.top + 1) / 2);
    let s = s0;
    let hits = 0;
    for (let t = 0; t < 10; t += DT) {
      const r = step(s, DT, s.y > targetY);
      s = r.state;
      hits += r.events.filter((e) => e.type === 'hit').length;
      if (s.dist > first.d + 5) break;
    }
    expect(hits).toBe(1);
    expect(s.hearts).toBe(START_HEARTS - 1);
  });

  it('invincibility expires after its window', () => {
    const s0 = { ...startRun(level), invincibleFor: INVINCIBLE_SECONDS };
    const s1 = run(s0, INVINCIBLE_SECONDS + 0.1, false);
    expect(s1.invincibleFor).toBe(0);
  });

  it('losing all hearts expires the run with progress kept (never a fail state)', () => {
    let s: JetState = { ...startRun(level), hearts: 1, invincibleFor: 0 };
    const first = s.obstacles[0]!;
    const targetY = first.top === 0 ? Math.max(0.02, first.bottom / 2) : Math.min(0.98, (first.top + 1) / 2);
    let expired = false;
    for (let t = 0; t < 10 && !expired; t += DT) {
      const r = step(s, DT, s.y > targetY);
      s = r.state;
      expired = r.events.some((e) => e.type === 'expired');
    }
    expect(expired).toBe(true);
    expect(s.status).toBe('expired');
    expect(s.dist).toBeGreaterThan(0);
    const after = step(s, DT, true);
    expect(after.state).toBe(s);
    expect(after.events).toHaveLength(0);
  });

  it('coins collect once and starsForRun grades by hearts/coin share', () => {
    const s0 = startRun(level);
    const coin = s0.coins[0]!;
    // Warp next to the coin and glide through it.
    let s: JetState = { ...s0, dist: coin.d - 3, y: coin.y, vy: 0 };
    let coinEvents = 0;
    for (let t = 0; t < 0.5; t += DT) {
      const r = step(s, DT, s.y > coin.y);
      s = r.state;
      coinEvents += r.events.filter((e) => e.type === 'coin' && e.index === 0).length;
    }
    expect(coinEvents).toBe(1);
    expect(s.collected).toBeGreaterThanOrEqual(1);
    // Grading table.
    expect(starsForRun({ ...s0, hearts: 3, collected: 0 })).toBe(3);
    const total = s0.coins.length;
    expect(starsForRun({ ...s0, hearts: 2, collected: Math.ceil(total * 0.8) })).toBe(3);
    expect(starsForRun({ ...s0, hearts: 2, collected: Math.ceil(total * 0.5) })).toBe(2);
    expect(starsForRun({ ...s0, hearts: 2, collected: 0 })).toBe(1);
  });

  it('is deterministic: identical input scripts produce identical states', () => {
    const script = (seed: JetState): JetState => {
      let s = seed;
      for (let i = 0; i < 600; i++) s = step(s, DT, i % 40 < 18).state;
      return s;
    };
    expect(script(startRun(level))).toEqual(script(startRun(level)));
  });
});
