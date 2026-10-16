import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { WORKSPACE_STORAGE_KEY, createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { buildProgressFile } from '@/lib/progress/progressFile';
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

describe('switchList', () => {
  let store: ReturnType<typeof makeStore>;
  const actors: DataSource = {
    format: 'yaml',
    rawText: 'movies:\n  - title: Alien\n  - title: Arrival\nactors:\n  - Weaver\n  - Adams\n',
    document: {
      owner: 'david',
      movies: [{ title: 'Alien' }, { title: 'Arrival' }],
      actors: ['Weaver', 'Adams'],
    },
    arrayPath: ['actors'],
  };

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
  });

  it('builds fresh items for a list never visited before', () => {
    store.getState().switchList({ source: actors, roles: {} });

    expect(store.getState().items.map((item) => item.value)).toEqual(['Weaver', 'Adams']);
    expect(store.getState().comparisonEvents).toEqual([]);
    expect(store.getState().workspace?.source.arrayPath).toEqual(['actors']);
  });

  it('archives the list being left instead of discarding it', () => {
    const movieItems = store.getState().items;
    const movieComparisons = store.getState().comparisonEvents;

    store.getState().switchList({ source: actors, roles: {} });

    const saved = store.getState().savedLists.find((list) => list.arrayPath.join('.') === 'movies');
    expect(saved?.items).toEqual(movieItems);
    expect(saved?.comparisonEvents).toEqual(movieComparisons);
  });

  it('restores the ranking of a previously visited list exactly as it was left', () => {
    const movieItems = store.getState().items;
    const movieComparisons = store.getState().comparisonEvents;

    store.getState().switchList({ source: actors, roles: {} });
    store.getState().switchList({ source: nested, roles: { labelField: 'title' } });

    expect(store.getState().items).toEqual(movieItems);
    expect(store.getState().comparisonEvents).toEqual(movieComparisons);
  });

  /*
   * Which fields a restored list comes back on is the caller's answer, not the
   * archived one: the data screen sends what the user is looking at, and the
   * switcher sends selectListConfig's - which returns a hand-configured list's
   * own setup, and re-derives every other list from the document defaults. That
   * is what lets a change to the defaults reach a list parked before it.
   */
  it('restores a list on the setup it is switched back with', () => {
    store.getState().switchList({ source: actors, roles: {} });
    store.getState().switchList({ source: nested, roles: { labelField: 'renamed' } });

    expect(store.getState().workspace?.roles).toEqual({ labelField: 'renamed' });
  });

  it('leaves the list being switched to out of savedLists once it is active', () => {
    store.getState().switchList({ source: actors, roles: {} });

    expect(
      store.getState().savedLists.some((list) => list.arrayPath.join('.') === 'actors'),
    ).toBe(false);
  });

  it('round-trips saved lists through storage', () => {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = first.getState().items;
    first.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
    first.getState().switchList({ source: actors, roles: {} });

    const second = makeStore(backend);
    second.getState().hydrate();

    expect(second.getState().savedLists).toHaveLength(1);
    expect(second.getState().savedLists[0]?.comparisonEvents).toHaveLength(1);
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


const triple: DataSource = {
  format: 'yaml',
  rawText: 'movies:\n  - title: Alien\n  - title: Arrival\n  - title: Aliens\n',
  document: {
    owner: 'david',
    movies: [{ title: 'Alien' }, { title: 'Arrival' }, { title: 'Aliens' }],
  },
  arrayPath: ['movies'],
};

describe('reorderItem', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: triple, roles: { labelField: 'title' } });
  });

  function idFor(title: string): string {
    return (
      store
        .getState()
        .items.find((item) => (item.value as { title: string }).title === title)?.id ?? ''
    );
  }

  it('records one placement under the item now above it', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(store.getState().comparisonEvents).toEqual([
      expect.objectContaining({ leftItemId: aliens, rightItemId: alien, outcome: 'place_below' }),
    ]);
  });

  it('anchors to the item below when dropped at the top', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [aliens, alien, arrival]);

    expect(store.getState().comparisonEvents).toEqual([
      expect.objectContaining({ leftItemId: aliens, rightItemId: alien, outcome: 'place_above' }),
    ]);
  });

  it('can be undone', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [aliens, alien, arrival]);
    store.getState().undo();

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('keeps existing comparison history rather than clearing it', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().recordComparison(alien, arrival, 'left');

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(store.getState().comparisonEvents).toHaveLength(2);
    expect(store.getState().comparisonEvents[0]).toEqual(
      expect.objectContaining({ leftItemId: alien, rightItemId: arrival, outcome: 'left' }),
    );
  });

  it('leaves the item array and source document untouched', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(store.getState().items.map((item) => item.value)).toEqual([
      { title: 'Alien' },
      { title: 'Arrival' },
      { title: 'Aliens' },
    ]);
    expect(store.getState().workspace?.source.document).toEqual(triple.document);
  });

  it('puts the item in the derived ranking exactly where it was dropped', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(store.getState().ranking().map((entry) => (entry.item.value as { title: string }).title)).toEqual([
      'Alien',
      'Aliens',
      'Arrival',
    ]);
  });

  it('does not set alreadyRanked', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(store.getState().workspace?.alreadyRanked).toBe(false);
  });

  it('ignores an id that is not in the new order', () => {
    store.getState().reorderItem('nonsense', [idFor('Alien'), idFor('Arrival'), idFor('Aliens')]);

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('ignores an item that has been removed', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().removeItem(aliens);

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('does nothing without a workspace', () => {
    const empty = makeStore();

    empty.getState().reorderItem('a', ['a', 'b']);

    expect(empty.getState().workspace).toBeNull();
  });
});

describe('reset', () => {
  it('forgets a list the switcher asked the data screen to configure', () => {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    store.getState().requestListSwitch(['actors']);

    store.getState().reset();

    expect(store.getState().pendingSwitchPath).toBeNull();
  });
});

describe('document-wide list defaults', () => {
  let store: ReturnType<typeof makeStore>;
  const actors: DataSource = {
    format: 'yaml',
    rawText: '',
    document: {
      movies: [{ title: 'Alien' }, { title: 'Arrival' }],
      actors: [{ name: 'Weaver' }, { name: 'Adams' }],
    },
    arrayPath: ['actors'],
  };
  const movies: DataSource = { ...actors, arrayPath: ['movies'] };

  beforeEach(() => {
    store = makeStore();
  });

  it('takes the defaults from the first list the user sets up', () => {
    store.getState().startRanking({
      source: movies,
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });

    expect(store.getState().workspace?.listDefaults).toEqual({
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });
  });

  it('counts the first list as set up by hand', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    expect(store.getState().workspace?.configuredExplicitly).toBe(true);
  });

  it('rewrites the defaults when the user asks for it', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().setListDefaults({ roles: { labelField: 'name' }, alreadyRanked: true });

    expect(store.getState().workspace?.listDefaults).toEqual({
      roles: { labelField: 'name' },
      alreadyRanked: true,
    });
  });

  it('leaves the list being edited alone when the defaults are rewritten', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().setListDefaults({ roles: { labelField: 'name' }, alreadyRanked: true });

    expect(store.getState().workspace?.roles).toEqual({ labelField: 'title' });
    expect(store.getState().workspace?.alreadyRanked).toBe(false);
  });

  it('has no defaults to set before there is a document', () => {
    store.getState().setListDefaults({ roles: { labelField: 'name' }, alreadyRanked: true });

    expect(store.getState().workspace).toBeNull();
  });

  it('leaves the defaults alone for an ordinary edit', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().applyEdits({
      source: movies,
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });

    expect(store.getState().workspace?.listDefaults.alreadyRanked).toBe(false);
  });

  it('leaves a list derived from the defaults unmarked', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store
      .getState()
      .switchList({ source: actors, roles: { labelField: 'name' }, configuredExplicitly: false });

    expect(store.getState().workspace?.configuredExplicitly).toBe(false);
  });

  it('marks a list the user set up on the data screen', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().switchList({ source: actors, roles: { labelField: 'name' } });

    expect(store.getState().workspace?.configuredExplicitly).toBe(true);
  });

  it('keeps that mark on the list it archives', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store
      .getState()
      .switchList({ source: actors, roles: { labelField: 'name' }, configuredExplicitly: false });

    const saved = store.getState().savedLists.find((list) => list.arrayPath.join('.') === 'movies');
    expect(saved?.configuredExplicitly).toBe(true);
  });

  it('does not unmark a list that was set up by hand when it is switched back to', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });
    store.getState().switchList({ source: actors, roles: { labelField: 'name' } });
    store
      .getState()
      .switchList({ source: movies, roles: { labelField: 'title' }, configuredExplicitly: false });

    expect(store.getState().workspace?.configuredExplicitly).toBe(true);
  });

  it('carries the defaults across a switch, so the whole document keeps one answer', () => {
    store.getState().startRanking({
      source: movies,
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });

    store
      .getState()
      .switchList({ source: actors, roles: { labelField: 'name' }, configuredExplicitly: false });

    expect(store.getState().workspace?.listDefaults).toEqual({
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });
  });
});

