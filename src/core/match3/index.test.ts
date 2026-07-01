import { describe, expect, it } from 'vitest';
import * as api from './index';

describe('public barrel', () => {
  it('exposes the full public surface', () => {
    for (const name of [
      'createRng', 'ALL_COLORS', 'createBoard', 'at', 'inBounds',
      'canSwap', 'isAdjacent', 'findValidMoves', 'hasValidMove', 'shuffleBoard',
      'resolveTurn', 'initGoals', 'applyCleared', 'goalsComplete',
      'parseLevel', 'LevelError', 'startLevel', 'applyMove',
    ]) {
      expect(api).toHaveProperty(name);
    }
  });
});
