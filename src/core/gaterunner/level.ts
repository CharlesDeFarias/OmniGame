import type { Cell, Column, GateLevelDef } from './types';

export class GateLevelError extends Error {
  override name = 'GateLevelError';
}

function fail(msg: string): never {
  throw new GateLevelError(msg);
}

function parseCell(input: unknown, where: string): Cell {
  if (typeof input !== 'object' || input === null) fail(`${where}: cell must be an object`);
  const c = input as Record<string, unknown>;
  if (c.kind === 'gate') {
    if (c.op === 'add') {
      if (!Number.isInteger(c.value) || (c.value as number) < 1 || (c.value as number) > 50) {
        fail(`${where}: add gate value must be an integer 1-50, got ${String(c.value)}`);
      }
      return { kind: 'gate', op: 'add', value: c.value as number };
    }
    if (c.op === 'mul') {
      if (!Number.isInteger(c.value) || (c.value as number) < 2 || (c.value as number) > 3) {
        fail(`${where}: mul gate value must be an integer 2-3, got ${String(c.value)}`);
      }
      return { kind: 'gate', op: 'mul', value: c.value as number };
    }
    fail(`${where}: gate op invalid: ${String(c.op)}`);
  }
  if (c.kind === 'foe') {
    if (!Number.isInteger(c.count) || (c.count as number) < 1 || (c.count as number) > 200) {
      fail(`${where}: foe count must be an integer 1-200, got ${String(c.count)}`);
    }
    return { kind: 'foe', count: c.count as number };
  }
  if (c.kind === 'wall') return { kind: 'wall' };
  if (c.kind === 'empty') return { kind: 'empty' };
  fail(`${where}: cell kind invalid: ${String(c.kind)}`);
}

export function parseGateLevel(input: unknown): GateLevelDef {
  if (typeof input !== 'object' || input === null) fail('level must be an object');
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) fail('id must be a non-empty string');
  if (typeof o.seed !== 'number' || !Number.isInteger(o.seed)) fail('seed must be an integer');
  if (!Number.isInteger(o.startCount) || (o.startCount as number) < 1 || (o.startCount as number) > 50) {
    fail('startCount must be an integer 1-50');
  }
  if (!Number.isInteger(o.finishBonusPerSquad) || (o.finishBonusPerSquad as number) < 1 || (o.finishBonusPerSquad as number) > 100) {
    fail('finishBonusPerSquad must be an integer 1-100');
  }
  if (!Array.isArray(o.columns)) fail('columns must be an array');
  if (o.columns.length < 5 || o.columns.length > 30) {
    fail(`columns must have 5-30 entries, got ${o.columns.length}`);
  }
  let prevD = -1;
  const columns: Column[] = o.columns.map((colInput: unknown, i: number) => {
    const where = `columns[${i}]`;
    if (typeof colInput !== 'object' || colInput === null) fail(`${where} must be an object`);
    const co = colInput as Record<string, unknown>;
    if (!Number.isInteger(co.d) || (co.d as number) < 0) fail(`${where}.d must be an integer >= 0`);
    if ((co.d as number) <= prevD) {
      fail(`${where}.d must be strictly increasing, got ${String(co.d)} after ${String(prevD)}`);
    }
    prevD = co.d as number;
    if (!Array.isArray(co.lanes) || co.lanes.length !== 3) fail(`${where}.lanes must be an array of exactly 3 cells`);
    const lanes = co.lanes.map((cell, lane) => parseCell(cell, `${where}.lanes[${lane}]`)) as [Cell, Cell, Cell];
    if (!lanes.some((cell) => cell.kind === 'gate' || cell.kind === 'empty')) {
      fail(`${where} is a guaranteed-loss column: at least one lane must be a gate or empty`);
    }
    return { d: co.d as number, lanes };
  });
  return {
    id: o.id,
    seed: o.seed,
    startCount: o.startCount as number,
    columns,
    finishBonusPerSquad: o.finishBonusPerSquad as number,
  };
}