describe('undo', () => {
  function started() {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    return store;
  }

  it('takes back the last comparison', () => {
    const store = started();
    const [a, b] = store.getState().items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    expect(store.getState().comparisonEvents).toHaveLength(1);

    store.getState().undo();

    expect(store.getState().comparisonEvents).toHaveLength(0);
    expect(store.getState().undoStack).toHaveLength(0);
  });

  it('brings back a removed item', () => {
    const store = started();
    const [a] = store.getState().items;
    store.getState().removeItem(a!.id);
    expect(store.getState().items[0]!.active).toBe(false);

    store.getState().undo();

    expect(store.getState().items[0]!.active).toBe(true);
  });

  it('takes back a hand reorder in one step', () => {
    const store = started();
    const [a, b] = store.getState().items;
    store.getState().reorderItem(b!.id, [b!.id, a!.id]);
    const added = store.getState().comparisonEvents.length;
    expect(added).toBeGreaterThan(0);

    store.getState().undo();

    expect(store.getState().comparisonEvents).toHaveLength(0);
  });

  it('does nothing when there is nothing to undo', () => {
    const store = started();
    store.getState().undo();
    expect(store.getState().comparisonEvents).toHaveLength(0);
  });
});

describe('loadProgress', () => {
  it('replaces comparisons with those in the file, matched by item value', () => {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [a, b] = store.getState().items;
    store.getState().recordComparison(a!.id, b!.id, 'right_strong');
    const file = buildProgressFile(
      store.getState().items,
      store.getState().comparisonEvents,
      ['movies'],
      '2026-08-16T00:00:00.000Z',
    );

    const fresh = makeStore();
    fresh.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const result = fresh.getState().loadProgress(file);

    expect(result.matchedEvents).toBe(1);
    expect(fresh.getState().comparisonEvents[0]).toMatchObject({ outcome: 'right_strong' });
    expect(fresh.getState().ranking()[0]!.item.value).toEqual({ title: 'Arrival' });
  });
});

