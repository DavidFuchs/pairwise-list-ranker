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

  it('starts the preview on the ranked tab', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().previewTab).toBe('ranked');
  });

  it('defaults alreadyRanked to false', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().workspace?.alreadyRanked).toBe(false);
  });

  it('records alreadyRanked when the caller marks the list as ranked', () => {
    store.getState().startRanking({ source: nested, roles: {}, alreadyRanked: true });

    expect(store.getState().workspace?.alreadyRanked).toBe(true);
    expect(store.getState().ranking()[0]?.state.rating).toBeGreaterThan(1500);
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

  /** The reported bug: an edited entry fell to the bottom of the list. */
  it('keeps an edited entry where the user put it', () => {
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Aliens' }, { title: 'Arrival' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().ranking().map((entry) => entry.item.value)).toEqual([
      { title: 'Aliens' },
      { title: 'Arrival' },
    ]);
  });

  it('applies a reorder of the very same entries', () => {
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Arrival' }, { title: 'Alien' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items.filter((item) => item.active).map((item) => item.value)).toEqual([
      { title: 'Arrival' },
      { title: 'Alien' },
    ]);
  });

  it('keeps deactivated items so their comparisons still resolve', () => {
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Alien' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items).toHaveLength(2);
    expect(store.getState().items.filter((item) => !item.active)).toHaveLength(1);
  });

  it('keeps the workspace id, so items still belong to it', () => {
    const id = store.getState().workspace?.id;

    store.getState().applyEdits({ source: nested, roles: {} });

    expect(store.getState().workspace?.id).toBe(id);
  });

  it('leaves alreadyRanked untouched when the caller does not specify it', () => {
    store.getState().applyEdits({ source: nested, roles: { labelField: 'title' } });

    expect(store.getState().workspace?.alreadyRanked).toBe(false);
  });

  it('updates alreadyRanked when the caller specifies it', () => {
    store
      .getState()
      .applyEdits({ source: nested, roles: { labelField: 'title' }, alreadyRanked: true });

    expect(store.getState().workspace?.alreadyRanked).toBe(true);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    const second = makeStore(backend);
    second.getState().hydrate();

    expect(second.getState().workspace?.roles.labelField).toBe('title');
    expect(second.getState().workspace?.source.document).toEqual(nested.document);
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


describe('reorderAndRestart', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
  });

  it('applies the new order', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().items.map((item) => item.value)).toEqual([
      { title: 'Arrival' },
      { title: 'Alien' },
    ]);
  });

  it('clears the comparison history', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('writes the new order into the source document', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());
    const document = store.getState().workspace?.source.document as {
      movies: { title: string }[];
    };

    expect(document.movies.map((entry) => entry.title)).toEqual(['Arrival', 'Alien']);
  });

  it('keeps the wrapper keys of the source document', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().workspace?.source.document).toMatchObject({ owner: 'david' });
  });

  it('regenerates the raw text, so editing shows the new order', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());
    const rawText = store.getState().workspace?.source.rawText ?? '';

    expect(rawText.indexOf('Arrival')).toBeLessThan(rawText.indexOf('Alien'));
  });

  it('drops items that were removed during comparison', () => {
    const ids = store.getState().items.map((item) => item.id);
    store.getState().removeItem(ids[0] ?? '');

    store.getState().reorderAndRestart([ids[1] ?? '']);

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]?.value).toEqual({ title: 'Arrival' });
  });

  it('ignores ids that are not in the list', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids, 'nonsense']);

    expect(store.getState().items).toHaveLength(2);
  });

  it('does nothing without a workspace', () => {
    const empty = makeStore();

    empty.getState().reorderAndRestart(['a']);

    expect(empty.getState().workspace).toBeNull();
  });

  it('seeds ratings from the hand-arranged order instead of resetting flat', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().workspace?.alreadyRanked).toBe(true);
    expect(store.getState().ranking()[0]?.item.value).toEqual({ title: 'Arrival' });
    expect(store.getState().ranking()[0]?.state.rating).toBeGreaterThan(1500);
  });
});
