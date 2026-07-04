import { createRng } from '../rng';
import type { RNG } from '../rng';
import type { Army, ArmyOwner, TowerEvent, TowerLevelDef, TowerSnapshot, TowerState } from './types';

export function startTower(level: TowerLevelDef): TowerState {
  return {
    levelId: level.id,
    towers: level.towers.map((t) => ({ id: t.id, owner: t.owner, troops: t.troops })),
    armies: [],
    tick: 0,
    rngState: createRng(level.seed).getState(),
    done: false,
    won: false,
  };
}

function cloneState(state: TowerState): TowerState {
  return { ...state, towers: state.towers.map((t) => ({ ...t })), armies: state.armies.map((a) => ({ ...a })) };
}

function towerIn(towers: TowerSnapshot[], id: string): TowerSnapshot {
  const t = towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`unknown tower id: ${id}`); // unreachable on validated levels
  return t;
}

export function hasEdge(level: TowerLevelDef, a: string, b: string): boolean {
  return level.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Ids adjacent to `id` over the symmetric edge list. Shared by AI and sim policies. */
export function neighbors(level: TowerLevelDef, id: string): string[] {
  const out: string[] = [];
  for (const [a, b] of level.edges) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

/** Player-order validity: player owns `from`, an edge exists, and there are >= 2 troops
 *  (a send is floor(half), so below 2 there is nothing to send). Single-sourced for the
 *  engine, the future drag UX, and the sim policies. */
export function canOrder(state: TowerState, level: TowerLevelDef, from: string, to: string): boolean {
  if (state.done) return false;
  const t = state.towers.find((x) => x.id === from);
  return t !== undefined && t.owner === 'player' && t.troops >= 2 && hasEdge(level, from, to);
}

/** Shared send mechanics: half the garrison (floor) leaves as a 2-tick army. Mutates in place
 *  (internal — public entry points copy first). */
function launch(towers: TowerSnapshot[], armies: Army[], events: TowerEvent[], owner: ArmyOwner, from: string, to: string): void {
  const src = towerIn(towers, from);
  const troops = Math.floor(src.troops / 2);
  src.troops -= troops;
  armies.push({ owner, from, to, troops, ticksRemaining: 2 });
  events.push({ type: 'sent', from, to, owner, troops });
}

export interface TowerTickResult {
  state: TowerState;
  events: TowerEvent[];
}

/** Player command between ticks. Invalid orders are inert (fresh copy, no events) so the
 *  renderer can pipe raw drags straight through. */
export function order(state: TowerState, level: TowerLevelDef, from: string, to: string): TowerTickResult {
  const next = cloneState(state);
  if (!canOrder(state, level, from, to)) return { state: next, events: [] };
  const events: TowerEvent[] = [];
  launch(next.towers, next.armies, events, 'player', from, to);
  return { state: next, events };
}

function resolveArrival(towers: TowerSnapshot[], army: Army, events: TowerEvent[]): void {
  const target = towerIn(towers, army.to);
  if (target.owner === army.owner) {
    // Merges may exceed maxTroops; only growth is capped (the surplus just stops growing).
    target.troops += army.troops;
    events.push({ type: 'arrived', to: army.to, owner: army.owner, result: 'reinforced' });
  } else if (army.troops > target.troops) {
    target.troops = army.troops - target.troops;
    target.owner = army.owner;
    events.push({ type: 'arrived', to: army.to, owner: army.owner, result: 'captured' });
  } else if (army.troops < target.troops) {
    target.troops -= army.troops;
    events.push({ type: 'arrived', to: army.to, owner: army.owner, result: 'defended' });
  } else {
    target.owner = 'neutral';
    target.troops = 0;
    events.push({ type: 'arrived', to: army.to, owner: army.owner, result: 'neutralized' });
  }
}

/** Min/max pick with seeded-rng tie-breaks so AI stays deterministic per level seed. */
function pickBy(rng: RNG, ids: string[], keyOf: (id: string) => number, mode: 'min' | 'max'): string | null {
  let bestKey: number | null = null;
  let tied: string[] = [];
  for (const id of ids) {
    const key = keyOf(id);
    if (bestKey === null || (mode === 'min' ? key < bestKey : key > bestKey)) {
      bestKey = key;
      tied = [id];
    } else if (key === bestKey) {
      tied.push(id);
    }
  }
  return tied.length === 0 ? null : rng.pick(tied);
}

function enemyAi(next: TowerState, level: TowerLevelDef, events: TowerEvent[], tickNumber: number): void {
  if (level.enemyPolicy === 'passive') return;
  const rng = createRng(0);
  rng.setState(next.rngState);
  const troopsOf = (id: string): number => towerIn(next.towers, id).troops;
  const ownerOf = (id: string): string => towerIn(next.towers, id).owner;
  if (level.enemyPolicy === 'defensive') {
    // Reinforce the weakest enemy tower while any player army flies at enemy territory.
    const threatened = next.armies.some((a) => a.owner === 'player' && ownerOf(a.to) === 'enemy');
    if (threatened) {
      const enemyIds = next.towers.filter((t) => t.owner === 'enemy').map((t) => t.id);
      const weakest = pickBy(rng, enemyIds, troopsOf, 'min');
      if (weakest !== null) {
        const sources = neighbors(level, weakest).filter((id) => ownerOf(id) === 'enemy' && troopsOf(id) >= 2);
        const source = pickBy(rng, sources, troopsOf, 'max');
        if (source !== null) launch(next.towers, next.armies, events, 'enemy', source, weakest);
      }
    }
  } else if (tickNumber % 6 === 0) {
    // Aggressive: every 6 ticks, strongest able tower attacks its weakest non-enemy neighbor.
    const sources = next.towers
      .filter((t) => t.owner === 'enemy' && t.troops >= 2 && neighbors(level, t.id).some((n) => ownerOf(n) !== 'enemy'))
      .map((t) => t.id);
    const source = pickBy(rng, sources, troopsOf, 'max');
    if (source !== null) {
      const targets = neighbors(level, source).filter((n) => ownerOf(n) !== 'enemy');
      const target = pickBy(rng, targets, troopsOf, 'min');
      if (target !== null) launch(next.towers, next.armies, events, 'enemy', source, target);
    }
  }
  next.rngState = rng.getState();
}

/** One discrete tick — the renderer paces these. Phases, in order:
 *  1. growth: owned towers +growthPerTick, capped at maxTroops (neutrals never grow);
 *  2. travel: every army counts down; at 0 it arrives (same owner merge / bigger force
 *     flips with the remainder / smaller force is absorbed / exact tie neutralizes at 0);
 *  3. enemy AI per level policy (fresh armies start at the full 2-tick travel);
 *  4. terminal check: win = player owns every tower; loss = player owns none AND has no
 *     armies in flight; timeout at maxTicks is generous — loss only if the enemy owns
 *     MORE towers, otherwise a win (Luana layer, decision pending renderer review).
 *  Post-done ticks are inert. Never mutates its input. */
export function tick(state: TowerState, level: TowerLevelDef): TowerTickResult {
  const next = cloneState(state);
  if (next.done) return { state: next, events: [] };
  const events: TowerEvent[] = [];
  const defs = new Map(level.towers.map((t) => [t.id, t]));
  for (const t of next.towers) {
    const def = defs.get(t.id);
    if (def !== undefined && t.owner !== 'neutral' && t.troops < def.maxTroops) {
      t.troops = Math.min(def.maxTroops, t.troops + def.growthPerTick);
    }
  }
  const inFlight: Army[] = [];
  for (const army of next.armies) {
    const advanced = { ...army, ticksRemaining: army.ticksRemaining - 1 };
    if (advanced.ticksRemaining <= 0) resolveArrival(next.towers, advanced, events);
    else inFlight.push(advanced);
  }
  next.armies = inFlight;
  const tickNumber = state.tick + 1;
  enemyAi(next, level, events, tickNumber);
  next.tick = tickNumber;
  const playerCount = next.towers.filter((t) => t.owner === 'player').length;
  const enemyCount = next.towers.filter((t) => t.owner === 'enemy').length;
  if (playerCount === next.towers.length) {
    next.done = true;
    next.won = true;
  } else if (playerCount === 0 && !next.armies.some((a) => a.owner === 'player')) {
    next.done = true;
    next.won = false;
  } else if (tickNumber >= level.maxTicks) {
    next.done = true;
    next.won = !(enemyCount > playerCount);
  }
  if (next.done) events.push({ type: 'gameOver', won: next.won });
  return { state: next, events };
}