describe('delayed saving', () => {
  it('batches writes and flushes on demand', () => {
    vi.useFakeTimers();
    try {
      const backend = memoryBackend();
      const store = createListStore({
        storage: createWorkspaceStorage(backend),
        createId: () => `id-${(ids += 1)}`,
        saveDelayMs: 500,
      });
      store.getState().startRanking({ source: nested, roles: {} });
      expect(backend.data.has(WORKSPACE_STORAGE_KEY)).toBe(false);

      vi.advanceTimersByTime(500);
      expect(backend.data.has(WORKSPACE_STORAGE_KEY)).toBe(true);

      backend.data.clear();
      const [a, b] = store.getState().items;
      store.getState().recordComparison(a!.id, b!.id, 'left');
      store.getState().flush();
      expect(backend.data.has(WORKSPACE_STORAGE_KEY)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('hydrate with delayed saving', () => {
  it('does not replace newer in-memory state with the older saved copy', () => {
    vi.useFakeTimers();
    try {
      const backend = memoryBackend();
      const store = createListStore({
        storage: createWorkspaceStorage(backend),
        createId: () => `id-${(ids += 1)}`,
        saveDelayMs: 500,
      });
      store.getState().hydrate();
      store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
      store.getState().flush();

      store.getState().applyEdits({
        source: nested,
        roles: { labelField: 'title', summaryFields: ['year'] },
      });
      // A screen mounting before the delayed save has fired.
      store.getState().hydrate();

      expect(store.getState().workspace?.roles.summaryFields).toEqual(['year']);
    } finally {
      vi.useRealTimers();
    }
  });
});
