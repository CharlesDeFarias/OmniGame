import { describe, expect, it } from 'vitest';
import { applyCleared, goalsComplete, initGoals } from './goals';

describe('goals', () => {
  it('initializes with zero collected', () => {
    const s = initGoals([{ type: 'collect', color: 'red', count: 10 }]);
    expect(s).toEqual([{ goal: { type: 'collect', color: 'red', count: 10 }, collected: 0 }]);
  });

  it('accumulates cleared pieces of the right color, capped at count', () => {
    let s = initGoals([{ type: 'collect', color: 'red', count: 5 }]);
    s = applyCleared(s, { red: 3, blue: 4 });
    expect(s[0]!.collected).toBe(3);
    s = applyCleared(s, { red: 4 });
    expect(s[0]!.collected).toBe(5);
  });

  it('is complete only when all goals are met', () => {
    let s = initGoals([
      { type: 'collect', color: 'red', count: 2 },
      { type: 'collect', color: 'blue', count: 2 },
    ]);
    s = applyCleared(s, { red: 2 });
    expect(goalsComplete(s)).toBe(false);
    s = applyCleared(s, { blue: 2 });
    expect(goalsComplete(s)).toBe(true);
  });

  it('does not mutate the input state', () => {
    const s = initGoals([{ type: 'collect', color: 'red', count: 5 }]);
    applyCleared(s, { red: 3 });
    expect(s[0]!.collected).toBe(0);
  });
});
