/**
 * Economy probe for plan 6.5 chapter rooms (run: npx tsx scripts/probe-economy.ts).
 *
 * Models coins earned at 2-star pace (wallet.earnWin: 20 + 10*stars = 40/win) across a
 * 10-level chapter and evaluates candidate room price sets under two coin-bonus options:
 *   A) flat 40/win everywhere
 *   B) 40 + chapterIndex*5 per win (kitchen=0, dance=1, gym=2, vanity=3)
 * Targets (plan doc): room completable ~level 8-9 of its chapter; 15-25% of the chapter's
 * coin income left over for the wardrobe sink. Kitchen (440 over 20 levels, affordable
 * ~level 11 at flat 40) is the calibrated baseline and is not re-tuned.
 */

interface Candidate { chapter: string; chapterIndex: number; prices: number[]; }

const CANDIDATES: Candidate[] = [
  // Kitchen baseline (sanity check only).
  { chapter: 'kitchen (baseline, 20 lvls)', chapterIndex: 0, prices: [40, 40, 70, 70, 110, 110] },
  // Flat-40 attempts: keep kitchen-ish tiering, scale totals.
  { chapter: 'dance flat-shape', chapterIndex: 1, prices: [40, 40, 60, 60, 80, 80] },
  { chapter: 'gym flat-shape', chapterIndex: 2, prices: [45, 45, 70, 70, 95, 95] },
  { chapter: 'vanity flat-shape', chapterIndex: 3, prices: [50, 50, 75, 75, 105, 105] },
];

function probe(c: Candidate, bonusPerIndex: number, levels: number): string {
  const perWin = 40 + c.chapterIndex * bonusPerIndex;
  const total = c.prices.reduce((a, b) => a + b, 0);
  const income = perWin * levels;
  // Greedy purchase: last slot affordable once cumulative income >= total.
  const completeLevel = Math.ceil(total / perWin);
  const leftover = income - total;
  const leftoverPct = Math.round((leftover / income) * 1000) / 10;
  const ok = c.chapterIndex === 0 || (completeLevel >= 8 && completeLevel <= 9 && leftoverPct >= 15 && leftoverPct <= 25);
  return `${c.chapter.padEnd(28)} perWin=${perWin} total=${total} completeLvl=${completeLevel} leftover=${leftover} (${leftoverPct}%) ${ok ? 'OK' : c.chapterIndex === 0 ? '(baseline)' : 'FAIL'}`;
}

console.log('=== Option A: flat 40/win ===');
for (const c of CANDIDATES) console.log(probe(c, 0, c.chapterIndex === 0 ? 20 : 10));
console.log('\n=== Option B: 40 + chapterIndex*5 per win ===');
for (const c of CANDIDATES) console.log(probe(c, 5, c.chapterIndex === 0 ? 20 : 10));
