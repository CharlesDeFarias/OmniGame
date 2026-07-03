import { describe, expect, it } from 'vitest';
import { pieceTextureKey } from './packs';
import { ALL_COLORS } from '../core/match3/index';

describe('piece packs', () => {
  it('maps normal pieces to gem-<color> in the gems pack', () => {
    for (const color of ALL_COLORS) {
      expect(pieceTextureKey({ kind: 'normal', color }, 'gems')).toBe(`gem-${color}`);
    }
  });

  it('maps normal pieces to music-<color> in the music pack', () => {
    for (const color of ALL_COLORS) {
      expect(pieceTextureKey({ kind: 'normal', color }, 'music')).toBe(`music-${color}`);
    }
  });

  it('leaves specials pack-independent', () => {
    for (const special of ['rocketH', 'rocketV', 'tnt', 'lightball', 'propeller'] as const) {
      expect(pieceTextureKey({ kind: 'special', special }, 'gems')).toBe(`sp-${special}`);
      expect(pieceTextureKey({ kind: 'special', special }, 'music')).toBe(`sp-${special}`);
    }
  });

  it('leaves blockers pack-independent', () => {
    for (const pack of ['gems', 'music'] as const) {
      expect(pieceTextureKey({ kind: 'blocker', hp: 1 }, pack)).toBe('ob-box1');
      expect(pieceTextureKey({ kind: 'blocker', hp: 2 }, pack)).toBe('ob-box2');
    }
  });
});
