import { parseLevel } from '../core/match3/index';
import type { LevelDef } from '../core/match3/index';
import type { ChapterId } from '../meta/chapters';

// import.meta.glob paths must be static strings: one glob per chapter directory.
const GLOBS: Record<ChapterId, Record<string, { default: unknown }>> = {
  kitchen: import.meta.glob('../../levels/kitchen/*.json', { eager: true }),
  dance: import.meta.glob('../../levels/dance/*.json', { eager: true }),
  gym: import.meta.glob('../../levels/gym/*.json', { eager: true }),
  vanity: import.meta.glob('../../levels/vanity/*.json', { eager: true }),
};

/** A chapter's levels, sorted by filename (001..050 are globally numbered), validated at load. */
export function loadLevels(chapter: ChapterId): LevelDef[] {
  const modules = GLOBS[chapter];
  return Object.keys(modules)
    .sort()
    .map((k) => parseLevel(modules[k]!.default));
}
