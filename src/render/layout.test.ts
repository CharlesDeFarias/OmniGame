import { describe, expect, it } from 'vitest';
import { boardLayout, cellToXY, xyToCell } from './layout';

describe('layout', () => {
  const l = boardLayout(720, 1280, 6, 6, 220, 160);

  it('fits the board within width and reserved bands', () => {
    expect(l.cell * 6).toBeLessThanOrEqual(720 * 0.94 + 1e-6);
    expect(l.cell * 6).toBeLessThanOrEqual(1280 - 220 - 160 + 1e-6);
    expect(l.originY).toBeGreaterThanOrEqual(220);
  });

  it('centers horizontally', () => {
    expect(l.originX + (l.cell * 6) / 2).toBeCloseTo(360, 5);
  });

  it('cellToXY gives cell centers; xyToCell inverts', () => {
    const { px, py } = cellToXY(l, 0, 0);
    expect(px).toBeCloseTo(l.originX + l.cell / 2, 5);
    expect(py).toBeCloseTo(l.originY + l.cell / 2, 5);
    expect(xyToCell(l, px, py)).toEqual({ x: 0, y: 0 });
    expect(xyToCell(l, l.originX - 5, l.originY)).toBeNull();
    const far = cellToXY(l, 5, 5);
    expect(xyToCell(l, far.px, far.py)).toEqual({ x: 5, y: 5 });
  });

  it('handles 7x7 boards', () => {
    const l7 = boardLayout(720, 1280, 7, 7, 220, 160);
    expect(l7.cell * 7).toBeLessThanOrEqual(720 * 0.94 + 1e-6);
  });
});
