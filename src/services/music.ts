import { createRng } from '../core/rng';

/**
 * Her-playlist music store (decision #37: procedural beat now, her playlist
 * later — this is the "later"). Local-only: audio files live in IndexedDB on
 * the device and are never uploaded anywhere. The store is pure logic behind
 * an injected backend so unit tests run in node with an in-memory fake
 * (IndexedDB does not exist in the vitest node environment).
 */

export interface MusicBackend {
  put(id: string, name: string, data: ArrayBuffer): Promise<void>;
  list(): Promise<{ id: string; name: string }[]>;
  get(id: string): Promise<ArrayBuffer | null>;
  remove(id: string): Promise<void>;
}

export const MAX_TRACKS = 20;
export const MAX_TRACK_BYTES = 15 * 1024 * 1024;

const DB_NAME = 'omnigame-music';
const STORE = 'tracks';

interface TrackRow {
  name: string;
  data: ArrayBuffer;
}

/**
 * Real backend: IndexedDB db 'omnigame-music', object store 'tracks' keyed by
 * track id. Environments without indexedDB get a backend whose every call
 * rejects; callers treat that as "no playlist" (HubScene catches into an empty
 * list, PlayScene falls back to the procedural beat).
 */
export function createIdbBackend(): MusicBackend {
  if (typeof indexedDB === 'undefined') {
    const unavailable = async (): Promise<never> => {
      throw new Error('IndexedDB unavailable');
    };
    return { put: unavailable, list: unavailable, get: unavailable, remove: unavailable };
  }
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('idb open failed'));
    });
  const withStore = async <T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore, resolve: (v: T) => void, reject: (e: unknown) => void) => void,
  ): Promise<T> => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        t.onabort = () => reject(t.error ?? new Error('idb transaction aborted'));
        run(t.objectStore(STORE), resolve, reject);
      });
    } finally {
      db.close();
    }
  };
  const request = <T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    withStore<T>(mode, (store, resolve, reject) => {
      const req = make(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('idb request failed'));
    });
  return {
    async put(id, name, data) {
      await request('readwrite', (s) => s.put({ name, data } satisfies TrackRow, id));
    },
    list() {
      return withStore<{ id: string; name: string }[]>('readonly', (store, resolve, reject) => {
        const out: { id: string; name: string }[] = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (cur === null) {
            resolve(out);
            return;
          }
          const row = cur.value as Partial<TrackRow> | null;
          out.push({ id: String(cur.key), name: typeof row?.name === 'string' ? row.name : '' });
          cur.continue();
        };
        req.onerror = () => reject(req.error ?? new Error('idb cursor failed'));
      });
    },
    async get(id) {
      const row = (await request('readonly', (s) => s.get(id))) as Partial<TrackRow> | undefined;
      return row?.data instanceof ArrayBuffer ? row.data : null;
    },
    async remove(id) {
      await request('readwrite', (s) => s.delete(id));
    },
  };
}

export interface MusicStore {
  /** Stores a track and returns its id. Rejects past 20 tracks or above 15MB/track. */
  addFile(name: string, data: ArrayBuffer): Promise<string>;
  tracks(): Promise<{ id: string; name: string }[]>;
  /** Deterministic pick via the core seeded RNG; null when the playlist is empty. */
  randomTrack(rngSeed: number): Promise<{ id: string; name: string; data: ArrayBuffer } | null>;
  remove(id: string): Promise<void>;
}

export function createMusicStore(backend: MusicBackend): MusicStore {
  let counter = 0;
  return {
    async addFile(name, data) {
      if (data.byteLength > MAX_TRACK_BYTES) throw new Error('track too large (15MB cap)');
      const existing = await backend.list();
      if (existing.length >= MAX_TRACKS) throw new Error('playlist full (20-track cap)');
      const id = `m${Date.now()}-${counter++}`;
      await backend.put(id, name, data);
      return id;
    },
    tracks: () => backend.list(),
    async randomTrack(rngSeed) {
      const all = await backend.list();
      if (all.length === 0) return null;
      const picked = createRng(rngSeed).pick(all);
      const data = await backend.get(picked.id);
      if (data === null) return null;
      return { id: picked.id, name: picked.name, data };
    },
    remove: (id) => backend.remove(id),
  };
}
