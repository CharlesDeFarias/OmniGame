import { generateLevel } from './level';
import type { JetEvent, JetLevelDef, JetState } from './types';

/** Physics (y units/second; y in [0,1] top-to-bottom). */
export const GRAVITY = 1.4;
export const THRUST = -2.6;
export const MAX_VY = 1.6;
/** Forward speed, meters/second. */
export const SPEED = 26;
export const START_HEARTS = 3;
export const INVINCIBLE_SECONDS = 1.5;
/** Collision half-extents: player radius in y units / meters. */
const PLAYER_RY = 0.045;
export const PLAYER_RD = 2.2;
const COIN_RY = 0.05;
const COIN_RD = 2.4;

export function startRun(level: JetLevelDef): JetState {
  const { obstacles, coins } = generateLevel(level);
  return {
    level,
    obstacles,
    coins,
    y: 0.5,
    vy: 0,
    dist: 0,
    collected: 0,
    hearts: START_HEARTS,
    invincibleFor: 0,
    status: 'flying',
  };
}

/** Stars: untouched run = 3; else by coin share (>=80% -> 3, >=50% -> 2, else 1). */
export function starsForRun(state: JetState): 1 | 2 | 3 {
  const total = state.coins.length;
  const share = total === 0 ? 1 : state.collected / total;
  if (state.hearts === START_HEARTS || share >= 0.8) return 3;
  if (share >= 0.5) return 2;
  return 1;
}

/**
 * Advance the run by dt seconds with the thrust button held or not.
 * Mutates nothing: returns the next state + events.
 *
 * dt contract: callers must clamp dt to <= 1/20s (the renderer does). At that
 * cap the player moves 1.3m/step against the 4.4m-wide obstacle window, so a
 * bar always gets sampled at least 3 times — larger dt can tunnel.
 */
export function step(state: JetState, dt: number, holding: boolean): { state: JetState; events: JetEvent[] } {
  if (state.status !== 'flying') return { state, events: [] };
  const events: JetEvent[] = [];
  let vy = state.vy + (holding ? THRUST : GRAVITY) * dt;
  vy = Math.max(-MAX_VY, Math.min(MAX_VY, vy));
  let y = state.y + vy * dt;
  if (y <= 0) { y = 0; vy = Math.max(0, vy); }
  if (y >= 1) { y = 1; vy = Math.min(0, vy); }
  const dist = state.dist + SPEED * dt;
  let invincibleFor = Math.max(0, state.invincibleFor - dt);
  let hearts = state.hearts;
  let hitObstacle = -1;
  if (invincibleFor === 0) {
    for (let i = 0; i < state.obstacles.length; i++) {
      const o = state.obstacles[i]!;
      if (Math.abs(o.d - dist) > PLAYER_RD) continue;
      if (y >= o.top - PLAYER_RY && y <= o.bottom + PLAYER_RY) {
        hitObstacle = i;
        break;
      }
    }
  }
  let coins = state.coins;
  let collected = state.collected;
  const taken: number[] = [];
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i]!;
    if (c.taken) continue;
    if (Math.abs(c.d - dist) <= COIN_RD && Math.abs(c.y - y) <= COIN_RY + PLAYER_RY) taken.push(i);
  }
  if (taken.length > 0) {
    coins = coins.slice();
    for (const i of taken) {
      coins[i] = { ...coins[i]!, taken: true };
      collected += 1;
      events.push({ type: 'coin', index: i });
    }
  }
  if (hitObstacle >= 0) {
    hearts -= 1;
    invincibleFor = INVINCIBLE_SECONDS;
    events.push({ type: 'hit', obstacle: hitObstacle, heartsLeft: hearts });
  }
  let status: JetState['status'] = 'flying';
  if (dist >= state.level.length) {
    status = 'finished';
    events.push({ type: 'finish', coins: collected, hearts });
  } else if (hearts <= 0) {
    // Never-strand: hearts out ends the run HERE with everything kept.
    status = 'expired';
    events.push({ type: 'expired', coins: collected, dist });
  }
  return {
    state: { ...state, y, vy, dist, coins, collected, hearts, invincibleFor, status },
    events,
  };
}
