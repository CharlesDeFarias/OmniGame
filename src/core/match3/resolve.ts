import type { RNG } from '../rng';
import { at, cloneBoard, index, set } from './board';
import { boosterTargets, cellsOfColor, comboTargets, type GoalHints } from './boosters';
import { applyGravity, refill, type FallMove } from './gravity';
import { findMatchGroups } from './matches';
import { canSwap, swapPieces } from './swap';
import type { Board, Coord, Piece, PieceColor } from './types';

export type ResolveEvent =
  | { type: 'swap'; a: Coord; b: Coord }
  | { type: 'clear'; cells: Coord[] }
  | { type: 'spawn'; coord: Coord; piece: Piece }
  | { type: 'fall'; moves: FallMove[] }
  | { type: 'refill'; fills: { coord: Coord; piece: Piece }[] }
  | { type: 'shuffle' }
  /** Boxes that lost 1 hp this wave but survived. */
  | { type: 'damage'; cells: Coord[] }
  /** Ice plates broken this wave (piece above cleared, or box above destroyed). */
  | { type: 'iceClear'; cells: Coord[] };

export interface TurnResult {
  valid: boolean;
  board: Board;
  events: ResolveEvent[];
  clearedByColor: Partial<Record<PieceColor, number>>;
  clearedBoxes: number;
  clearedIce: number;
  reason?: 'not-adjacent' | 'no-match' | 'empty-cell' | 'blocked';
}

const key = (c: Coord): string => `${c.x},${c.y}`;

/** Set closure (DFS via pop): specials inside the set activate and extend it; each cell once.
 *  Cells in `noExpand` are cleared but never re-fire — used for swapped specials whose targeted
 *  or combo effect was already computed, preventing double-activation. */
function expandWithSpecials(board: Board, initial: Coord[], rng: RNG, noExpand?: Set<string>, goalHints?: GoalHints): Coord[] {
  const seen = new Map<string, Coord>();
  const queue = [...initial];
  while (queue.length > 0) {
    const c = queue.pop()!;
    const k = key(c);
    if (seen.has(k)) continue;
    seen.set(k, c);
    if (noExpand?.has(k)) continue;
    const p = at(board, c.x, c.y);
    if (p?.kind === 'special') {
      for (const t of boosterTargets(board, c, p.special, rng, goalHints)) queue.push(t);
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
  goalHints?: GoalHints,
): TurnResult {
  if (colorCount < 3) throw new Error(`colorCount must be >= 3, got ${colorCount}`);
  const check = canSwap(board, a, b);
  if (!check.valid) return { valid: false, board, events: [], clearedByColor: {}, clearedBoxes: 0, clearedIce: 0, reason: check.reason };

  const work = cloneBoard(board);
  const events: ResolveEvent[] = [];
  const clearedByColor: Partial<Record<PieceColor, number>> = {};
  let clearedBoxes = 0;
  let clearedIce = 0;

  const pa = at(work, a.x, a.y)!;
  const pb = at(work, b.x, b.y)!;
  swapPieces(work, a, b);
  events.push({ type: 'swap', a, b });

  const clearWave = (cells: Coord[], spawns: { coord: Coord; piece: Piece }[], noExpand?: Set<string>): void => {
    const expanded = expandWithSpecials(work, cells, rng, noExpand, goalHints);
    // Partition: normal/special pieces clear outright; blockers directly targeted
    // (booster rows/areas/combos) take a hit instead. Max 1 damage per box per wave.
    const pieceCells: Coord[] = [];
    const boxHits = new Map<string, Coord>();
    for (const c of expanded) {
      const p = at(work, c.x, c.y);
      if (p === null) continue;
      if (p.kind === 'blocker') boxHits.set(key(c), c);
      else pieceCells.push(c);
    }
    // Adjacency damage: any box orthogonally next to a cleared piece joins the hits.
    for (const c of pieceCells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (at(work, n.x, n.y)?.kind === 'blocker') boxHits.set(key(n), n);
      }
    }
    countColors(work, pieceCells, clearedByColor);
    const iceCells: Coord[] = [];
    const breakIce = (c: Coord): void => {
      const i = index(work, c.x, c.y);
      if (work.ice[i]) {
        work.ice[i] = false;
        clearedIce += 1;
        iceCells.push(c);
      }
    };
    for (const c of pieceCells) breakIce(c);
    for (const c of pieceCells) set(work, c.x, c.y, null);
    const damagedCells: Coord[] = [];
    const destroyedCells: Coord[] = [];
    for (const c of boxHits.values()) {
      const box = at(work, c.x, c.y) as Extract<Piece, { kind: 'blocker' }>;
      const hp = box.hp - 1;
      if (hp > 0) {
        set(work, c.x, c.y, { kind: 'blocker', hp });
        damagedCells.push(c);
      } else {
        clearedBoxes += 1;
        breakIce(c);
        set(work, c.x, c.y, null);
        destroyedCells.push(c);
      }
    }
    events.push({ type: 'clear', cells: [...pieceCells, ...destroyedCells] });
    if (damagedCells.length > 0) events.push({ type: 'damage', cells: damagedCells });
    if (iceCells.length > 0) events.push({ type: 'iceClear', cells: iceCells });
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
      goalHints,
    );
    clearWave([...targets, a, b], [], new Set([key(a), key(b)]));
  } else if (pa.kind === 'special' || pb.kind === 'special') {
    const specialAt = pa.kind === 'special' ? b : a;
    const special = pa.kind === 'special' ? pa.special : (pb as Extract<Piece, { kind: 'special' }>).special;
    const partner = pa.kind === 'special' ? pb : pa;
    const targets =
      special === 'lightball' && partner.kind === 'normal'
        ? cellsOfColor(work, partner.color)
        : boosterTargets(work, specialAt, special, rng, goalHints);
    clearWave([...targets, specialAt], [], new Set([key(specialAt)]));
  }

  let swappedHint: Coord | null = b;
  const MAX_WAVES = 50;
  let waves = 0;
  for (;;) {
    if (++waves > MAX_WAVES) throw new Error('cascade did not settle within 50 waves');
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

  return { valid: true, board: work, events, clearedByColor, clearedBoxes, clearedIce };
}
