import { beforeEach, describe, expect, it } from 'vitest';

import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { createListStore } from '@/lib/state/useListStore';
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

const nested: DataSource = {
  format: 'yaml',
  rawText: 'movies:\n  - title: Alien\n  - title: Arrival\n',
  document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
  arrayPath: ['movies'],
};

let ids = 0;

function makeStore(backend = memoryBackend()) {
  ids = 0;
  return createListStore({
    storage: createWorkspaceStorage(backend),
    now: () => '2026-08-16T00:00:00.000Z',
    createId: () => `id-${(ids += 1)}`,
  });
}

describe('startRanking', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  it('creates one item per entry of the chosen array', () => {
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    expect(store.getState().items.map((item) => item.value)).toEqual([
      { title: 'Alien' },
      { title: 'Arrival' },
    ]);
  });

  it('keeps the source document and the roles', () => {
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const workspace = store.getState().workspace;

    expect(workspace?.source.document).toEqual(nested.document);
    expect(workspace?.roles).toEqual({ labelField: 'title' });
  });

  it('names the workspace, without touching the document', () => {
    store.getState().startRanking({ source: nested, roles: {}, name: 'Films' });

    expect(store.getState().workspace?.name).toBe('Films');
    expect(store.getState().workspace?.source.document).toEqual(nested.document);
  });

  it('defaults the name', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().workspace?.name).toBe('Untitled list');
  });

  it('starts the preview on the ranked tab', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().previewTab).toBe('ranked');
  });

  it('clears history from a previous list', () => {
    store.getState().startRanking({ source: nested, roles: {} });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');

    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().comparisonEvents).toEqual([]);
  });
});

describe('applyEdits', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
  });

  it('keeps ids, and therefore history, for unchanged entries', () => {
    const before = store.getState().items.map((item) => item.id);
    const edited: DataSource = {
      ...nested,
      document: {
        owner: 'david',
        movies: [{ title: 'Alien' }, { title: 'Arrival' }, { title: 'Solaris' }],
      },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items.slice(0, 2).map((item) => item.id)).toEqual(before);
    expect(store.getState().comparisonEvents).toHaveLength(1);
  });

  it('adds new entries as unranked items', () => {
    const edited: DataSource = {
      ...nested,
      document: {
        owner: 'david',
        movies: [{ title: 'Alien' }, { title: 'Arrival' }, { title: 'Solaris' }],
      },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items).toHaveLength(3);
    expect(store.getState().items[2]?.value).toEqual({ title: 'Solaris' });
  });

  it('deactivates entries that disappeared, rather than deleting them', () => {
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Alien' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items).toHaveLength(2);
    expect(store.getState().items[1]?.active).toBe(false);
    expect(store.getState().comparisonEvents).toHaveLength(1);
  });

  it('replaces the stored source and roles', () => {
    const edited: DataSource = { ...nested, rawText: 'edited' };

    store
      .getState()
      .applyEdits({ source: edited, roles: { labelField: 'title', positionField: 'order' } });

    expect(store.getState().workspace?.source.rawText).toBe('edited');
    expect(store.getState().workspace?.roles.positionField).toBe('order');
  });

  it('keeps the workspace id, so items still belong to it', () => {
    const id = store.getState().workspace?.id;

    store.getState().applyEdits({ source: nested, roles: {} });

    expect(store.getState().workspace?.id).toBe(id);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: nested, roles: { labelField: 'title' }, name: 'Films' });

    const second = makeStore(backend);
    second.getState().hydrate();

    expect(second.getState().workspace?.name).toBe('Films');
    expect(second.getState().items).toHaveLength(2);
    expect(second.getState().hydrated).toBe(true);
  });

  it('marks itself hydrated even with nothing stored', () => {
    const store = makeStore();
    store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().workspace).toBeNull();
  });

  it('records why a save did not happen', () => {
    const store = createListStore({
      storage: createWorkspaceStorage(null),
      now: () => '2026-08-16T00:00:00.000Z',
      createId: () => 'id-1',
    });

    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().saveOutcome).toBe('unavailable');
    expect(store.getState().items).toHaveLength(2);
  });

  it('clears storage on reset', () => {
    const backend = memoryBackend();
    const store = makeStore(backend);
    store.getState().startRanking({ source: nested, roles: {} });

    store.getState().reset();

    expect(store.getState().workspace).toBeNull();
    expect(backend.data.size).toBe(0);
  });
});

describe('resume', () => {
  it('starts unresumed and can be marked', () => {
    const store = makeStore();

    expect(store.getState().resumed).toBe(false);
    store.getState().markResumed();
    expect(store.getState().resumed).toBe(true);
  });
});

describe('renaming', () => {
  it('renames without touching the document', () => {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: {} });

    store.getState().setName('Best films');

    expect(store.getState().workspace?.name).toBe('Best films');
    expect(store.getState().workspace?.source.document).toEqual(nested.document);
  });
});
