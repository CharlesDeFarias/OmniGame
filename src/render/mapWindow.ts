/**
 * 10-level paging window for the saga map: the NODE_X/nodeY anchor tables
 * describe exactly ten path positions, so chapters longer than ten levels are
 * shown one 10-level "page" at a time (the page containing the current
 * level). RM scrolls a continuous map; we page instead -- earlier pages are
 * simply not shown once the player moves past them (review-queue note).
 *
 * Pure helper (no Phaser) so it is unit-testable headlessly.
 */
export function mapWindow(total: number, currentIndex: number): { start: number; end: number } {
  const page = Math.floor(Math.min(currentIndex, total - 1) / 10);
  const start = page * 10;
  return { start, end: Math.min(start + 10, total) };
}
