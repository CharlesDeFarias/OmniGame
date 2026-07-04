import { describe, expect, it } from 'vitest';
import { pieceTextureKey } from './packs';
import { ALL_COLORS } from '../core/match3/index';

describe('piece packs', () => {
  it('maps normal pieces to loaded gem art (img-gem-<color>) in the gems pack', () => {
    for (const color of ALL_COLORS) {
      expect(pieceTextureKey({ kind: 'normal', color }, 'gems')).toBe(`img-gem-${color}`);
    }
  });

  it('maps normal pieces to loaded candy art (img-candy-<color>) in the candy pack', () => {
    for (const color of ALL_COLORS) {
      expect(pieceTextureKey({ kind: 'normal', color }, 'candy')).toBe(`img-candy-${color}`);
    }
  });

  it('maps normal pieces to procedural music-<color> in the music pack', () => {
    for (const color of ALL_COLORS) {
      expect(pieceTextureKey({ kind: 'normal', color }, 'music')).toBe(`music-${color}`);
    }
  });

  it('leaves specials pack-independent: loaded art except the procedural propeller', () => {
    for (const pack of ['gems', 'candy', 'music'] as const) {
      for (const special of ['rocketH', 'rocketV', 'tnt', 'lightball'] as const) {
        expect(pieceTextureKey({ kind: 'special', special }, pack)).toBe(`img-sp-${special}`);
      }
      expect(pieceTextureKey({ kind: 'special', special: 'propeller' }, pack)).toBe('sp-propeller');
    }
  });

  it('leaves blockers pack-independent on the loaded crate art', () => {
    for (const pack of ['gems', 'candy', 'music'] as const) {
      expect(pieceTextureKey({ kind: 'blocker', hp: 1 }, pack)).toBe('img-ob-box1');
      expect(pieceTextureKey({ kind: 'blocker', hp: 2 }, pack)).toBe('img-ob-box2');
    }
  });
});
