import { canOrder, createRng, neighbors, order, startTower, tick } from '../core/tower/index';
import type { RNG, TowerLevelDef, TowerState } from '../core/tower/index';

export interface TowerOrder {
  from: string;
  to: string;
}

/** A policy runs between ticks and may issue any number of orders (both ship 0 or 1). */
export type SendPolicy = (state: TowerState, level: TowerLevelDef) => TowerOrder[];

const troopsOf = (state: TowerState, id: string): number => {
  const t = state.towers.find((x) => x.id === id);
  return t === undefined ? 0 : t.troops;
};
const ownerOf = (state: TowerState, id: string): string => {
  const t = state.towers.find((x) => x.id === id);
  return t === undefined ? 'neutral' : t.owner;
};

/** Sends on ~1 tick in 4: picks uniformly among all engine-legal (from, to) pairs. */
export function randomSend(rng: RNG): SendPolicy {
  return (state, level) => {
    if (rng.next() >= 0.25) return [];
    const options: TowerOrder[] = [];
    for (const t of state.towers) {
      for (const to of neighbors(level, t.id)) {
        if (canOrder(state, level, t.id, to)) options.push({ from: t.id, to });
      }
    }
    return options.length === 0 ? [] : [rng.pick(options)];
  };
}

/** Expected defenders when a send launched NOW lands (2 ticks out): current garrison,
 *  plus 2 ticks of growth for owned targets, plus friendly reinforcements already in
 *  flight, minus player armies already inbound. Negative = already falling — skip it. */
function defenseEstimate(state: TowerState, level: TowerLevelDef, id: string): number {
  const def = level.towers.find((t) => t.id === id);
  const owner = ownerOf(state, id);
  let est = troopsOf(state, id);
  if (owner !== 'neutral' && def !== undefined) {
    est += Math.min(def.maxTroops - troopsOf(state, id), def.growthPerTick * 2);
  }
  for (const a of state.armies) {
    if (a.to !== id) continue;
    est += a.owner === owner ? a.troops : a.owner === 'player' ? -a.troops : a.troops;
  }
  return est;
}

/** BFS hops from each tower to the nearest non-player tower (0 for the frontier itself). */
function frontierDistances(state: TowerState, level: TowerLevelDef): Map<string, number> {
  const dist = new Map<string, number>();
  const queue: string[] = [];
  for (const t of state.towers) {
    if (t.owner !== 'player') {
      dist.set(t.id, 0);
      queue.push(t.id);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const d = dist.get(cur) as number;
    for (const n of neighbors(level, cur)) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

/** Each tick: take the best winnable capture (half > defense estimate, max margin);
 *  otherwise funnel troops from rear towers toward the frontier. Ties break on the
 *  seeded rng, so runs are deterministic per seed. */
export function greedySend(rng: RNG): SendPolicy {
  return (state, level) => {
    let bestMargin = 0;
    let best: TowerOrder[] = [];
    for (const t of state.towers) {
      if (t.owner !== 'player' || t.troops < 2) continue;
      const half = Math.floor(t.troops / 2);
      for (const to of neighbors(level, t.id)) {
        if (ownerOf(state, to) === 'player') continue;
        const est = defenseEstimate(state, level, to);
        if (est < 0) continue; // already being captured by an in-flight army
        const margin = half - est;
        if (margin <= 0) continue;
        if (margin > bestMargin) {
          bestMargin = margin;
          best = [{ from: t.id, to }];
        } else if (margin === bestMargin) {
          best.push({ from: t.id, to });
        }
      }
    }
    if (best.length > 0) return [rng.pick(best)];
    // Reinforce: strongest rear tower ships half one hop closer to the frontier.
    const dist = frontierDistances(state, level);
    const rear = state.towers.filter(
      (t) => t.owner === 'player' && t.troops >= 2 && (dist.get(t.id) ?? 0) >= 2,
    );
    if (rear.length === 0) return [];
    const most = Math.max(...rear.map((t) => t.troops));
    const from = rng.pick(rear.filter((t) => t.troops === most)).id;
    const fromDist = dist.get(from) ?? 0;
    const closer = neighbors(level, from).filter(
      (n) => ownerOf(state, n) === 'player' && (dist.get(n) ?? Infinity) < fromDist,
    );
    if (closer.length === 0) return [];
    const nearest = Math.min(...closer.map((n) => dist.get(n) ?? Infinity));
    return [{ from, to: rng.pick(closer.filter((n) => dist.get(n) === nearest)) }];
  };
}

export interface TowerRunResult {
  won: boolean;
  ticks: number;
}

/** Drives a full game headlessly. maxTicks forces gameOver, so this always terminates. */
export function runTower(level: TowerLevelDef, policy: SendPolicy): TowerRunResult {
  let state = startTower(level);
  while (!state.done) {
    for (const o of policy(state, level)) {
      state = order(state, level, o.from, o.to).state;
    }
    state = tick(state, level).state;
  }
  return { won: state.won, ticks: state.tick };
}

export interface TowerSimStats {
  runs: number;
  winRate: number;
  avgTicks: number;
}

/** Fixed seed schedule derived from the level seed — fully deterministic. */
export function simulateTower(
  level: TowerLevelDef,
  runs: number,
  makePolicy: (rng: RNG) => SendPolicy,
): TowerSimStats {
  let wins = 0;
  let totalTicks = 0;
  for (let i = 0; i < runs; i++) {
    const r = runTower(level, makePolicy(createRng(level.seed + i * 7919)));
    if (r.won) wins++;
    totalTicks += r.ticks;
  }
  return { runs, winRate: wins / runs, avgTicks: totalTicks / runs };
}
