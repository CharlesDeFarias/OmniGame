import { parseLevel } from '../core/match3/index';
import type { LevelDef } from '../core/match3/index';

const modules = import.meta.glob('../../levels/kitchen/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

/** Kitchen chapter levels, sorted by filename (001..010), validated at load. */
export function loadLevels(): LevelDef[] {
  return Object.keys(modules)
    .sort()
    .map((k) => parseLevel(modules[k]!.default));
}
