/**
 * Piece packs (decision #9): per-chapter looks for NORMAL pieces only. Specials and
 * blockers keep their pack-independent textures. Colors are identical across packs;
 * shapes stay distinct within a pack (accessibility: color + shape both carry meaning).
 */

import type { Piece } from '../core/match3/index';
import { textureKeyFor } from './theme';

export type PackId = 'gems' | 'candy' | 'music';

export function pieceTextureKey(piece: Piece, pack: PackId): string {
  // Decision #60 (full-Kenney family): 'gems' and 'candy' both resolve to the
  // composited shape-character pieces via textureKeyFor — kept as ids so
  // chapters/profile data stays stable. 'music' keeps its piece-pack feature.
  if (piece.kind === 'normal' && pack === 'music') return `music-${piece.color}`;
  return textureKeyFor(piece);
}
