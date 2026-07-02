import type { ResolveEvent } from '../core/match3/index';

export const DUR = {
  swap: 160,
  clear: 220,
  spawn: 160,
  fallPerRow: 70,
  fallMin: 120,
  refill: 220,
  shuffle: 450,
} as const;

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
    }
  });
}
