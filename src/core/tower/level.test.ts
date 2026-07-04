import { describe, expect, it } from 'vitest';
import { TowerLevelError, parseTowerLevel } from './index';

const tower = (id: string, owner: string, troops = 10, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  owner,
  troops,
  growthPerTick: 1,
  maxTroops: 50,
  x: 50,
  y: 50,
  ...extra,
});

const valid = (): Record<string, unknown> => ({
  id: 't-test',
  seed: 7,
  towers: [tower('a', 'player'), tower('b', 'neutral', 5), tower('c', 'enemy')],
  edges: [['a', 'b'], ['b', 'c']],
  enemyPolicy: 'passive',
  maxTicks: 120,
});

describe('parseTowerLevel', () => {
  it('parses a valid level and preserves fields', () => {
    const level = parseTowerLevel(valid());
    expect(level.id).toBe('t-test');
    expect(level.towers).toHaveLength(3);
    expect(level.edges).toEqual([['a', 'b'], ['b', 'c']]);
    expect(level.enemyPolicy).toBe('passive');
    expect(level.maxTicks).toBe(120);
    expect(level.towers[1]).toEqual({ id: 'b', owner: 'neutral', troops: 5, growthPerTick: 1, maxTroops: 50, x: 50, y: 50 });
  });

  it('rejects fewer than 3 or more than 9 towers', () => {
    const two = valid();
    two.towers = [tower('a', 'player'), tower('c', 'enemy')];
    two.edges = [['a', 'c']];
    expect(() => parseTowerLevel(two)).toThrow(TowerLevelError);
    const ten = valid();
    const many = [tower('a', 'player'), tower('c', 'enemy')];
    const edges: Array<[string, string]> = [['a', 'c']];
    for (let i = 0; i < 8; i++) {
      many.push(tower(`n${i}`, 'neutral'));
      edges.push(['a', `n${i}`]);
    }
    ten.towers = many;
    ten.edges = edges;
    expect(() => parseTowerLevel(ten)).toThrow(/3-9/);
  });

  it('rejects a disconnected graph', () => {
    const o = valid();
    o.towers = [tower('a', 'player'), tower('b', 'neutral'), tower('c', 'enemy'), tower('d', 'neutral')];
    o.edges = [['a', 'b'], ['c', 'd']];
    expect(() => parseTowerLevel(o)).toThrow(/connected/);
  });

  it('requires at least one player and one enemy tower', () => {
    const noEnemy = valid();
    noEnemy.towers = [tower('a', 'player'), tower('b', 'neutral'), tower('c', 'neutral')];
    expect(() => parseTowerLevel(noEnemy)).toThrow(/enemy/);
    const noPlayer = valid();
    noPlayer.towers = [tower('a', 'neutral'), tower('b', 'neutral'), tower('c', 'enemy')];
    expect(() => parseTowerLevel(noPlayer)).toThrow(/player/);
  });

  it('rejects positions outside 0-100', () => {
    const o = valid();
    o.towers = [tower('a', 'player', 10, { x: 101 }), tower('b', 'neutral'), tower('c', 'enemy')];
    expect(() => parseTowerLevel(o)).toThrow(/x/);
    const p = valid();
    p.towers = [tower('a', 'player', 10, { y: -1 }), tower('b', 'neutral'), tower('c', 'enemy')];
    expect(() => parseTowerLevel(p)).toThrow(/y/);
  });

  it('rejects maxTicks outside 60-600 and unknown enemy policies', () => {
    const low = valid();
    low.maxTicks = 59;
    expect(() => parseTowerLevel(low)).toThrow(/maxTicks/);
    const high = valid();
    high.maxTicks = 601;
    expect(() => parseTowerLevel(high)).toThrow(/maxTicks/);
    const pol = valid();
    pol.enemyPolicy = 'sneaky';
    expect(() => parseTowerLevel(pol)).toThrow(/enemyPolicy/);
  });

  it('rejects duplicate tower ids, self-loop edges, unknown edge ids, and duplicate edges', () => {
    const dup = valid();
    dup.towers = [tower('a', 'player'), tower('a', 'neutral'), tower('c', 'enemy')];
    expect(() => parseTowerLevel(dup)).toThrow(/duplicate/i);
    const self = valid();
    self.edges = [['a', 'a'], ['a', 'b'], ['b', 'c']];
    expect(() => parseTowerLevel(self)).toThrow(/self/i);
    const unknown = valid();
    unknown.edges = [['a', 'b'], ['b', 'zz']];
    expect(() => parseTowerLevel(unknown)).toThrow(/zz/);
    const dupEdge = valid();
    dupEdge.edges = [['a', 'b'], ['b', 'c'], ['b', 'a']];
    expect(() => parseTowerLevel(dupEdge)).toThrow(/duplicate/i);
  });

  it('rejects troops above maxTroops and out-of-range numeric fields', () => {
    const over = valid();
    over.towers = [tower('a', 'player', 60), tower('b', 'neutral'), tower('c', 'enemy')];
    expect(() => parseTowerLevel(over)).toThrow(/maxTroops/);
    const growth = valid();
    growth.towers = [tower('a', 'player', 10, { growthPerTick: -1 }), tower('b', 'neutral'), tower('c', 'enemy')];
    expect(() => parseTowerLevel(growth)).toThrow(/growthPerTick/);
  });
});
