import { describe, expect, it } from 'vitest';
import { summarize } from './stats';
import type { JournalEntry } from './journal';

const e = (type: string, data: Record<string, unknown>): JournalEntry => ({ t: 0, type, data });

describe('summarize', () => {
  it('returns zeros for an empty journal', () => {
    const s = summarize([]);
    expect(s).toEqual({
      levelsPlayed: 0, wins: 0, losses: 0, winRate: 0, giftWins: 0,
      gifts: 0, retries: 0, shuffles: 0, invalidMoves: 0, perLevel: {},
    });
  });

  it('aggregates a realistic session', () => {
    const s = summarize([
      e('level_start', { level: 'kitchen-001', retry: 0 }),
      e('invalid_move', { level: 'kitchen-001', reason: 'no-match' }),
      e('gift', { level: 'kitchen-001', moves: 5 }),
      e('level_end', { level: 'kitchen-001', won: true, stars: 1 }),
      e('level_start', { level: 'kitchen-002', retry: 0 }),
      e('shuffle', { level: 'kitchen-002' }),
      e('level_end', { level: 'kitchen-002', won: false }),
      e('level_start', { level: 'kitchen-002', retry: 1 }),
      e('level_end', { level: 'kitchen-002', won: true, stars: 3 }),
    ]);
    expect(s.levelsPlayed).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3, 5);
    expect(s.giftWins).toBe(1);
    expect(s.gifts).toBe(1);
    expect(s.retries).toBe(1);
    expect(s.shuffles).toBe(1);
    expect(s.invalidMoves).toBe(1);
    expect(s.perLevel['kitchen-001']).toEqual({ plays: 1, wins: 1, bestStars: 1 });
    expect(s.perLevel['kitchen-002']).toEqual({ plays: 2, wins: 1, bestStars: 3 });
  });

  it('skips malformed entries silently', () => {
    const s = summarize([
      e('level_start', {}),
      e('level_end', { level: 'kitchen-001' }),
      e('level_end', { level: 42, won: true }),
      e('unknown_type', { level: 'kitchen-001' }),
    ]);
    expect(s.levelsPlayed).toBe(0);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(0);
    expect(s.perLevel).toEqual({});
  });
});
