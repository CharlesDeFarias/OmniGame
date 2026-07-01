export interface RNG {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** Opaque serializable state (uint32) for snapshots/branching simulations. */
  getState(): number;
  setState(state: number): void;
}

export function createRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);
  const pick = <T,>(items: readonly T[]): T => {
    const item = items[int(items.length)];
    if (item === undefined && items.length === 0) throw new Error('pick from empty array');
    return item as T;
  };
  const getState = (): number => a;
  const setState = (state: number): void => { a = state >>> 0; };
  return { next, int, pick, getState, setState };
}
