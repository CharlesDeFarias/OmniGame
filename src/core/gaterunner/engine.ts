import type { Cell, GateEvent, GateLevelDef, GateState, Lane } from './types';

export function startGate(level: GateLevelDef): GateState {
  return {
    levelId: level.id,
    lane: 1,
    count: level.startCount,
    nextColumnIndex: 0,
    done: false,
    won: false,
    revived: false,
    score: 0,
  };
}

/** Single-sourced cell math (also used by sim policies for lookahead).
 *  Mul rounds down; foes subtract; walls cost ceil(25%) of the squad.
 *  NOTE: wall math only ever applies head-on (squad's own lane) — sideways
 *  entry is deflected in `advance` before this runs. */
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

/** Lanes reachable in one advance from `lane`: itself plus adjacent lanes.
 *  Single source for the engine's clamp and the sim policies. */
export function reachableLanes(lane: Lane): Lane[] {
  const out: Lane[] = [];
  for (const l of [lane - 1, lane, lane + 1]) {
    if (l >= 0 && l <= 2) out.push(l as Lane);
  }
  return out;
}

/** Score→coins conversion (decision #51): gentle sqrt curve, capped at match-3's
 *  ~60-coins-per-win ceiling. Pure — the caller decides when a run earns coins. */
export function coinsForScore(score: number): number {
  return Math.min(60, 20 + Math.floor(Math.sqrt(Math.max(0, score))));
}

export interface AdvanceResult {
  state: GateState;
  events: GateEvent[];
}

/** Pure transition: the player commits `inputLane`, then the next column resolves.
 *  Feel package (decision #51) semantics:
 *  - Adjacent-lane constraint: a 2-lane jump is clamped one step toward the input.
 *  - Hard walls: a sideways move into a wall lane is deflected — `deflect` event,
 *    then the squad's previous lane resolves instead (guaranteed non-wall, since
 *    validation allows at most 1 wall per column). A wall in the squad's OWN lane
 *    is a head-on crash and still costs ceil(25%).
 *  - One-time revival: the first wipe (count 0, any cause) restores
 *    max(1, ceil(startCount / 2)) and the run continues; the second wipe loses.
 *  Tick-free by design — the renderer adds pacing later. After the last column:
 *  done, won = count > 0, score awarded. Post-done advances are inert (fresh
 *  state copy, no events). Never mutates its input. */
export function advance(state: GateState, level: GateLevelDef, inputLane: Lane): AdvanceResult {
  const column = level.columns[state.nextColumnIndex];
  if (state.done || column === undefined) return { state: { ...state }, events: [] };

  // Adjacent-lane constraint: clamp one step toward the input.
  let lane = (Math.abs(inputLane - state.lane) > 1
    ? state.lane + Math.sign(inputLane - state.lane)
    : inputLane) as Lane;

  const events: GateEvent[] = [];
  // Hard wall: entering a wall lane from the side is impossible — deflect back.
  if (lane !== state.lane && column.lanes[lane].kind === 'wall') {
    events.push({ type: 'deflect', lane });
    lane = state.lane;
  }

  const resolved = resolveCell(state.count, column.lanes[lane]);
  if (resolved.event !== null) events.push(resolved.event);
  const next: GateState = {
    ...state,
    lane,
    count: Math.max(0, resolved.count),
    nextColumnIndex: state.nextColumnIndex + 1,
  };
  if (next.count === 0 && !next.revived) {
    next.count = Math.max(1, Math.ceil(level.startCount / 2));
    next.revived = true;
    events.push({ type: 'revive', count: next.count });
  }
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
