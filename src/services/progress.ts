import { CHAPTERS, type ChapterId } from '../meta/chapters';
import type { JournalStorage } from './journal';

export interface ProgressData {
  version: 2;
  /** Chapter whose levels the play button currently runs. */
  chapter: ChapterId;
  levelIndexByChapter: Record<ChapterId, number>;
  completed: Record<string, true>;
  stars: Record<string, number>;
}

/** Storage key is historical (predates v2); the version field inside governs the shape. */
const KEY = 'omnigame.progress.v1';

const CHAPTER_IDS = CHAPTERS.map((c) => c.id);

function defaults(): ProgressData {
  return {
    version: 2,
    chapter: 'kitchen',
    levelIndexByChapter: { kitchen: 0, dance: 0, gym: 0, vanity: 0 },
    completed: {},
    stars: {},
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonNegInt(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0;
}

function readMaps(p: Record<string, unknown>): Pick<ProgressData, 'completed' | 'stars'> | null {
  if (!isPlainObject(p['completed'])) return null;
  const stars = isPlainObject(p['stars']) ? (p['stars'] as Record<string, number>) : {};
  return { completed: p['completed'] as Record<string, true>, stars };
}

/** v1 ({version:1, levelIndex}) migrates silently: kitchen keeps its index, other chapters start at 0. */
function migrateV1(p: Record<string, unknown>): ProgressData | null {
  if (!isNonNegInt(p['levelIndex'])) return null;
  const maps = readMaps(p);
  if (maps === null) return null;
  return {
    ...defaults(),
    levelIndexByChapter: { kitchen: p['levelIndex'] as number, dance: 0, gym: 0, vanity: 0 },
    ...maps,
  };
}

function readV2(p: Record<string, unknown>): ProgressData | null {
  if (!CHAPTER_IDS.includes(p['chapter'] as ChapterId)) return null;
  const byChapter = p['levelIndexByChapter'];
  if (!isPlainObject(byChapter)) return null;
  const levelIndexByChapter = {} as Record<ChapterId, number>;
  for (const id of CHAPTER_IDS) {
    const v = byChapter[id] ?? 0;
    if (!isNonNegInt(v)) return null;
    levelIndexByChapter[id] = v;
  }
  const maps = readMaps(p);
  if (maps === null) return null;
  return { version: 2, chapter: p['chapter'] as ChapterId, levelIndexByChapter, ...maps };
}

export function loadProgress(storage: JournalStorage): ProgressData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaults();
    const p = JSON.parse(raw) as unknown;
    if (!isPlainObject(p)) return defaults();
    if (p['version'] === 1) return migrateV1(p) ?? defaults();
    if (p['version'] === 2) return readV2(p) ?? defaults();
    return defaults();
  } catch {
    return defaults();
  }
}

export function saveProgress(storage: JournalStorage, p: ProgressData): void {
  storage.setItem(KEY, JSON.stringify(p));
}
