import { describe, expect, it } from 'vitest';
import { createTasks } from './tasks';
import type { JournalStorage } from './journal';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('tasks', () => {
  it('starts empty; create persists a pending task that round-trips through a fresh instance', () => {
    const storage = memStorage();
    const t = createTasks(storage);
    expect(t.all()).toEqual([]);
    const task = t.create('dance', 1000);
    expect(task.icon).toBe('dance');
    expect(task.createdAt).toBe(1000);
    expect(task.done).toBe(false);
    expect(task.rewarded).toBe(false);
    expect(createTasks(storage).all()).toEqual([task]);
  });

  it('create assigns unique ids even for identical timestamps', () => {
    const t = createTasks(memStorage());
    const a = t.create('star', 5);
    const b = t.create('star', 5);
    expect(a.id).not.toBe(b.id);
  });

  it('pending lists only not-done tasks, in creation order', () => {
    const t = createTasks(memStorage());
    const a = t.create('exercise', 1);
    const b = t.create('makeup', 2);
    t.toggleDone(a.id, 3);
    expect(t.pending().map((x) => x.id)).toEqual([b.id]);
    expect(t.all().map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('toggleDone sets done/doneAt, un-done clears doneAt, unknown ids return false', () => {
    const storage = memStorage();
    const t = createTasks(storage);
    const a = t.create('cooking', 1);
    expect(t.toggleDone('nope', 2)).toBe(false);
    expect(t.toggleDone(a.id, 2)).toBe(true);
    expect(createTasks(storage).all()[0]).toMatchObject({ done: true, doneAt: 2 });
    expect(t.toggleDone(a.id, 3)).toBe(false);
    const reread = createTasks(storage).all()[0]!;
    expect(reread.done).toBe(false);
    expect(reread.doneAt).toBeUndefined();
  });

  it('unrewarded lists done-but-unrewarded tasks; markRewarded persists and clears them', () => {
    const storage = memStorage();
    const t = createTasks(storage);
    const a = t.create('dance', 1);
    t.create('star', 2); // stays pending: never unrewarded
    expect(t.unrewarded()).toEqual([]);
    t.toggleDone(a.id, 3);
    expect(t.unrewarded().map((x) => x.id)).toEqual([a.id]);
    t.markRewarded(a.id);
    expect(t.unrewarded()).toEqual([]);
    expect(createTasks(storage).unrewarded()).toEqual([]);
    expect(createTasks(storage).all()[0]!.rewarded).toBe(true);
  });

  it('never double-rewards: done -> rewarded -> undone -> done again stays rewarded', () => {
    const storage = memStorage();
    const t = createTasks(storage);
    const a = t.create('exercise', 1);
    t.toggleDone(a.id, 2);
    t.markRewarded(a.id);
    t.toggleDone(a.id, 3); // manager un-checks
    expect(t.all()[0]!.rewarded).toBe(true);
    t.toggleDone(a.id, 4); // ...and re-checks
    expect(t.unrewarded()).toEqual([]);
    expect(createTasks(storage).unrewarded()).toEqual([]);
  });

  it('remove deletes a task and persists; unknown ids are ignored', () => {
    const storage = memStorage();
    const t = createTasks(storage);
    const a = t.create('makeup', 1);
    const b = t.create('star', 2);
    t.remove('nope');
    t.remove(a.id);
    expect(t.all().map((x) => x.id)).toEqual([b.id]);
    expect(createTasks(storage).all().map((x) => x.id)).toEqual([b.id]);
  });

  it('corrupted, wrong-version, or malformed-entry storage resets to empty', () => {
    for (const bad of [
      'not json{{',
      JSON.stringify({ version: 2, tasks: [] }),
      JSON.stringify([]),
      JSON.stringify({ version: 1, tasks: 'nope' }),
      JSON.stringify({ version: 1, tasks: [{ id: 't1', icon: 'juggling', createdAt: 1, done: false, rewarded: false }] }),
      JSON.stringify({ version: 1, tasks: [{ id: 5, icon: 'dance', createdAt: 1, done: false, rewarded: false }] }),
    ]) {
      const storage = memStorage();
      storage.data.set('omnigame.tasks.v1', bad);
      expect(createTasks(storage).all()).toEqual([]);
    }
  });
});
