import { describe, expect, it } from 'vitest';
import { starsFor } from './stars';

const base = { status: 'won' as const, giftUsed: false, movesLeft: 0, baseMoves: 8 };

describe('starsFor', () => {
  it('0 stars when not won', () => {
    expect(starsFor({ ...base, status: 'playing' })).toBe(0);
    expect(starsFor({ ...base, status: 'lost' })).toBe(0);
  });

  it('1 star when won via gift', () => {
    expect(starsFor({ ...base, giftUsed: true, movesLeft: 3 })).toBe(1);
  });

  it('2 stars when won cleanly but tight (movesLeft < 25% of base)', () => {
    expect(starsFor({ ...base, movesLeft: 1 })).toBe(2);
    expect(starsFor({ ...base, movesLeft: 0 })).toBe(2);
  });

  it('3 stars when won cleanly with >= 25% of base moves left', () => {
    expect(starsFor({ ...base, movesLeft: 2 })).toBe(3);
    expect(starsFor({ ...base, baseMoves: 10, movesLeft: 3 })).toBe(3);
  });
});
