import type { EnemyPolicy, Owner, TowerDef, TowerLevelDef } from './types';

export class TowerLevelError extends Error {
  override name = 'TowerLevelError';
}

function fail(msg: string): never {
  throw new TowerLevelError(msg);
}

const OWNERS: readonly Owner[] = ['player', 'enemy', 'neutral'];
const POLICIES: readonly EnemyPolicy[] = ['passive', 'defensive', 'aggressive'];

function parseTower(input: unknown, where: string): TowerDef {
  if (typeof input !== 'object' || input === null) fail(`${where}: tower must be an object`);
  const t = input as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id.length === 0) fail(`${where}: id must be a non-empty string`);
  if (!OWNERS.includes(t.owner as Owner)) fail(`${where}: owner invalid: ${String(t.owner)}`);
  if (!Number.isInteger(t.maxTroops) || (t.maxTroops as number) < 1 || (t.maxTroops as number) > 999) {
    fail(`${where}: maxTroops must be an integer 1-999, got ${String(t.maxTroops)}`);
  }
  if (!Number.isInteger(t.troops) || (t.troops as number) < 0 || (t.troops as number) > (t.maxTroops as number)) {
    fail(`${where}: troops must be an integer 0-maxTroops, got ${String(t.troops)}`);
  }
  if (!Number.isInteger(t.growthPerTick) || (t.growthPerTick as number) < 0 || (t.growthPerTick as number) > 20) {
    fail(`${where}: growthPerTick must be an integer 0-20, got ${String(t.growthPerTick)}`);
  }
  if (typeof t.x !== 'number' || t.x < 0 || t.x > 100) fail(`${where}: x must be a number 0-100, got ${String(t.x)}`);
  if (typeof t.y !== 'number' || t.y < 0 || t.y > 100) fail(`${where}: y must be a number 0-100, got ${String(t.y)}`);
  return {
    id: t.id,
    owner: t.owner as Owner,
    troops: t.troops as number,
    growthPerTick: t.growthPerTick as number,
    maxTroops: t.maxTroops as number,
    x: t.x,
    y: t.y,
  };
}

export function parseTowerLevel(input: unknown): TowerLevelDef {
  if (typeof input !== 'object' || input === null) fail('level must be an object');
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) fail('id must be a non-empty string');
  if (typeof o.seed !== 'number' || !Number.isInteger(o.seed)) fail('seed must be an integer');
  if (!Array.isArray(o.towers)) fail('towers must be an array');
  if (o.towers.length < 3 || o.towers.length > 9) fail(`towers must have 3-9 entries, got ${o.towers.length}`);
  const towers = o.towers.map((t: unknown, i: number) => parseTower(t, `towers[${i}]`));
  const ids = new Set<string>();
  for (const t of towers) {
    if (ids.has(t.id)) fail(`duplicate tower id: ${t.id}`);
    ids.add(t.id);
  }
  if (!Array.isArray(o.edges)) fail('edges must be an array');
  const seen = new Set<string>();
  const edges: Array<[string, string]> = o.edges.map((e: unknown, i: number) => {
    const where = `edges[${i}]`;
    if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || typeof e[1] !== 'string') {
      fail(`${where} must be a pair of tower ids`);
    }
    const [a, b] = e as [string, string];
    if (a === b) fail(`${where}: self-loop edges are not allowed (${a})`);
    for (const id of [a, b]) if (!ids.has(id)) fail(`${where}: unknown tower id: ${id}`);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) fail(`${where}: duplicate edge ${a}-${b}`);
    seen.add(key);
    return [a, b];
  });
  // Connectivity: every tower reachable from the first over symmetric edges.
  const first = towers[0];
  if (first !== undefined) {
    const reached = new Set<string>([first.id]);
    const queue = [first.id];
    while (queue.length > 0) {
      const cur = queue.pop() as string;
      for (const [a, b] of edges) {
        const other = a === cur ? b : b === cur ? a : null;
        if (other !== null && !reached.has(other)) {
          reached.add(other);
          queue.push(other);
        }
      }
    }
    if (reached.size !== towers.length) fail('graph must be connected: some towers are unreachable');
  }
  if (!towers.some((t) => t.owner === 'player')) fail('level needs at least one player tower at start');
  if (!towers.some((t) => t.owner === 'enemy')) fail('level needs at least one enemy tower at start');
  if (!POLICIES.includes(o.enemyPolicy as EnemyPolicy)) fail(`enemyPolicy invalid: ${String(o.enemyPolicy)}`);
  if (!Number.isInteger(o.maxTicks) || (o.maxTicks as number) < 60 || (o.maxTicks as number) > 600) {
    fail(`maxTicks must be an integer 60-600, got ${String(o.maxTicks)}`);
  }
  return { id: o.id, seed: o.seed, towers, edges, enemyPolicy: o.enemyPolicy as EnemyPolicy, maxTicks: o.maxTicks as number };
}
