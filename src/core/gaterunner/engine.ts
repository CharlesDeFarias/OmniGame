import type { Cell, GateEvent, GateLevelDef, GateState, Lane } from './types';

export function startGate(level: GateLevelDef): GateState {
  return {
    levelId: level.id,
    lane: 1,
    count: level.startCount,
    nextColumnIndex: 0,
    done: false,
    won: false,
    score: 0,
  };
}

/** Single-sourced cell math (also used by sim policies for lookahead).
 *  Mul rounds down; foes subtract; walls cost ceil(25%) of the squad. */
export function resolveCell(count: number, cell: Cell): { count: number; event: GateEvent | null } {
  if (cell.kind === 'gate') {
    const after = cell.op === 'add' ? count + cell.value : Math.floor(count * cell.value);
    return { count: after, event: { type: 'gate', op: cell.op, value: cell.value, countAfter: after } };
  }
  if (cell.kind === 'foe') {
    const lost = Math.min(count, cell.count);
    const after = count - lost;
    return { count: after, event: { type: 'foe', lost, countAfter: after } };
  }
  if (cell.kind === 'wall') {
    const lost = Math.ceil(count * 0.25);
    const after = count - lost;
    return { count: after, event: { type: 'wall', lost, countAfter: after } };
  }
  return { count, event: null };
}

export interface AdvanceResult {
  state: GateState;
  events: GateEvent[];
}

/** Pure transition: the player commits `inputLane`, then the next column resolves.
 *  Tick-free by design — the renderer adds pacing later. Count floors at 0 → immediate
 *  loss (no finish event). After the last column: done, won = count > 0, score awarded.
 *  Post-done advances are inert (fresh state copy, no events). Never mutates its input. */
export function advance(state: GateState, level: GateLevelDef, inputLane: Lane): AdvanceResult {
  const column = level.columns[state.nextColumnIndex];
  if (state.done || column === undefined) return { state: { ...state }, events: [] };

  const resolved = resolveCell(state.count, column.lanes[inputLane]);
  const events: GateEvent[] = resolved.event === null ? [] : [resolved.event];
  const next: GateState = {
    ...state,
    lane: inputLane,
    count: Math.max(0, resolved.count),
    nextColumnIndex: state.nextColumnIndex + 1,
  };
  if (next.count === 0) {
    next.done = true;
    next.won = false;
  } else if (next.nextColumnIndex >= level.columns.length) {
    next.done = true;
    next.won = true;
    next.score = next.count * level.finishBonusPerSquad;
    events.push({ type: 'finish', count: next.count, score: next.score });
  }
  return { state: next, events };
}
