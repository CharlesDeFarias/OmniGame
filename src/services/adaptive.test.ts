import { describe, expect, it } from 'vitest';
import { applyTierTo, createAdaptive, describeTier, type AdaptiveState } from './adaptive';
import type { JournalStorage } from './journal';
import type { LevelDef } from '../core/match3/index';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

function baseLevel(): LevelDef {
  return {
    id: 'test-001',
    seed: 42,
    board: { width: 6, height: 6, colorCount: 4 },
    moves: 20,
    giftMoves: 0,
    goals: [],
  };
}

describe('adaptive', () => {
  it('defaults to tier 0 with empty recent and winsSinceBreak 0', () => {
    const s = memStorage();
    const a = createAdaptive(s);
    expect(a.state()).toEqual({ version: 1, tier: 0, recent: [], winsSinceBreak: 0 });
  });

  it('promotes exactly on a 3-streak of 3-star wins and resets recent', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    // First two wins don't promote
    a.recordOutcome(true, 3);
    expect(a.state().tier).toBe(0);
    expect(a.state().recent.length).toBe(1);

    a.recordOutcome(true, 3);
    expect(a.state().tier).toBe(0);
    expect(a.state().recent.length).toBe(2);

    // Third win completes the streak and promotes
    const { tier, changed } = a.recordOutcome(true, 3);
    expect(tier).toBe(1);
    expect(changed).toBe(true);
    expect(a.state().recent).toEqual([]);

    // Next outcome alone doesn't re-promote
    a.recordOutcome(true, 3);
    expect(a.state().tier).toBe(1);
    expect(a.state().recent.length).toBe(1);
  });

  it('demotes on 2-of-3 losses', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    // Build up to tier 1 first
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    expect(a.state().tier).toBe(1);

    // Now add two losses
    a.recordOutcome(false, 1);
    a.recordOutcome(false, 1);

    // Third entry completes 2-of-3 losses and demotes
    const { tier, changed } = a.recordOutcome(true, 3);
    expect(tier).toBe(0);
    expect(changed).toBe(true);
    expect(a.state().recent).toEqual([]);
  });

  it('respects tier bounds at +2 (pinned, recent clears, changed false)', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    // Promote to tier 2
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    expect(a.state().tier).toBe(1);

    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    expect(a.state().tier).toBe(2);

    // Try to promote beyond +2
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    const { tier, changed } = a.recordOutcome(true, 3);
    expect(tier).toBe(2);
    expect(changed).toBe(false);
    expect(a.state().recent).toEqual([]);
  });

  it('respects tier bounds at -2 (pinned, recent clears, changed false)', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    // Demote to tier -1
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    expect(a.state().tier).toBe(-1);

    // Demote to tier -2
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    expect(a.state().tier).toBe(-2);

    // Try to demote beyond -2
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    const { tier, changed } = a.recordOutcome(false, 0);
    expect(tier).toBe(-2);
    expect(changed).toBe(false);
    expect(a.state().recent).toEqual([]);
  });

  it('caps recent to 5 entries, dropping oldest', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    for (let i = 0; i < 6; i++) {
      a.recordOutcome(true, 1);
    }

    const recent = a.state().recent;
    expect(recent.length).toBe(5);
    // All should be {won: true, stars: 1}
    expect(recent.every((e) => e.won && e.stars === 1)).toBe(true);
  });

  it('applyTier returns pure copy, never mutates input', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    // Promote to tier 1
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);

    const level = baseLevel();
    const original = JSON.stringify(level);
    const adjusted = a.applyTier(level);

    expect(JSON.stringify(level)).toBe(original);
    expect(adjusted).not.toBe(level);
    expect(adjusted.moves).toBe(19); // 20 - 1
    expect(level.moves).toBe(20);
  });

  it('applyTier math: negative tier adds moves, respects floor 5', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    // Demote to tier -2
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);
    a.recordOutcome(false, 0);

    const level = { ...baseLevel(), moves: 10 };
    const adjusted = a.applyTier(level);
    expect(adjusted.moves).toBe(12); // 10 - (-2) = 10 + 2

    const tiny = { ...baseLevel(), moves: 5 };
    const tinyAdj = a.applyTier(tiny);
    expect(tinyAdj.moves).toBe(7); // 5 - (-2) = 7

    const veryTiny = { ...baseLevel(), moves: 4 };
    const veryTinyAdj = a.applyTier(veryTiny);
    expect(veryTinyAdj.moves).toBe(6); // max(5, 4 - (-2)) = max(5, 6) = 6

    // At floor: moves=3, tier=-2 would give 3-(-2)=5
    const atFloor = { ...baseLevel(), moves: 3 };
    const atFloorAdj = a.applyTier(atFloor);
    expect(atFloorAdj.moves).toBe(5); // max(5, 3 - (-2)) = max(5, 5) = 5
  });

  it('applyTier preserves giftMoves', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);

    const level = { ...baseLevel(), giftMoves: 5 };
    const adjusted = a.applyTier(level);
    expect(adjusted.giftMoves).toBe(5);
  });

  it('persists every mutation', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    a.recordOutcome(true, 3);
    const stored = JSON.parse(s.getItem('omnigame.adaptive.v1')!);
    expect(stored.recent).toEqual([{ won: true, stars: 3 }]);
  });

  it('recovers from corrupted or wrong-version data', () => {
    const s = memStorage();
    s.setItem('omnigame.adaptive.v1', 'garbage');
    const a = createAdaptive(s);
    expect(a.state()).toEqual({ version: 1, tier: 0, recent: [], winsSinceBreak: 0 });
  });

  it('rejects invalid tier (out of bounds or non-integer)', () => {
    const s = memStorage();
    s.setItem('omnigame.adaptive.v1', JSON.stringify({ version: 1, tier: 5, recent: [], winsSinceBreak: 0 }));
    const a = createAdaptive(s);
    expect(a.state().tier).toBe(0);
  });

  it('rejects invalid recent (not array or bad entries)', () => {
    const s = memStorage();
    s.setItem('omnigame.adaptive.v1', JSON.stringify({ version: 1, tier: 0, recent: 'oops', winsSinceBreak: 0 }));
    const a = createAdaptive(s);
    expect(a.state().recent).toEqual([]);
  });

  it('recordWin increments and persists winsSinceBreak', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    expect(a.recordWin()).toBe(1);
    expect(a.state().winsSinceBreak).toBe(1);

    expect(a.recordWin()).toBe(2);
    expect(a.state().winsSinceBreak).toBe(2);

    const stored = JSON.parse(s.getItem('omnigame.adaptive.v1')!);
    expect(stored.winsSinceBreak).toBe(2);
  });

  it('resetBreakCounter clears winsSinceBreak and persists', () => {
    const s = memStorage();
    const a = createAdaptive(s);

    a.recordWin();
    a.recordWin();
    expect(a.state().winsSinceBreak).toBe(2);

    a.resetBreakCounter();
    expect(a.state().winsSinceBreak).toBe(0);

    const stored = JSON.parse(s.getItem('omnigame.adaptive.v1')!);
    expect(stored.winsSinceBreak).toBe(0);
  });

  it('survives round-trip across instances', () => {
    const s = memStorage();

    const a1 = createAdaptive(s);
    a1.recordOutcome(true, 3);
    a1.recordOutcome(true, 3);
    a1.recordOutcome(true, 3);
    a1.recordWin();
    a1.recordWin();

    const a2 = createAdaptive(s);
    expect(a2.state()).toEqual({
      version: 1,
      tier: 1,
      recent: [],
      winsSinceBreak: 2,
    });
  });
});

function collectLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-collect',
    seed: 4242,
    board: { width: 6, height: 6, colorCount: 5 },
    moves: 20,
    giftMoves: 5,
    goals: [{ type: 'collect', color: 'red', count: 20 }],
    ...overrides,
  };
}

function countChars(layout: string[], ch: string): number {
  return layout.join('').split('').filter((c) => c === ch).length;
}

function cellsOf(layout: string[], ch: string): string[] {
  const out: string[] = [];
  layout.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push(`${x},${y}`);
  });
  return out;
}

describe('adaptive v2 obstacle injection', () => {
  it('tiers 0/-1/-2 never add a layout and keep v1 moves math', () => {
    for (const tier of [0, -1, -2]) {
      const level = collectLevel();
      const adjusted = applyTierTo(level, tier);
      expect(adjusted.moves).toBe(Math.max(5, 20 - tier));
      expect(adjusted.board.layout).toBeUndefined();
      expect(adjusted.board).toEqual(level.board);
    }
  });

  it('tier -1 never removes authored obstacles', () => {
    const layout = ['......', '.b..B.', '......', '..ii..', '......', '......'];
    const level = collectLevel({ board: { width: 6, height: 6, colorCount: 5, layout } });
    const adjusted = applyTierTo(level, -1);
    expect(adjusted.moves).toBe(21);
    expect(adjusted.board.layout).toEqual(layout);
  });

  it('tier +1 on a layoutless collect-only level injects exactly 3 ice, deterministically, without mutating input', () => {
    const level = collectLevel();
    const frozen = JSON.stringify(level);
    const a = applyTierTo(level, 1);
    const b = applyTierTo(level, 1);
    expect(JSON.stringify(level)).toBe(frozen); // input unmutated
    expect(a.moves).toBe(19);
    expect(a.board.layout).toBeDefined();
    expect(a.board.layout!.length).toBe(6);
    expect(countChars(a.board.layout!, 'i')).toBe(3);
    expect(countChars(a.board.layout!, 'b')).toBe(0);
    expect(countChars(a.board.layout!, 'B')).toBe(0);
    expect(a.board.layout).toEqual(b.board.layout); // same input -> same layout
  });

  it('tier +2 injects 5 ice + 1 hp1 box and holds the blocker/movable constraints', () => {
    const level = collectLevel();
    const adjusted = applyTierTo(level, 2);
    const layout = adjusted.board.layout!;
    expect(adjusted.moves).toBe(18);
    expect(countChars(layout, 'i')).toBe(5);
    expect(countChars(layout, 'b')).toBe(1);
    expect(countChars(layout, 'B')).toBe(0);
    const boxes = countChars(layout, 'b') + countChars(layout, 'B');
    expect(boxes).toBeLessThanOrEqual(Math.floor((6 * 6) / 9)); // blockers <= w*h/9
    expect(6 * 6 - boxes).toBeGreaterThanOrEqual(Math.ceil((2 * 6 * 6) / 3)); // movable >= 2/3
  });

  it('tier +1 on a level WITH a layout preserves authored b/B/i and adds ice only on "." cells', () => {
    const layout = ['b.....', '.B....', '......', '...i..', '......', '.....b'];
    const level = collectLevel({ board: { width: 6, height: 6, colorCount: 5, layout } });
    const adjusted = applyTierTo(level, 1);
    const out = adjusted.board.layout!;
    // authored cells untouched
    expect(cellsOf(out, 'b')).toEqual(cellsOf(layout, 'b'));
    expect(cellsOf(out, 'B')).toEqual(cellsOf(layout, 'B'));
    for (const cell of cellsOf(layout, 'i')) expect(cellsOf(out, 'i')).toContain(cell);
    // exactly 3 new ice, all on formerly-open cells
    expect(countChars(out, 'i')).toBe(countChars(layout, 'i') + 3);
    const openBefore = new Set(cellsOf(layout, '.'));
    const newIce = cellsOf(out, 'i').filter((c) => !cellsOf(layout, 'i').includes(c));
    for (const c of newIce) expect(openBefore.has(c)).toBe(true);
  });

  it('tier +2 skips the box (never violates) when authored boxes already meet the cap', () => {
    const layout = ['b....b', '......', '......', '......', '......', 'b....b']; // 4 boxes = floor(36/9)
    const level = collectLevel({ board: { width: 6, height: 6, colorCount: 5, layout } });
    const adjusted = applyTierTo(level, 2);
    const out = adjusted.board.layout!;
    expect(countChars(out, 'b')).toBe(4); // no box added
    expect(countChars(out, 'i')).toBe(5); // ice still injected
  });

  it('falls back to moves-only for levels with obstacle goals (never distorts goal economies)', () => {
    const layout = ['......', '.b..b.', '......', '......', '.b..b.', '......'];
    const level = collectLevel({
      board: { width: 6, height: 6, colorCount: 5, layout },
      goals: [
        { type: 'clearBoxes', count: 4 },
        { type: 'collect', color: 'red', count: 20 },
      ],
    });
    const adjusted = applyTierTo(level, 2);
    expect(adjusted.moves).toBe(18);
    expect(adjusted.board.layout).toEqual(layout); // untouched
  });

  it('injection differs across tiers (tier participates in the seed)', () => {
    const level = collectLevel();
    const ice1 = cellsOf(applyTierTo(level, 1).board.layout!, 'i');
    const ice2 = cellsOf(applyTierTo(level, 2).board.layout!, 'i');
    // not just a prefix relationship: the +1 placement is not reproduced verbatim inside +2
    expect(ice2.slice(0, 3)).not.toEqual(ice1);
  });

  it('instance applyTier delegates to v2 injection at promoted tiers', () => {
    const s = memStorage();
    const a = createAdaptive(s);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3);
    a.recordOutcome(true, 3); // tier 1
    const level = collectLevel();
    const adjusted = a.applyTier(level);
    expect(adjusted.moves).toBe(19);
    expect(countChars(adjusted.board.layout!, 'i')).toBe(3);
    expect(adjusted.board.layout).toEqual(applyTierTo(level, 1).board.layout);
  });

  it('describeTier reports the parent-corner table', () => {
    expect(describeTier(-2)).toEqual({ movesDelta: 2, ice: 0, boxes: 0 });
    expect(describeTier(-1)).toEqual({ movesDelta: 1, ice: 0, boxes: 0 });
    expect(describeTier(0)).toEqual({ movesDelta: 0, ice: 0, boxes: 0 });
    expect(describeTier(1)).toEqual({ movesDelta: -1, ice: 3, boxes: 0 });
    expect(describeTier(2)).toEqual({ movesDelta: -2, ice: 5, boxes: 1 });
  });
});
