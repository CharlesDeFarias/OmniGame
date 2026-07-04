import type { SpecialKind } from '../core/match3/index';

/**
 * Transient MapScene -> PlayScene handoff for pre-level boosters (RM-parity
 * pass): the picker sheet stages what was bought (+ the free streak bonus),
 * PlayScene takes it exactly once at level start. Module-level on purpose --
 * it must survive the scene switch -- and cleared on take so a retry, replay
 * or later level can never inherit stale boosters.
 */
let pending: readonly SpecialKind[] = [];

export function setPendingBoosters(kinds: readonly SpecialKind[]): void {
  pending = kinds;
}

/** Returns the staged boosters and clears the stage (single-shot). */
export function takePendingBoosters(): SpecialKind[] {
  const out = [...pending];
  pending = [];
  return out;
}
