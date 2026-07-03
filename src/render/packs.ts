/**
 * Piece packs (decision #9): per-chapter looks for NORMAL pieces only. Specials and
 * blockers keep their pack-independent textures. Colors are identical across packs;
 * shapes stay distinct within a pack (accessibility: color + shape both carry meaning).
 */

import type { Piece } from '../core/match3/index';
import { textureKeyFor } from './theme';

export type PackId = 'gems' | 'music';

export function pieceTextureKey(piece: Piece, pack: PackId): string {
  if (piece.kind === 'normal' && pack === 'music') return `music-${piece.color}`;
  return textureKeyFor(piece);
}
