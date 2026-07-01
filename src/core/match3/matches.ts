import { at } from './board';
import type { Board, Coord, PieceColor, SpecialKind } from './types';

export interface Run {
  color: PieceColor;
  dir: 'h' | 'v';
  cells: Coord[];
}

export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < board.height; y++) {
    let x = 0;
    while (x < board.width) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') { x++; continue; }
      let end = x + 1;
      while (end < board.width) {
        const q = at(board, end, y);
        if (q?.kind === 'normal' && q.color === p.color) end++;
        else break;
      }
      if (end - x >= 3) {
        const cells: Coord[] = [];
        for (let i = x; i < end; i++) cells.push({ x: i, y });
        runs.push({ color: p.color, dir: 'h', cells });
      }
      x = end;
    }
  }
  for (let x = 0; x < board.width; x++) {
    let y = 0;
    while (y < board.height) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') { y++; continue; }
      let end = y + 1;
      while (end < board.height) {
        const q = at(board, x, end);
        if (q?.kind === 'normal' && q.color === p.color) end++;
        else break;
      }
      if (end - y >= 3) {
        const cells: Coord[] = [];
        for (let i = y; i < end; i++) cells.push({ x, y: i });
        runs.push({ color: p.color, dir: 'v', cells });
      }
      y = end;
    }
  }
  return runs;
}

export interface MatchGroup {
  color: PieceColor;
  cells: Coord[];
  special: SpecialKind | null;
  origin: Coord;
}

const key = (c: Coord): string => `${c.x},${c.y}`;

export function findMatchGroups(board: Board, swapped: Coord | null): MatchGroup[] {
  const runs = findRuns(board);
  const groups: { color: PieceColor; runs: Run[]; cellSet: Map<string, Coord> }[] = [];
  for (const run of runs) {
    const target = groups.find(
      (g) => g.color === run.color && run.cells.some((c) => g.cellSet.has(key(c))),
    );
    if (target) {
      target.runs.push(run);
      for (const c of run.cells) target.cellSet.set(key(c), c);
    } else {
      groups.push({ color: run.color, runs: [run], cellSet: new Map(run.cells.map((c) => [key(c), c])) });
    }
  }

  const squares: { color: PieceColor; cells: Coord[] }[] = [];
  for (let y = 0; y < board.height - 1; y++) {
    for (let x = 0; x < board.width - 1; x++) {
      const p = at(board, x, y);
      if (p?.kind !== 'normal') continue;
      const others = [at(board, x + 1, y), at(board, x, y + 1), at(board, x + 1, y + 1)];
      if (others.every((q) => q?.kind === 'normal' && q.color === p.color)) {
        squares.push({
          color: p.color,
          cells: [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }],
        });
      }
    }
  }

  for (const sq of squares) {
    const overlapping = groups.find(
      (g) => g.color === sq.color && sq.cells.some((c) => g.cellSet.has(key(c))),
    );
    if (overlapping) {
      for (const c of sq.cells) overlapping.cellSet.set(key(c), c);
    } else {
      const cellSet = new Map(sq.cells.map((c) => [key(c), c]));
      groups.push({ color: sq.color, runs: [], cellSet });
    }
  }

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const gi = groups[i]!;
        const gj = groups[j]!;
        if (gi.color !== gj.color) continue;
        let overlap = false;
        for (const k of gj.cellSet.keys()) {
          if (gi.cellSet.has(k)) { overlap = true; break; }
        }
        if (overlap) {
          gi.runs.push(...gj.runs);
          for (const [k, c] of gj.cellSet) gi.cellSet.set(k, c);
          groups.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return groups.map((g) => {
    const cells = [...g.cellSet.values()];
    const maxRunLen = Math.max(0, ...g.runs.map((r) => r.cells.length));
    const hasH = g.runs.some((r) => r.dir === 'h');
    const hasV = g.runs.some((r) => r.dir === 'v');
    let special: SpecialKind | null = null;
    if (maxRunLen >= 5) special = 'lightball';
    else if (hasH && hasV) special = 'tnt';
    else if (maxRunLen === 4) special = hasH ? 'rocketH' : 'rocketV';
    else if (g.runs.length === 0) special = 'propeller';
    const origin = swapped && g.cellSet.has(key(swapped)) ? swapped : cells[0]!;
    return { color: g.color, cells, special, origin };
  });
}
