import { describe, expect, it } from 'vitest';
import type { ResolveEvent } from '../core/match3/index';
import { planSteps, DUR } from './choreo';

const events: ResolveEvent[] = [
  { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  { type: 'clear', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
  { type: 'spawn', coord: { x: 1, y: 0 }, piece: { kind: 'special', special: 'rocketH' } },
  { type: 'fall', moves: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 3 } }] },
  { type: 'refill', fills: [{ coord: { x: 0, y: 0 }, piece: { kind: 'normal', color: 'red' } }] },
  { type: 'shuffle' },
];

describe('planSteps', () => {
  it('maps events 1:1 in order with positive durations', () => {
    const steps = planSteps(events);
    expect(steps.map((s) => s.event.type)).toEqual(['swap', 'clear', 'spawn', 'fall', 'refill', 'shuffle']);
    for (const s of steps) expect(s.duration).toBeGreaterThan(0);
  });

  it('scales fall duration with the longest drop', () => {
    const short = planSteps([{ type: 'fall', moves: [{ from: { x: 0, y: 2 }, to: { x: 0, y: 3 } }] }]);
    const long = planSteps([{ type: 'fall', moves: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 5 } }] }]);
    expect(long[0]!.duration).toBeGreaterThan(short[0]!.duration);
  });

  it('total duration for a typical turn stays snappy (< 4s)', () => {
    const total = planSteps(events).reduce((s, x) => s + x.duration, 0);
    expect(total).toBeLessThan(4000);
    expect(DUR.swap).toBeGreaterThan(0);
  });
});
