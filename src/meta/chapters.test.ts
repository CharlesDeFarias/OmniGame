import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterById, type ChapterId } from './chapters';

describe('chapter registry', () => {
  it('lists the four chapters in canonical order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['kitchen', 'dance', 'gym', 'vanity']);
  });

  it('has the fixed unlock levels, dirs, packs, and payout multipliers', () => {
    expect(CHAPTERS).toEqual([
      { id: 'kitchen', unlockLevel: 1, levelDir: 'kitchen', packId: 'gems', payoutMultiplier: 1 },
      { id: 'dance', unlockLevel: 3, levelDir: 'dance', packId: 'music', payoutMultiplier: 1.25 },
      { id: 'gym', unlockLevel: 4, levelDir: 'gym', packId: 'gems', payoutMultiplier: 1.5 },
      { id: 'vanity', unlockLevel: 5, levelDir: 'vanity', packId: 'gems', payoutMultiplier: 1.75 },
    ]);
  });

  it('chapterById returns the matching chapter', () => {
    for (const id of ['kitchen', 'dance', 'gym', 'vanity'] as ChapterId[]) {
      expect(chapterById(id).id).toBe(id);
    }
  });
});
