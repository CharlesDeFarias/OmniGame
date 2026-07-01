import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next() is in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(max) is an integer in [0, max)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('pick returns an element of the array', () => {
    const rng = createRng(9);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(arr).toContain(rng.pick(arr));
  });

  it('getState/setState round-trips the sequence', () => {
    const rng = createRng(42);
    rng.next();
    rng.next();
    const s = rng.getState();
    const expected = [rng.next(), rng.next()];
    rng.setState(s);
    expect([rng.next(), rng.next()]).toEqual(expected);
  });

  it('setState transplants state across instances', () => {
    const a = createRng(1);
    a.next();
    const b = createRng(999);
    b.setState(a.getState());
    expect(b.next()).toBe(a.next());
  });
});
