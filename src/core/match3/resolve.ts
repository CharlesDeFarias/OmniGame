import type { RNG } from '../rng';
import { at, cloneBoard, set } from './board';
import { boosterTargets, cellsOfColor, comboTargets } from './boosters';
import { applyGravity, refill, type FallMove } from './gravity';
import { findMatchGroups } from './matches';
import { canSwap, swapPieces } from './swap';
import type { Board, Coord, Piece, PieceColor } from './types';

export type ResolveEvent =
  | { type: 'swap'; a: Coord; b: Coord }
  | { type: 'clear'; cells: Coord[] }
  | { type: 'spawn'; coord: Coord; piece: Piece }
  | { type: 'fall'; moves: FallMove[] }
  | { type: 'refill'; fills: { coord: Coord; piece: Piece }[] };

export interface TurnResult {
  valid: boolean;
  board: Board;
  events: ResolveEvent[];
  clearedByColor: Partial<Record<PieceColor, number>>;
}

const key = (c: Coord): string => `${c.x},${c.y}`;

/** BFS closure: specials inside the set activate and extend it. Each cell activates once. */
function expandWithSpecials(board: Board, initial: Coord[], rng: RNG): Coord[] {
  const seen = new Map<string, Coord>();
  const queue = [...initial];
  while (queue.length > 0) {
    const c = queue.pop()!;
    const k = key(c);
    if (seen.has(k)) continue;
    seen.set(k, c);
    const p = at(board, c.x, c.y);
    if (p?.kind === 'special') {
      for (const t of boosterTargets(board, c, p.special, rng)) queue.push(t);
    }
  }
  return [...seen.values()];
}

function countColors(board: Board, cells: Coord[], into: Partial<Record<PieceColor, number>>): void {
  for (const c of cells) {
    const p = at(board, c.x, c.y);
    if (p?.kind === 'normal') into[p.color] = (into[p.color] ?? 0) + 1;
  }
}

export function resolveTurn(
  board: Board,
  a: Coord,
  b: Coord,
  rng: RNG,
  colorCount: number,
): TurnResult {
  const check = canSwap(board, a, b);
  if (!check.valid) return { valid: false, board, events: [], clearedByColor: {} };

  const work = cloneBoard(board);
  const events: ResolveEvent[] = [];
  const clearedByColor: Partial<Record<PieceColor, number>> = {};

  const pa = at(work, a.x, a.y)!;
  const pb = at(work, b.x, b.y)!;
  swapPieces(work, a, b);
  events.push({ type: 'swap', a, b });

  const clearWave = (cells: Coord[], spawns: { coord: Coord; piece: Piece }[]): void => {
    const expanded = expandWithSpecials(work, cells, rng);
    countColors(work, expanded, clearedByColor);
    for (const c of expanded) set(work, c.x, c.y, null);
    events.push({ type: 'clear', cells: expanded });
    for (const s of spawns) {
      set(work, s.coord.x, s.coord.y, s.piece);
      events.push({ type: 'spawn', coord: s.coord, piece: s.piece });
    }
    const moves = applyGravity(work);
    if (moves.length > 0) events.push({ type: 'fall', moves });
    const fills = refill(work, rng, colorCount);
    if (fills.length > 0) events.push({ type: 'refill', fills });
  };

  // pa is now at b, pb at a.
  if (pa.kind === 'special' && pb.kind === 'special') {
    const targets = comboTargets(
      work,
      { coord: b, special: pa.special },
      { coord: a, special: pb.special },
      rng,
    );
    clearWave([...targets, a, b], []);
  } else if (pa.kind === 'special' || pb.kind === 'special') {
    const specialAt = pa.kind === 'special' ? b : a;
    const special = pa.kind === 'special' ? pa.special : (pb as Extract<Piece, { kind: 'special' }>).special;
    const partner = pa.kind === 'special' ? pb : pa;
    const targets =
      special === 'lightball' && partner.kind === 'normal'
        ? cellsOfColor(work, partner.color)
        : boosterTargets(work, specialAt, special, rng);
    clearWave([...targets, specialAt], []);
  }

  let swappedHint: Coord | null = a;
  for (;;) {
    const groups = findMatchGroups(work, swappedHint);
    swappedHint = null;
    if (groups.length === 0) break;
    const cells: Coord[] = [];
    const spawns: { coord: Coord; piece: Piece }[] = [];
    for (const g of groups) {
      cells.push(...g.cells);
      if (g.special) spawns.push({ coord: g.origin, piece: { kind: 'special', special: g.special } });
    }
    clearWave(cells, spawns);
  }

  return { valid: true, board: work, events, clearedByColor };
}
