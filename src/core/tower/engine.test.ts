import { describe, expect, it } from 'vitest';
import { canOrder, order, startTower, tick } from './index';
import type { Owner, TowerLevelDef, TowerState } from './index';

const tw = (id: string, owner: Owner, troops: number, growthPerTick = 1, maxTroops = 50) => ({
  id,
  owner,
  troops,
  growthPerTick,
  maxTroops,
  x: 50,
  y: 50,
});

const lvl = (partial: Partial<TowerLevelDef> = {}): TowerLevelDef => ({
  id: 'test',
  seed: 1,
  towers: [tw('a', 'player', 10), tw('b', 'neutral', 4, 0), tw('c', 'enemy', 10)],
  edges: [['a', 'b'], ['b', 'c']],
  enemyPolicy: 'passive',
  maxTicks: 60,
  ...partial,
});

const troopsOf = (s: TowerState, id: string): number => {
  const t = s.towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no tower ${id}`);
  return t.troops;
};
const ownerOf = (s: TowerState, id: string): Owner => {
  const t = s.towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no tower ${id}`);
  return t.owner;
};

describe('tower engine', () => {
  it('startTower snapshots towers, no armies, tick 0, rng seeded from the level', () => {
    const s = startTower(lvl());
    expect(s.levelId).toBe('test');
    expect(s.towers).toEqual([
      { id: 'a', owner: 'player', troops: 10 },
      { id: 'b', owner: 'neutral', troops: 4 },
      { id: 'c', owner: 'enemy', troops: 10 },
    ]);
    expect(s.armies).toEqual([]);
    expect(s.tick).toBe(0);
    expect(s.done).toBe(false);
    expect(s.won).toBe(false);
  });

  it('order sends floor(half) along an edge as a 2-tick army and emits sent', () => {
    const level = lvl();
    const s = startTower(level);
    const r = order(s, level, 'a', 'b');
    expect(troopsOf(r.state, 'a')).toBe(5);
    expect(r.state.armies).toEqual([{ owner: 'player', from: 'a', to: 'b', troops: 5, ticksRemaining: 2 }]);
    expect(r.events).toEqual([{ type: 'sent', from: 'a', to: 'b', owner: 'player', troops: 5 }]);
    // odd counts: floor(9/2) = 4 leaves 5
    const s9 = { ...s, towers: s.towers.map((t) => (t.id === 'a' ? { ...t, troops: 9 } : t)) };
    const r9 = order(s9, level, 'a', 'b');
    expect(troopsOf(r9.state, 'a')).toBe(5);
    expect(r9.state.armies[0]?.troops).toBe(4);
  });

  it('order rejects non-player source, missing edge, and troops < 2 (inert, no events)', () => {
    const level = lvl();
    const s = startTower(level);
    expect(canOrder(s, level, 'c', 'b')).toBe(false); // enemy-owned
    expect(canOrder(s, level, 'a', 'c')).toBe(false); // no edge a-c
    const weak = { ...s, towers: s.towers.map((t) => (t.id === 'a' ? { ...t, troops: 1 } : t)) };
    expect(canOrder(weak, level, 'a', 'b')).toBe(false);
    for (const [from, to] of [['c', 'b'], ['a', 'c']] as const) {
      const r = order(s, level, from, to);
      expect(r.events).toEqual([]);
      expect(r.state).toEqual(s);
    }
  });

  it('order and tick never mutate their input state', () => {
    const level = lvl();
    const s = startTower(level);
    const frozen = JSON.stringify(s);
    order(s, level, 'a', 'b');
    tick(s, level);
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('tick grows owned towers by growthPerTick capped at maxTroops; neutral towers never grow', () => {
    const level = lvl({
      towers: [tw('a', 'player', 49, 3, 50), tw('b', 'neutral', 4, 5), tw('c', 'enemy', 10, 2)],
    });
    const r = tick(startTower(level), level);
    expect(troopsOf(r.state, 'a')).toBe(50); // capped
    expect(troopsOf(r.state, 'b')).toBe(4); // neutral: no growth despite growthPerTick 5
    expect(troopsOf(r.state, 'c')).toBe(12);
    expect(r.state.tick).toBe(1);
  });

  it('a friendly arrival merges and emits arrived/reinforced', () => {
    const level = lvl({ towers: [tw('a', 'player', 10, 0), tw('b', 'player', 3, 0), tw('c', 'enemy', 10, 0)] });
    let s = order(startTower(level), level, 'a', 'b').state;
    s = tick(s, level).state; // travel 2 -> 1
    const r = tick(s, level); // arrives
    expect(troopsOf(r.state, 'b')).toBe(8);
    expect(r.state.armies).toEqual([]);
    expect(r.events).toContainEqual({ type: 'arrived', to: 'b', owner: 'player', result: 'reinforced' });
  });

  it('attackers exceeding defenders capture the tower with the remainder', () => {
    const level = lvl({ towers: [tw('a', 'player', 10, 0), tw('b', 'neutral', 2, 0), tw('c', 'enemy', 10, 0)] });
    let s = order(startTower(level), level, 'a', 'b').state; // 5 attackers vs 2
    s = tick(s, level).state;
    const r = tick(s, level);
    expect(ownerOf(r.state, 'b')).toBe('player');
    expect(troopsOf(r.state, 'b')).toBe(3);
    expect(r.events).toContainEqual({ type: 'arrived', to: 'b', owner: 'player', result: 'captured' });
  });

  it('attackers short of the defenders are absorbed (defended)', () => {
    const level = lvl({ towers: [tw('a', 'player', 6, 0), tw('b', 'neutral', 9, 0), tw('c', 'enemy', 10, 0)] });
    let s = order(startTower(level), level, 'a', 'b').state; // 3 vs 9
    s = tick(s, level).state;
    const r = tick(s, level);
    expect(ownerOf(r.state, 'b')).toBe('neutral');
    expect(troopsOf(r.state, 'b')).toBe(6);
    expect(r.events).toContainEqual({ type: 'arrived', to: 'b', owner: 'player', result: 'defended' });
  });

  it('an exact tie neutralizes the tower at 0 troops', () => {
    const level = lvl({ towers: [tw('a', 'player', 10, 0), tw('b', 'enemy', 5, 0), tw('c', 'enemy', 10, 0)], edges: [['a', 'b'], ['b', 'c']] });
    let s = order(startTower(level), level, 'a', 'b').state; // 5 vs 5
    s = tick(s, level).state;
    const r = tick(s, level);
    expect(ownerOf(r.state, 'b')).toBe('neutral');
    expect(troopsOf(r.state, 'b')).toBe(0);
    expect(r.events).toContainEqual({ type: 'arrived', to: 'b', owner: 'player', result: 'neutralized' });
  });

  it('winning = every tower player-owned; gameOver fires once and later ticks are inert', () => {
    const level = lvl({ towers: [tw('a', 'player', 20, 0), tw('b', 'player', 5, 0), tw('c', 'enemy', 2, 0)], edges: [['a', 'b'], ['b', 'c'], ['a', 'c']] });
    let s = order(startTower(level), level, 'a', 'c').state; // 10 vs 2
    s = tick(s, level).state;
    const r = tick(s, level);
    expect(r.state.done).toBe(true);
    expect(r.state.won).toBe(true);
    expect(r.events).toContainEqual({ type: 'gameOver', won: true });
    const after = tick(r.state, level);
    expect(after.events).toEqual([]);
    expect(after.state).toEqual(r.state);
  });

  it('losing = player owns nothing AND has no armies in flight', () => {
    // Player owns nothing from the start once its only tower is enemy-held.
    const level = lvl({ towers: [tw('a', 'player', 2, 0), tw('b', 'enemy', 30, 5), tw('c', 'enemy', 10, 0)] });
    let s = order(startTower(level), level, 'a', 'b').state; // 1 attacker vs 30: doomed
    // hand tower a to the enemy to simulate a lost home base
    s = { ...s, towers: s.towers.map((t) => (t.id === 'a' ? { ...t, owner: 'enemy' as const } : t)) };
    const t1 = tick(s, level); // army still in flight -> not done
    expect(t1.state.done).toBe(false);
    const t2 = tick(t1.state, level); // army arrives, is absorbed -> loss
    expect(t2.state.done).toBe(true);
    expect(t2.state.won).toBe(false);
    expect(t2.events).toContainEqual({ type: 'arrived', to: 'b', owner: 'player', result: 'defended' });
    expect(t2.events).toContainEqual({ type: 'gameOver', won: false });
  });

  it('a last-army capture keeps the game alive past owning zero towers', () => {
    const level = lvl({ towers: [tw('a', 'player', 10, 0), tw('b', 'neutral', 1, 0), tw('c', 'enemy', 10, 0)] });
    let s = order(startTower(level), level, 'a', 'b').state; // 5 vs 1
    s = { ...s, towers: s.towers.map((t) => (t.id === 'a' ? { ...t, owner: 'enemy' as const } : t)) };
    let r = tick(s, level);
    expect(r.state.done).toBe(false);
    r = tick(r.state, level);
    expect(ownerOf(r.state, 'b')).toBe('player');
    expect(r.state.done).toBe(false); // captured a foothold — game continues
  });

  it('timeout is generous: at maxTicks the player loses only if the enemy owns MORE towers', () => {
    // equal counts (1 player, 1 enemy, 1 neutral) -> win
    const equal = lvl({ maxTicks: 60 });
    let s = startTower(equal);
    while (!s.done) s = tick(s, equal).state;
    expect(s.tick).toBe(60);
    expect(s.won).toBe(true);
    // enemy ahead (2 enemy towers) -> loss
    const behind = lvl({ towers: [tw('a', 'player', 10), tw('b', 'enemy', 4, 0), tw('c', 'enemy', 10)], maxTicks: 60 });
    let s2 = startTower(behind);
    while (!s2.done) s2 = tick(s2, behind).state;
    expect(s2.won).toBe(false);
  });

  it('passive enemies never send', () => {
    const level = lvl({ maxTicks: 60 });
    let s = startTower(level);
    for (let i = 0; i < 59; i++) {
      const r = tick(s, level);
      expect(r.state.armies).toEqual([]);
      s = r.state;
    }
  });

  it('defensive enemies reinforce their weakest tower only while a player army flies at enemy territory', () => {
    const level = lvl({
      towers: [tw('a', 'player', 20, 0), tw('b', 'enemy', 3, 0), tw('c', 'enemy', 12, 0)],
      edges: [['a', 'b'], ['b', 'c']],
      enemyPolicy: 'defensive',
      maxTicks: 60,
    });
    // no threat: no enemy sends
    const calm = tick(startTower(level), level);
    expect(calm.state.armies).toEqual([]);
    // player attacks b -> enemy reinforces weakest (b) from its neighbor c
    const attacked = order(startTower(level), level, 'a', 'b');
    const r = tick(attacked.state, level);
    const enemySends = r.events.filter((e) => e.type === 'sent' && e.owner === 'enemy');
    expect(enemySends).toEqual([{ type: 'sent', from: 'c', to: 'b', owner: 'enemy', troops: 6 }]);
  });

  it('aggressive enemies send every 6 ticks from their strongest tower to the weakest adjacent non-enemy tower', () => {
    const level = lvl({
      towers: [tw('a', 'player', 10, 0), tw('b', 'neutral', 3, 0), tw('c', 'enemy', 20, 0)],
      enemyPolicy: 'aggressive',
      maxTicks: 60,
    });
    let s = startTower(level);
    for (let i = 1; i <= 5; i++) {
      const r = tick(s, level);
      expect(r.events.filter((e) => e.type === 'sent')).toEqual([]);
      s = r.state;
    }
    const sixth = tick(s, level);
    expect(sixth.events).toContainEqual({ type: 'sent', from: 'c', to: 'b', owner: 'enemy', troops: 10 });
  });

  it('runs are deterministic: identical order/tick sequences produce identical states and events', () => {
    const level = lvl({ enemyPolicy: 'aggressive', maxTicks: 60 });
    const play = (): { states: string[]; events: string[] } => {
      const states: string[] = [];
      const events: string[] = [];
      let s = order(startTower(level), level, 'a', 'b').state;
      while (!s.done) {
        const r = tick(s, level);
        s = r.state;
        states.push(JSON.stringify(s));
        events.push(JSON.stringify(r.events));
      }
      return { states, events };
    };
    expect(play()).toEqual(play());
  });
});
