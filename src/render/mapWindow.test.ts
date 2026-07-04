import { describe, expect, it } from 'vitest';
import { mapWindow } from './mapWindow';

describe('mapWindow', () => {
  it('shows the whole path for a 10-level chapter', () => {
    expect(mapWindow(10, 0)).toEqual({ start: 0, end: 10 });
    expect(mapWindow(10, 9)).toEqual({ start: 0, end: 10 });
  });

  it('shows page 0 for a 20-level chapter while current is in the first ten', () => {
    expect(mapWindow(20, 0)).toEqual({ start: 0, end: 10 });
    expect(mapWindow(20, 9)).toEqual({ start: 0, end: 10 });
  });

  it('shows 10..20 for a 20-level chapter once current is on the second page', () => {
    expect(mapWindow(20, 10)).toEqual({ start: 10, end: 20 });
    expect(mapWindow(20, 15)).toEqual({ start: 10, end: 20 });
  });

  it('clamps current >= total to the last page and never exceeds total', () => {
    expect(mapWindow(20, 25)).toEqual({ start: 10, end: 20 });
    expect(mapWindow(15, 14)).toEqual({ start: 10, end: 15 });
  });
});
