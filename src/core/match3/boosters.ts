import type { RNG } from '../rng';
import { at, inBounds } from './board';
import { ALL_COLORS, type Board, type Coord, type PieceColor, type SpecialKind } from './types';

export function mostCommonColor(board: Board): PieceColor {
  const counts = new Map<PieceColor, number>();
  for (const cell of board.cells) {
    if (cell?.kind === 'normal') counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1);
  }
  let best: PieceColor = ALL_COLORS[0]!;
  let bestCount = -1;
  for (const color of ALL_COLORS) {
    const n = counts.get(color) ?? 0;
    if (n > bestCount) { best = color; bestCount = n; }
  }
  return best;
}

export function cellsOfColor(board: Board, color: PieceColor): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const p = at(board, x, y);
      if (p?.kind === 'normal' && p.color === color) out.push({ x, y });
    }
  }
  return out;
}

function row(board: Board, y: number): Coord[] {
  return Array.from({ length: board.width }, (_, x) => ({ x, y }));
}

function column(board: Board, x: number): Coord[] {
  return Array.from({ length: board.height }, (_, y) => ({ x, y }));
}

function area(board: Board, center: Coord, radius: number): Coord[] {
  const out: Coord[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (inBounds(board, x, y)) out.push({ x, y });
    }
  }
  return out;
}

export function boosterTargets(board: Board, coord: Coord, special: SpecialKind, rng: RNG): Coord[] {
  switch (special) {
    case 'rocketH': return row(board, coord.y);
    case 'rocketV': return column(board, coord.x);
    case 'tnt': return area(board, coord, 1);
    case 'lightball': return cellsOfColor(board, mostCommonColor(board));
    case 'propeller': {
      const neighbors = [
        { x: coord.x - 1, y: coord.y }, { x: coord.x + 1, y: coord.y },
        { x: coord.x, y: coord.y - 1 }, { x: coord.x, y: coord.y + 1 },
      ].filter((c) => inBounds(board, c.x, c.y));
      const candidates: Coord[] = [];
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (at(board, x, y)?.kind === 'normal') candidates.push({ x, y });
        }
      }
      const extra = candidates.length > 0 ? [rng.pick(candidates)] : [];
      return [...neighbors, ...extra];
    }
  }
}

const dedupe = (cells: Coord[]): Coord[] => {
  const seen = new Set<string>();
  const out: Coord[] = [];
  for (const c of cells) {
    const k = `${c.x},${c.y}`;
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  }
  return out;
};

export interface PlacedSpecial { coord: Coord; special: SpecialKind; }

export function comboTargets(board: Board, a: PlacedSpecial, b: PlacedSpecial, rng: RNG): Coord[] {
  const pair = [a.special, b.special].sort().join('+');
  const isRocket = (s: SpecialKind) => s === 'rocketH' || s === 'rocketV';

  if (a.special === 'lightball' && b.special === 'lightball') {
    const all: Coord[] = [];
    for (let y = 0; y < board.height; y++) for (let x = 0; x < board.width; x++) all.push({ x, y });
    return all;
  }
  if (a.special === 'lightball' || b.special === 'lightball') {
    const other = a.special === 'lightball' ? b : a;
    return dedupe([
      ...cellsOfColor(board, mostCommonColor(board)),
      ...boosterTargets(board, other.coord, other.special, rng),
    ]);
  }
  if (isRocket(a.special) && isRocket(b.special)) {
    return dedupe([...row(board, a.coord.y), ...column(board, a.coord.x)]);
  }
  if (pair === 'tnt+tnt') return area(board, a.coord, 2);
  if ((isRocket(a.special) && b.special === 'tnt') || (a.special === 'tnt' && isRocket(b.special))) {
    const c = a.coord;
    return dedupe([
      ...row(board, Math.max(0, c.y - 1)), ...row(board, c.y), ...row(board, Math.min(board.height - 1, c.y + 1)),
      ...column(board, Math.max(0, c.x - 1)), ...column(board, c.x), ...column(board, Math.min(board.width - 1, c.x + 1)),
    ]);
  }
  return dedupe([
    ...boosterTargets(board, a.coord, a.special, rng),
    ...boosterTargets(board, b.coord, b.special, rng),
  ]);
}
