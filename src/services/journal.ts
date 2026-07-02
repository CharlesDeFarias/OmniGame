export interface JournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface JournalEntry {
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export interface Journal {
  log(type: string, data: Record<string, unknown>): void;
  read(): JournalEntry[];
}

const KEY = 'omnigame.journal.v1';

/** Local-only usage journal (decision #26): append-capped event log, never uploaded. */
export function createJournal(storage: JournalStorage, now: () => number, maxEntries = 5000): Journal {
  const load = (): JournalEntry[] => {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
    } catch {
      return [];
    }
  };
  const entries = load();
  return {
    log(type, data) {
      entries.push({ t: now(), type, data });
      while (entries.length > maxEntries) entries.shift();
      storage.setItem(KEY, JSON.stringify(entries));
    },
    read: () => [...entries],
  };
}
