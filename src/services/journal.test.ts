import { describe, expect, it } from 'vitest';
import { createJournal, type JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('journal', () => {
  it('appends events with timestamps and reads them back', () => {
    let now = 1000;
    const j = createJournal(memStorage(), () => now);
    j.log('level_start', { id: 'kitchen-001' });
    now = 2000;
    j.log('level_end', { id: 'kitchen-001', won: true });
    const all = j.read();
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual({ t: 1000, type: 'level_start', data: { id: 'kitchen-001' } });
    expect(all[1]!.t).toBe(2000);
  });

  it('persists across instances sharing storage', () => {
    const s = memStorage();
    createJournal(s, () => 1).log('a', {});
    const j2 = createJournal(s, () => 2);
    expect(j2.read()).toHaveLength(1);
  });

  it('caps at maxEntries, dropping oldest', () => {
    const j = createJournal(memStorage(), () => 0, 3);
    for (let i = 0; i < 5; i++) j.log('e', { i });
    const all = j.read();
    expect(all).toHaveLength(3);
    expect(all[0]!.data).toEqual({ i: 2 });
  });

  it('survives corrupted storage by starting fresh', () => {
    const s = memStorage();
    s.setItem('omnigame.journal.v1', '{not json');
    const j = createJournal(s, () => 1);
    j.log('a', {});
    expect(j.read()).toHaveLength(1);
  });
});
