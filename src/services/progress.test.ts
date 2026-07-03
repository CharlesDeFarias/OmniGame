import { describe, expect, it } from 'vitest';
import { loadProgress, saveProgress, type ProgressData } from './progress';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const DEFAULTS: ProgressData = {
  version: 2,
  chapter: 'kitchen',
  levelIndexByChapter: { kitchen: 0, dance: 0, gym: 0, vanity: 0 },
  completed: {},
  stars: {},
};

describe('progress', () => {
  it('defaults to v2 kitchen chapter with all indices 0', () => {
    expect(loadProgress(memStorage())).toEqual(DEFAULTS);
  });

  it('round-trips v2 saves', () => {
    const s = memStorage();
    const p: ProgressData = {
      version: 2,
      chapter: 'dance',
      levelIndexByChapter: { kitchen: 20, dance: 3, gym: 0, vanity: 0 },
      completed: { 'kitchen-001': true, 'dance-021': true },
      stars: { 'kitchen-001': 3 },
    };
    saveProgress(s, p);
    expect(loadProgress(s)).toEqual(p);
  });

  it('migrates exact v1 JSON silently to v2, preserving completion and stars', () => {
    const s = memStorage();
    s.setItem(
      'omnigame.progress.v1',
      JSON.stringify({
        version: 1,
        levelIndex: 7,
        completed: { 'kitchen-001': true, 'kitchen-002': true },
        stars: { 'kitchen-001': 3, 'kitchen-002': 2 },
      }),
    );
    expect(loadProgress(s)).toEqual({
      version: 2,
      chapter: 'kitchen',
      levelIndexByChapter: { kitchen: 7, dance: 0, gym: 0, vanity: 0 },
      completed: { 'kitchen-001': true, 'kitchen-002': true },
      stars: { 'kitchen-001': 3, 'kitchen-002': 2 },
    });
  });

  it('migrates v1 data missing stars', () => {
    const s = memStorage();
    s.setItem('omnigame.progress.v1', JSON.stringify({ version: 1, levelIndex: 2, completed: {} }));
    const p = loadProgress(s);
    expect(p.levelIndexByChapter.kitchen).toBe(2);
    expect(p.stars).toEqual({});
  });

  it('recovers from corrupted or wrong-version data', () => {
    const s = memStorage();
    s.setItem('omnigame.progress.v1', 'garbage');
    expect(loadProgress(s)).toEqual(DEFAULTS);
    s.setItem('omnigame.progress.v1', JSON.stringify({ version: 99 }));
    expect(loadProgress(s)).toEqual(DEFAULTS);
  });

  it('rejects non-object completed (v1 and v2)', () => {
    const s = memStorage();
    s.setItem('omnigame.progress.v1', JSON.stringify({ version: 1, levelIndex: 2, completed: 'oops' }));
    expect(loadProgress(s)).toEqual(DEFAULTS);
    s.setItem('omnigame.progress.v1', JSON.stringify({ ...DEFAULTS, completed: [] }));
    expect(loadProgress(s)).toEqual(DEFAULTS);
  });

  it('rejects negative, non-integer, or missing chapter indices and unknown chapters', () => {
    const s = memStorage();
    s.setItem('omnigame.progress.v1', JSON.stringify({ version: 1, levelIndex: -5, completed: {} }));
    expect(loadProgress(s)).toEqual(DEFAULTS);
    s.setItem('omnigame.progress.v1', JSON.stringify({ ...DEFAULTS, levelIndexByChapter: { kitchen: 2.5, dance: 0, gym: 0, vanity: 0 } }));
    expect(loadProgress(s)).toEqual(DEFAULTS);
    s.setItem('omnigame.progress.v1', JSON.stringify({ ...DEFAULTS, chapter: 'garage' }));
    expect(loadProgress(s)).toEqual(DEFAULTS);
  });

  it('saveProgress always writes v2', () => {
    const s = memStorage();
    saveProgress(s, { ...DEFAULTS, chapter: 'gym' });
    expect(JSON.parse(s.data.get('omnigame.progress.v1')!)).toMatchObject({ version: 2, chapter: 'gym' });
  });
});
