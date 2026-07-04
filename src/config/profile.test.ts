import { describe, expect, it } from 'vitest';
import { APP_IDENTITY } from './appIdentity';
import { PROFILE } from './profile';

describe('profile (decision #54: one-file personal layer)', () => {
  it('has the expected shape', () => {
    expect(typeof PROFILE.identity.name).toBe('string');
    expect(typeof PROFILE.identity.shortName).toBe('string');
    expect(PROFILE.identity.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(PROFILE.avatar.outfitColors).toHaveLength(3);
    for (const c of PROFILE.avatar.outfitColors) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
    expect(typeof PROFILE.features.tutorialHand).toBe('boolean');
    expect(typeof PROFILE.features.danceBreaks).toBe('boolean');
    expect(Number.isInteger(PROFILE.features.danceBreakEveryWins)).toBe(true);
    expect(PROFILE.features.danceBreakEveryWins).toBeGreaterThan(0);
    expect(typeof PROFILE.features.adaptiveDifficulty).toBe('boolean');
    expect(typeof PROFILE.features.managerTasks).toBe('boolean');
    expect(typeof PROFILE.features.playlistMusic).toBe('boolean');
    expect(['none', 'minimal', 'full']).toContain(PROFILE.textTier);
  });

  it('appIdentity shim re-exports PROFILE.identity (guards vite.config import)', () => {
    expect(APP_IDENTITY).toBe(PROFILE.identity);
  });
});
