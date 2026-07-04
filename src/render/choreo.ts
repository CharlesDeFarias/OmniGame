import type { ResolveEvent } from '../core/match3/index';

export const DUR = {
  swap: 150,
  clear: 200,
  spawn: 160,
  fallPerRow: 70,
  fallMin: 120,
  refill: 220,
  shuffle: 450,
  damage: 180,
  iceClear: 200,
} as const;

/** Shared tween eases for the juiced feel: swaps overshoot, falls land with a bounce. */
export const EASE = { swap: 'Back.easeOut', fall: 'Bounce.easeOut' } as const;

export interface Step {
  event: ResolveEvent;
  duration: number;
}

/** Maps the core's event stream 1:1 to timed animation steps. The scene executes them
 *  sequentially, then snap-syncs sprites to the authoritative board. */
export function planSteps(events: ResolveEvent[]): Step[] {
  return events.map((event) => {
    switch (event.type) {
      case 'swap': return { event, duration: DUR.swap };
      case 'clear': return { event, duration: DUR.clear };
      case 'spawn': return { event, duration: DUR.spawn };
      case 'fall': {
        const maxDrop = Math.max(1, ...event.moves.map((m) => m.to.y - m.from.y));
        return { event, duration: Math.max(DUR.fallMin, maxDrop * DUR.fallPerRow) };
      }
      case 'refill': return { event, duration: DUR.refill };
      case 'shuffle': return { event, duration: DUR.shuffle };
      case 'damage': return { event, duration: DUR.damage };
      case 'iceClear': return { event, duration: DUR.iceClear };
    }
  });
}
