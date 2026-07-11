import { createRng } from '../rng';
import type { Coin, JetLevelDef, Obstacle } from './types';

/** Shipped runs: longer + busier each (spec 2026-07-10). */
export const JET_LEVELS: readonly JetLevelDef[] = [
  { id: 'jet-1', seed: 7101, length: 300 },
  { id: 'jet-2', seed: 7102, length: 450 },
  { id: 'jet-3', seed: 7103, length: 600 },
] as const;

const FIRST_OBSTACLE_AT = 40;
export const OBSTACLE_EVERY = 34;
/** The flyable gap is always at least this tall — generous for one-button play. */
const MIN_GAP = 0.42;
/** Every bar blocks at least this much sky, so it is always clearly visible. */
export const MIN_BAR = 0.12;
const COINS_PER_RUN = 4;

/**
 * Deterministic layout from the level seed: a zap bar every ~34m whose gap
 * wanders, with a line of coins threading each gap (collecting teaches the
 * safe path) plus arcs between bars.
 */
export function generateLevel(def: JetLevelDef): { obstacles: Obstacle[]; coins: Coin[] } {
  const rng = createRng(def.seed);
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  for (let d = FIRST_OBSTACLE_AT; d <= def.length - 30; d += OBSTACLE_EVERY) {
    const gapCenter = 0.2 + rng.next() * 0.6;
    const gapHalf = (MIN_GAP + rng.next() * 0.18) / 2;
    // The bar blocks either above or below the gap, never both: one-sided
    // bars keep the "fly around it" read simple. MIN_BAR guards against
    // degenerate near-invisible bars at the rails (review: 9% of raw draws
    // collapsed to zero height while still colliding — unfair hits from
    // nothing visible, exactly where one-button players saturate).
    const fromTop = rng.next() < 0.5;
    obstacles.push(
      fromTop
        ? { d, top: 0, bottom: Math.max(MIN_BAR, gapCenter - gapHalf) }
        : { d, top: Math.min(1 - MIN_BAR, gapCenter + gapHalf), bottom: 1 },
    );
    // Coins thread the safe gap at the bar...
    for (let i = 0; i < COINS_PER_RUN; i++) {
      coins.push({ d: d - 6 + i * 4, y: gapCenter, taken: false });
    }
    // ...and a gentle arc floats midway to the next bar.
    const arcCenter = 0.25 + rng.next() * 0.5;
    for (let i = 0; i < 3; i++) {
      coins.push({ d: d + OBSTACLE_EVERY / 2 - 4 + i * 4, y: arcCenter + (i === 1 ? -0.06 : 0), taken: false });
    }
  }
  return { obstacles, coins };
}
