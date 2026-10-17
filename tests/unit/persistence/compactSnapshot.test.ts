import { describe, expect, it } from 'vitest';

import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { compactSnapshot, parseWorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { createListStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';
import type { DataSource } from '@/types/source';

function memoryBackend(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

let ids = 0;
function makeStore(backend: StorageLike = memoryBackend()) {
  return createListStore({
    storage: createWorkspaceStorage(backend),
    now: () => '2026-10-17T00:00:00.000Z',
    createId: () => `id-${(ids += 1)}`,
  });
}

const films: DataSource = {
  format: 'yaml',
  document: {
    movies: [
      { title: 'Alien', year: 1979 },
      { title: 'Arrival', year: 2016 },
      { title: 'Aliens', year: 1986 },
    ],
  },
  arrayPath: ['movies'],
};

/** Written and read back, the way storage and session files carry it. */
function roundTrip(store: ReturnType<typeof makeStore>) {
  return parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(store.getState().snapshot()!))));
}

describe('compactSnapshot', () => {
  it('names each item by its entry rather than writing its value again', () => {
    const store = makeStore();
    store.getState().startRanking({ source: films, roles: { labelField: 'title' } });

    const items = compactSnapshot(store.getState().snapshot()!).workspace.lists.movies!.items;

    expect(items.map((item) => item.entry)).toEqual([0, 1, 2]);
    expect(items.every((item) => item.value === undefined)).toBe(true);
  });

  it('reads back exactly what was written', () => {
    const store = makeStore();
    store.getState().startRanking({ source: films, roles: { labelField: 'title' } });
    const [alien, arrival] = openList(store).items;
    store.getState().recordComparison(alien!.id, arrival!.id, 'right');

    expect(roundTrip(store)).toEqual(store.getState().snapshot());
  });

  it('finds an entry by its value once an edit has moved it', () => {
    const store = makeStore();
    store.getState().startRanking({ source: films, roles: { labelField: 'title' } });
    const reordered: DataSource = {
      ...films,
      document: {
        movies: [
          { title: 'Aliens', year: 1986 },
          { title: 'Alien', year: 1979 },
          { title: 'Arrival', year: 2016 },
        ],
      },
    };
    store.getState().applyEdits({ source: reordered, roles: { labelField: 'title' } });

    const items = compactSnapshot(store.getState().snapshot()!).workspace.lists.movies!.items;
    expect(items.every((item) => item.entry !== undefined)).toBe(true);
    expect(roundTrip(store)).toEqual(store.getState().snapshot());
  });

  it('keeps the value of an item the document no longer holds', () => {
    const store = makeStore();
    store.getState().startRanking({ source: films, roles: { labelField: 'title' } });
    const trimmed: DataSource = {
      ...films,
      document: {
        movies: [
          { title: 'Alien', year: 1979 },
          { title: 'Arrival', year: 2016 },
        ],
      },
    };
    store.getState().applyEdits({ source: trimmed, roles: { labelField: 'title' } });

    const items = compactSnapshot(store.getState().snapshot()!).workspace.lists.movies!.items;
    const removed = items.filter((item) => item.entry === undefined);
    expect(removed.map((item) => item.value)).toEqual([{ title: 'Aliens', year: 1986 }]);
    expect(roundTrip(store)).toEqual(store.getState().snapshot());
  });

  it('saves the space of every item value, which the document already holds', () => {
    const store = makeStore();
    const many = Array.from({ length: 300 }, (_, index) => ({
      title: `Film ${index}`,
      synopsis: 'x'.repeat(200),
    }));
    store
      .getState()
      .startRanking({ source: { ...films, document: { movies: many } }, roles: { labelField: 'title' } });
    const snapshot = store.getState().snapshot()!;

    const full = JSON.stringify(snapshot).length;
    const compact = JSON.stringify(compactSnapshot(snapshot)).length;
    const values = many.reduce((sum, movie) => sum + JSON.stringify(movie).length, 0);
    expect(full - compact).toBeGreaterThan(values * 0.95);
  });

  it('rejects an item that names an entry the document does not have', () => {
    const store = makeStore();
    store.getState().startRanking({ source: films, roles: {} });
    const stored = JSON.parse(JSON.stringify(compactSnapshot(store.getState().snapshot()!)));
    stored.workspace.lists.movies.items[0].entry = 99;

    expect(parseWorkspaceSnapshot(stored)).toBeNull();
  });
});

describe('saving lists that are not text or objects', () => {
  it('reloads a list of numbers, which the old item check turned away', () => {
    const backend = memoryBackend();
    makeStore(backend)
      .getState()
      .startRanking({
        source: {
          format: 'yaml',
          document: { scores: [3, 1, 2], flags: [true, false] },
          arrayPath: ['scores'],
        },
        roles: {},
      });

    const reloaded = makeStore(backend);
    reloaded.getState().hydrate();

    expect(openList(reloaded).items.map((item) => item.value)).toEqual([3, 1, 2]);
  });
});
