import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createMusicStore, MAX_TRACKS, MAX_TRACK_BYTES, type MusicBackend } from './music';

/** In-memory MusicBackend: tests never touch IndexedDB (node env has none). */
function fakeBackend(): MusicBackend {
  const rows = new Map<string, { name: string; data: ArrayBuffer }>();
  return {
    async put(id, name, data) {
      rows.set(id, { name, data });
    },
    async list() {
      return [...rows.entries()].map(([id, r]) => ({ id, name: r.name }));
    },
    async get(id) {
      return rows.get(id)?.data ?? null;
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

const buf = (bytes: number, fill = 7): ArrayBuffer => {
  const b = new Uint8Array(bytes);
  b.fill(fill);
  return b.buffer;
};

describe('music store', () => {
  it('adds a file, lists it, and round-trips the bytes', async () => {
    const store = createMusicStore(fakeBackend());
    const id = await store.addFile('dance-hit.mp3', buf(16, 42));
    const tracks = await store.tracks();
    expect(tracks).toEqual([{ id, name: 'dance-hit.mp3' }]);
    const picked = await store.randomTrack(1);
    expect(picked?.id).toBe(id);
    expect(picked?.name).toBe('dance-hit.mp3');
    expect(new Uint8Array(picked!.data)).toEqual(new Uint8Array(buf(16, 42)));
  });

  it('rejects the 21st track (20-track cap)', async () => {
    const store = createMusicStore(fakeBackend());
    for (let i = 0; i < MAX_TRACKS; i++) {
      await store.addFile(`t${i}.mp3`, buf(4));
    }
    await expect(store.addFile('overflow.mp3', buf(4))).rejects.toThrow();
    expect((await store.tracks()).length).toBe(MAX_TRACKS);
  });

  it('rejects tracks over 15MB and accepts exactly 15MB', async () => {
    const store = createMusicStore(fakeBackend());
    await expect(store.addFile('huge.mp3', buf(MAX_TRACK_BYTES + 1))).rejects.toThrow();
    expect((await store.tracks()).length).toBe(0);
    await store.addFile('edge.mp3', buf(MAX_TRACK_BYTES));
    expect((await store.tracks()).length).toBe(1);
  });

  it('randomTrack is deterministic for a given seed and follows core RNG pick', async () => {
    const store = createMusicStore(fakeBackend());
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await store.addFile(`t${i}.mp3`, buf(4, i)));
    const seed = 12345;
    const a = await store.randomTrack(seed);
    const b = await store.randomTrack(seed);
    expect(a?.id).toBe(b?.id);
    const expected = createRng(seed).pick(await store.tracks());
    expect(a?.id).toBe(expected.id);
  });

  it('remove drops the track from the list', async () => {
    const store = createMusicStore(fakeBackend());
    const id1 = await store.addFile('a.mp3', buf(4));
    const id2 = await store.addFile('b.mp3', buf(4));
    await store.remove(id1);
    expect(await store.tracks()).toEqual([{ id: id2, name: 'b.mp3' }]);
  });

  it('randomTrack returns null when the store is empty', async () => {
    const store = createMusicStore(fakeBackend());
    expect(await store.randomTrack(99)).toBeNull();
  });
});
