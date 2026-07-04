import type { JournalStorage } from './journal';

export type TaskIcon = 'dance' | 'exercise' | 'makeup' | 'cooking' | 'star';

export interface ManagerTask {
  id: string;
  icon: TaskIcon;
  createdAt: number;
  done: boolean;
  doneAt?: number;
  rewarded: boolean;
}

export interface Tasks {
  all(): ManagerTask[];
  /** Tasks not yet marked done. */
  pending(): ManagerTask[];
  create(icon: TaskIcon, now: number): ManagerTask;
  /**
   * Toggles done/doneAt; returns the task's NEW done state (false for unknown ids).
   * Un-doing keeps `rewarded` set so a task can never pay out twice.
   */
  toggleDone(id: string, now: number): boolean;
  /** Done tasks whose reward has not been paid yet. */
  unrewarded(): ManagerTask[];
  markRewarded(id: string): void;
  remove(id: string): void;
}

const KEY = 'omnigame.tasks.v1';

export const TASK_ICONS: readonly TaskIcon[] = ['dance', 'exercise', 'makeup', 'cooking', 'star'];

function isTask(v: unknown): v is ManagerTask {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t['id'] === 'string' &&
    TASK_ICONS.includes(t['icon'] as TaskIcon) &&
    typeof t['createdAt'] === 'number' &&
    typeof t['done'] === 'boolean' &&
    (t['doneAt'] === undefined || typeof t['doneAt'] === 'number') &&
    typeof t['rewarded'] === 'boolean'
  );
}

function load(storage: JournalStorage): ManagerTask[] {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return [];
    const d = JSON.parse(raw) as { version?: unknown; tasks?: unknown } | null;
    if (d === null || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.tasks) || !d.tasks.every(isTask)) {
      return [];
    }
    return (d.tasks as ManagerTask[]).map((t) => ({ ...t }));
  } catch {
    return [];
  }
}

/**
 * Manager task assignments (decision #50): Charles assigns icon-based real-world
 * practice tasks from the parent panel and marks them done; CareerScene pays each
 * task's reward exactly once (the `rewarded` flag survives un-done/re-done flips).
 */
export function createTasks(storage: JournalStorage): Tasks {
  const tasks = load(storage);
  let counter = 0;
  const save = (): void => storage.setItem(KEY, JSON.stringify({ version: 1, tasks }));
  const find = (id: string): ManagerTask | undefined => tasks.find((t) => t.id === id);
  return {
    all: () => tasks.map((t) => ({ ...t })),
    pending: () => tasks.filter((t) => !t.done).map((t) => ({ ...t })),
    create(icon, now) {
      const task: ManagerTask = { id: `t${now}${counter++}`, icon, createdAt: now, done: false, rewarded: false };
      tasks.push(task);
      save();
      return { ...task };
    },
    toggleDone(id, now) {
      const t = find(id);
      if (t === undefined) return false;
      if (t.done) {
        t.done = false;
        delete t.doneAt; // `rewarded` intentionally survives: no double rewards.
      } else {
        t.done = true;
        t.doneAt = now;
      }
      save();
      return t.done;
    },
    unrewarded: () => tasks.filter((t) => t.done && !t.rewarded).map((t) => ({ ...t })),
    markRewarded(id) {
      const t = find(id);
      if (t === undefined) return;
      t.rewarded = true;
      save();
    },
    remove(id) {
      const i = tasks.findIndex((t) => t.id === id);
      if (i < 0) return;
      tasks.splice(i, 1);
      save();
    },
  };
}
