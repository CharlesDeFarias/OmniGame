import type { TaskIcon } from '../services/tasks';

/**
 * Manager-task icon -> texture mapping (decision #50). Judgment call: no new
 * per-icon textures — the five task categories reuse art the player already
 * knows from the chapter strip and hub cards (note = dance, dumbbell = gym,
 * heart = vanity/makeup, pan = cooking, star = general). `ui-clipboard` is the
 * only texture added for this feature.
 */
export const TASK_ICON_TEXTURE: Record<TaskIcon, string> = {
  dance: 'ui-note',
  exercise: 'ui-dumbbell',
  makeup: 'ui-heart',
  cooking: 'ui-pan-card',
  star: 'ui-star',
};
