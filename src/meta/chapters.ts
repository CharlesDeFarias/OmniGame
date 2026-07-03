/** Chapter registry (plan 6.5, decisions #32/#38): order, influencer-level unlocks, level dirs, piece packs. */

export type ChapterId = 'kitchen' | 'dance' | 'gym' | 'vanity';

export interface Chapter {
  id: ChapterId;
  /** Influencer level (wallet.level()) required to unlock this chapter. */
  unlockLevel: number;
  /** Directory under levels/ holding this chapter's 10 level JSONs. */
  levelDir: string;
  /** Piece pack rendered for this chapter's boards (gym/vanity reuse gems until plan 7). */
  packId: 'gems' | 'music';
  /** Film-a-video payout multiplier: x1.25 per chapter index, rounded at the call site. */
  payoutMultiplier: number;
}

export const CHAPTERS: Chapter[] = [
  { id: 'kitchen', unlockLevel: 1, levelDir: 'kitchen', packId: 'gems', payoutMultiplier: 1 },
  { id: 'dance', unlockLevel: 3, levelDir: 'dance', packId: 'music', payoutMultiplier: 1.25 },
  { id: 'gym', unlockLevel: 4, levelDir: 'gym', packId: 'gems', payoutMultiplier: 1.5 },
  { id: 'vanity', unlockLevel: 5, levelDir: 'vanity', packId: 'gems', payoutMultiplier: 1.75 },
];

export function chapterById(id: ChapterId): Chapter {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (ch === undefined) throw new Error(`unknown chapter: ${id}`);
  return ch;
}
