export interface Layout {
  originX: number;
  originY: number;
  cell: number;
  cols: number;
  rows: number;
}

/** Board geometry in logical pixels: max 94% of width, vertically centered between reserves. */
export function boardLayout(
  viewW: number,
  viewH: number,
  cols: number,
  rows: number,
  topReserve: number,
  bottomReserve: number,
): Layout {
  const cell = Math.min((viewW * 0.94) / cols, (viewH - topReserve - bottomReserve) / rows);
  const originX = (viewW - cell * cols) / 2;
  const usable = viewH - topReserve - bottomReserve;
  const originY = topReserve + (usable - cell * rows) / 2;
  return { originX, originY, cell, cols, rows };
}

export function cellToXY(l: Layout, x: number, y: number): { px: number; py: number } {
  return { px: l.originX + (x + 0.5) * l.cell, py: l.originY + (y + 0.5) * l.cell };
}

export function xyToCell(l: Layout, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - l.originX) / l.cell);
  const y = Math.floor((py - l.originY) / l.cell);
  if (x < 0 || x >= l.cols || y < 0 || y >= l.rows) return null;
  return { x, y };
}
