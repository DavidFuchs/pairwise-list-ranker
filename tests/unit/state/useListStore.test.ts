import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyncBuilder } from '@/lib/engine/coldBuild';
import { createEngineCache } from '@/lib/engine/engineCache';
import { createEngineHost } from '@/lib/engine/engineHost';
import type { EngineHost } from '@/lib/engine/engineHost';
import { replay } from '@/lib/ranking/bt/engine';
import { openSealed } from '@/lib/ranking/bt/sealed';
import { toEngineList } from '@/lib/engine/engineList';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { WORKSPACE_STORAGE_KEY, createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { activeItems, isItemActive } from '@/lib/state/membership';
import { selectExportText } from '@/lib/state/selectors';
import { createListStore, undoOffer } from '@/lib/state/useListStore';
import type { DataSource, RankedList } from '@/types/source';
import { listAtPath, openList } from '@/tests/helpers/lists';
import { between } from '@/tests/helpers/between';

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
  document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
  arrayPath: ['movies'],
};

let ids = 0;

/** A host that builds at once and caches nothing, so no test leans on the app-wide one. */
function testHost(): EngineHost {
  return createEngineHost({ builder: createSyncBuilder(), cache: createEngineCache(null) });
}

function makeStore(backend = memoryBackend(), host = testHost()) {
  ids = 0;
  return createListStore({
    storage: createWorkspaceStorage(backend),
    now: () => '2026-08-16T00:00:00.000Z',
    createId: () => `id-${(ids += 1)}`,
    host,
  });
}

describe('startRanking', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  it('creates one item per entry of the chosen array', () => {
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    expect(openList(store).items.map((item) => item.value)).toEqual([
      { title: 'Alien' },
      { title: 'Arrival' },
    ]);
  });

  it('keeps the source document and the roles', () => {
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const workspace = store.getState().workspace;

    expect(workspace?.source.document).toEqual(nested.document);
    expect(openList(store).roles).toEqual({ labelField: 'title' });
  });

  it('starts the preview on the ranked tab', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().previewTab).toBe('ranked');
  });

  it('defaults the starting order to unordered', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(openList(store).initialStartingOrder).toBe('unordered');
  });

  it('records the starting order the caller names', () => {
    store.getState().startRanking({ source: nested, roles: {}, startingOrder: 'ranked' });

    expect(openList(store).initialStartingOrder).toBe('ranked');
  });

  it("makeList's originalItemIds match the import order", () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(openList(store).originalItemIds).toEqual(openList(store).items.map((item) => item.id));
    expect(openList(store).originalItemIds).toHaveLength(2);
    expect(openList(store).events).toEqual([]);
  });

  it('clears history from a previous list', () => {
    store.getState().startRanking({ source: nested, roles: {} });
    const [left, right] = openList(store).items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');

    store.getState().startRanking({ source: nested, roles: {} });

    expect(openList(store).events).toEqual([]);
  });
});

describe('direct actions on a list with history', () => {
  const titles = (list: string[]): DataSource => ({
    format: 'json',
    document: { movies: list.map((title) => ({ title })) },
    arrayPath: ['movies'],
  });
  const shown = (store: ReturnType<typeof makeStore>, host: EngineHost) =>
    host.rankingNow(openList(store)).map((item) => (item.value as { title: string }).title);
  const shownIds = (store: ReturnType<typeof makeStore>, host: EngineHost) =>
    host.rankingNow(openList(store)).map((item) => item.id);
  const placementsSince = (store: ReturnType<typeof makeStore>, before: number) =>
    openList(store)
      .events.slice(before)
      .flatMap((event) => (event.kind === 'placement' ? [event] : []));

  /** A small, seeded generator, so a failure names the case that broke. */
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  function answered(seed: number, count: number, answers: number, host = testHost()) {
    const store = makeStore(memoryBackend(), host);
    const names = Array.from({ length: count }, (_, index) => `Movie ${index}`);
    store.getState().startRanking({ source: titles(names), roles: { labelField: 'title' } });
    const next = random(seed);
    const outcomes = ['left', 'right', 'left_strong', 'right_strong', 'draw'] as const;
    for (let i = 0; i < answers; i++) {
      const items = openList(store).items;
      const left = items[Math.floor(next() * count)]!;
      const right = items[Math.floor(next() * count)]!;
      store.getState().recordComparison(left.id, right.id, outcomes[Math.floor(next() * outcomes.length)]!);
    }
    return { store, host, next };
  }

  it('shows every dragged item between the rows it was placed between, warm and cold alike', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { store, host, next } = answered(seed, 14, 40);
      const ids = shownIds(store, host);
      for (let drag = 0; drag < 1 + (seed % 5); drag++) {
        const order = shownIds(store, host);
        const [moved] = order.splice(Math.floor(next() * order.length), 1);
        order.splice(Math.floor(next() * (order.length + 1)), 0, moved!);
        const before = openList(store).events.length;

        store.getState().reorderItem(moved!, order);

        const ranked = shownIds(store, host);
        for (const target of placementsSince(store, before)) {
          expect(between(ranked, target), `seed ${seed}: ${target.itemId}`).toBe(true);
        }
        expect(replay(toEngineList(openList(store))).ranked, `seed ${seed}: cold replay`).toEqual(ranked);
      }
      expect(new Set(shownIds(store, host))).toEqual(new Set(ids));
    }
  });

  it('takes a drag back in one undo', () => {
    const { store, host } = answered(5, 8, 20);
    const order = shown(store, host);
    const ids = shownIds(store, host);

    store.getState().reorderItem(ids.at(-1)!, [ids.at(-1)!, ...ids.slice(0, -1)]);
    expect(shown(store, host)[0]).toBe(order.at(-1));
    store.getState().undo();

    expect(shown(store, host)).toEqual(order);
  });

  it('records a drag before the first answer too, and never rewrites the import', () => {
    const host = testHost();
    const store = makeStore(memoryBackend(), host);
    store.getState().startRanking({ source: titles(['Alien', 'Arrival', 'Stalker']), roles: {} });
    const imported = openList(store).originalItemIds;
    const [alien, arrival, stalker] = openList(store).items.map((item) => item.id);

    store.getState().reorderItem(stalker!, [stalker!, alien!, arrival!]);

    const list = openList(store);
    expect(list.originalItemIds).toEqual(imported);
    expect(list.events.map((event) => event.kind)).toEqual(['placement']);
    expect(shown(store, host)).toEqual(['Stalker', 'Alien', 'Arrival']);
  });

  it('keeps ids, and therefore history, for the items that stay when one is removed', () => {
    const { store, host } = answered(3, 6, 12);
    const before = openList(store);
    const ranked = shownIds(store, host);

    store.getState().removeItem(ranked[2]!);

    const list = openList(store);
    expect(list.items.map((item) => item.id)).toEqual(before.items.map((item) => item.id));
    expect(list.events.slice(0, before.events.length)).toEqual(before.events);
    expect(shownIds(store, host)).toEqual(ranked.filter((id) => id !== ranked[2]));
    expect(isItemActive(list, ranked[2]!)).toBe(false);
  });

  it('brings a removed item back, history and all, with one undo', () => {
    const { store, host } = answered(3, 6, 12);
    const ranked = shownIds(store, host);

    store.getState().removeItem(ranked[2]!);
    store.getState().undo();

    expect(shownIds(store, host)).toEqual(ranked);
    expect(isItemActive(openList(store), ranked[2]!)).toBe(true);
  });

  describe('an item marked as not recognized', () => {
    function withMark() {
      const { store, host } = answered(6, 6, 15);
      const marked = shownIds(store, host)[0]!;
      store.getState().markUnrecognized([marked]);
      expect(shownIds(store, host).at(-1)).toBe(marked);
      return { store, host, marked };
    }

    it('stays marked and last through a drag of another item', () => {
      const { store, host, marked } = withMark();
      const ranked = shownIds(store, host).slice(0, -1);
      const last = ranked.at(-1)!;

      store.getState().reorderItem(last, [last, ...ranked.slice(0, -1), marked]);

      expect(shownIds(store, host).at(-1)).toBe(marked);
      const view = host.view();
      expect(view?.status === 'ready' ? view.unrecognized.map((item) => item.id) : null).toEqual([marked]);
    });

    it('rejoins the ranking when dragged back into it', () => {
      const { store, host, marked } = withMark();
      const ranked = shownIds(store, host).slice(0, -1);

      store.getState().reorderItem(marked, [marked, ...ranked]);

      expect(openList(store).events.at(-1)).toEqual(
        expect.objectContaining({
          kind: 'placement',
          itemId: marked,
        }),
      );
      expect(shownIds(store, host)[0]).toBe(marked);
      const view = host.view();
      expect(view?.status === 'ready' ? view.unrecognized : null).toEqual([]);
    });
  });
});

describe('switchList', () => {
  let store: ReturnType<typeof makeStore>;
  const actors: DataSource = {
    format: 'yaml',
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
    const [left, right] = openList(store).items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
  });

  it('builds fresh items for a list never visited before', () => {
    store.getState().switchList({ source: actors, roles: {} });

    expect(openList(store).items.map((item) => item.value)).toEqual(['Weaver', 'Adams']);
    expect(openList(store).events).toEqual([]);
    expect(store.getState().workspace?.source.arrayPath).toEqual(['actors']);
  });

  it('keeps the list being left instead of discarding it', () => {
    const movieItems = openList(store).items;
    const movieComparisons = openList(store).events;

    store.getState().switchList({ source: actors, roles: {} });

    const saved = listAtPath(store, ['movies']);
    expect(saved?.items).toEqual(movieItems);
    expect(saved?.events).toEqual(movieComparisons);
  });

  it('keeps a list with history on its own starting order when it is switched back to', () => {
    store.getState().switchList({ source: actors, roles: {} });
    store.getState().switchList({ source: nested, roles: { labelField: 'title' }, startingOrder: 'ranked' });

    expect(openList(store).initialStartingOrder).toBe('unordered');
  });

  it('restores the ranking of a previously visited list exactly as it was left', () => {
    const movieItems = openList(store).items;
    const movieComparisons = openList(store).events;

    store.getState().switchList({ source: actors, roles: {} });
    store.getState().switchList({ source: nested, roles: { labelField: 'title' } });

    expect(openList(store).items).toEqual(movieItems);
    expect(openList(store).events).toEqual(movieComparisons);
  });

  /*
   * Which fields a restored list comes back on is the caller's answer, not the
   * one it was left with: the data screen sends what the user is looking at, and the
   * switcher sends selectListConfig's - which returns a hand-configured list's
   * own setup, and re-derives every other list from the document defaults. That
   * is what lets a change to the defaults reach a list left before it.
   */
  it('restores a list on the setup it is switched back with', () => {
    store.getState().switchList({ source: actors, roles: {} });
    store.getState().switchList({ source: nested, roles: { labelField: 'renamed' } });

    expect(openList(store).roles).toEqual({ labelField: 'renamed' });
  });

  it('keeps every list opened, the open one included, under its own path', () => {
    store.getState().switchList({ source: actors, roles: {} });

    expect(Object.keys(store.getState().workspace?.lists ?? {})).toEqual(['movies', 'actors']);
    expect(openList(store).arrayPath).toEqual(['actors']);
  });

  it('round-trips every list through storage', () => {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = openList(first).items;
    first.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
    first.getState().switchList({ source: actors, roles: {} });

    const second = makeStore(backend);
    second.getState().hydrate();

    expect(Object.keys(second.getState().workspace?.lists ?? {})).toHaveLength(2);
    expect(listAtPath(second, ['movies'])?.events).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    const second = makeStore(backend);
    second.getState().hydrate();

    expect(openList(second).roles.labelField).toBe('title');
    expect(second.getState().workspace?.source.document).toEqual(nested.document);
    expect(openList(second).items).toHaveLength(2);
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
    expect(openList(store).items).toHaveLength(2);
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

const triple: DataSource = {
  format: 'yaml',
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
    return openList(store).items.find((item) => (item.value as { title: string }).title === title)?.id ?? '';
  }

  it('records one placement with both neighbours', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).events).toEqual([
      expect.objectContaining({
        kind: 'placement',
        itemId: aliens,
        aboveItemId: alien,
        belowItemId: arrival,
      }),
    ]);
  });

  it('records only the item below when dropped at the top', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [aliens, alien, arrival]);

    const [event] = openList(store).events;
    expect(event).toEqual(expect.objectContaining({ kind: 'placement', itemId: aliens, belowItemId: alien }));
    expect(event).not.toHaveProperty('aboveItemId');
  });

  it('records only the item above when dropped at the bottom', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(alien, [arrival, aliens, alien]);

    const [event] = openList(store).events;
    expect(event).toEqual(expect.objectContaining({ kind: 'placement', itemId: alien, aboveItemId: aliens }));
    expect(event).not.toHaveProperty('belowItemId');
  });

  it('drops a neighbour that is not active', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().removeItem(alien);

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    const placement = openList(store).events.find((event) => event.kind === 'placement');
    expect(placement).toEqual(expect.objectContaining({ itemId: aliens, belowItemId: arrival }));
  });

  it('records nothing when no neighbour is active', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().removeItem(alien);
    store.getState().removeItem(arrival);
    const before = openList(store).events;

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).events).toEqual(before);
  });

  it('can be undone', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [aliens, alien, arrival]);
    store.getState().undo();

    expect(openList(store).events).toEqual([]);
  });

  it('keeps existing comparison history rather than clearing it', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().recordComparison(alien, arrival, 'left');

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).events).toHaveLength(2);
    expect(openList(store).events[0]).toEqual(
      expect.objectContaining({ leftItemId: alien, rightItemId: arrival, outcome: 'left' }),
    );
  });

  it('leaves the item array and source document untouched', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).items.map((item) => item.value)).toEqual([
      { title: 'Alien' },
      { title: 'Arrival' },
      { title: 'Aliens' },
    ]);
    expect(store.getState().workspace?.source.document).toEqual(triple.document);
  });

  it('does not change the starting order', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).initialStartingOrder).toBe('unordered');
  });

  it('ignores an id that is not in the new order', () => {
    store.getState().reorderItem('nonsense', [idFor('Alien'), idFor('Arrival'), idFor('Aliens')]);

    expect(openList(store).events).toEqual([]);
  });

  it('ignores an item that has been removed', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().removeItem(aliens);

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).events.filter((event) => event.kind === 'placement')).toEqual([]);
  });

  it('does nothing without a workspace', () => {
    const empty = makeStore();

    empty.getState().reorderItem('a', ['a', 'b']);

    expect(empty.getState().workspace).toBeNull();
  });
});

describe('markUnrecognized', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: triple, roles: { labelField: 'title' } });
  });

  function idFor(title: string): string {
    return openList(store).items.find((item) => (item.value as { title: string }).title === title)?.id ?? '';
  }

  it('a new list has no sort mode', () => {
    expect(openList(store)).not.toHaveProperty('sortMode');
  });

  it('markUnrecognized records one event for several items, and undo takes all of them back', () => {
    const [alien, arrival] = [idFor('Alien'), idFor('Arrival')];

    store.getState().markUnrecognized([arrival, alien]);

    expect(openList(store).events).toEqual([
      expect.objectContaining({ kind: 'unrecognized', itemIds: [arrival, alien] }),
    ]);
    expect(store.getState().undoStack).toHaveLength(1);
    store.getState().undo();
    expect(openList(store).events).toEqual([]);
  });

  it('markUnrecognized skips items already marked or removed, and records nothing when none are left', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().markUnrecognized([alien]);
    store.getState().removeItem(arrival);

    store.getState().markUnrecognized([alien, arrival, aliens, aliens]);

    expect(openList(store).events.at(-1)).toEqual(
      expect.objectContaining({ kind: 'unrecognized', itemIds: [aliens] }),
    );
    const before = openList(store).events;
    const steps = store.getState().undoStack.length;

    store.getState().markUnrecognized([alien, arrival, aliens]);
    store.getState().markUnrecognized([]);

    expect(openList(store).events).toBe(before);
    expect(store.getState().undoStack).toHaveLength(steps);
  });

  it('reorderItem places a marked item, and the replayed ranking lists it among the ranked again', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().markUnrecognized([aliens]);
    expect(replay(toEngineList(openList(store))).unrecognized).toEqual([aliens]);

    store.getState().reorderItem(aliens, [aliens, alien, arrival]);

    const state = replay(toEngineList(openList(store)));
    expect(state.unrecognized).toEqual([]);
    expect(state.ranked).toContain(aliens);
    expect(openList(store).events.at(-1)).toEqual(
      expect.objectContaining({ kind: 'placement', itemId: aliens, belowItemId: alien }),
    );
  });

  it('reorderItem drops a marked neighbour', () => {
    const [alien, arrival, aliens] = [idFor('Alien'), idFor('Arrival'), idFor('Aliens')];
    store.getState().markUnrecognized([alien]);

    store.getState().reorderItem(aliens, [alien, aliens, arrival]);

    expect(openList(store).events.at(-1)).toEqual(
      expect.objectContaining({ kind: 'placement', itemId: aliens, belowItemId: arrival }),
    );
  });
});

describe('document-wide list defaults', () => {
  let store: ReturnType<typeof makeStore>;
  const actors: DataSource = {
    format: 'yaml',
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
      startingOrder: 'ranked',
    });

    expect(store.getState().workspace?.listDefaults).toEqual({
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
    });
  });

  it('counts the first list as set up by hand', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    expect(openList(store).configuredExplicitly).toBe(true);
  });

  it('rewrites the defaults when the user asks for it', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().setListDefaults({ roles: { labelField: 'name' }, startingOrder: 'ranked' });

    expect(store.getState().workspace?.listDefaults).toEqual({
      roles: { labelField: 'name' },
      startingOrder: 'ranked',
    });
  });

  it('leaves the list being edited alone when the defaults are rewritten', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().setListDefaults({ roles: { labelField: 'name' }, startingOrder: 'ranked' });

    expect(openList(store).roles).toEqual({ labelField: 'title' });
    expect(openList(store).initialStartingOrder).toBe('unordered');
  });

  it('has no defaults to set before there is a document', () => {
    store.getState().setListDefaults({ roles: { labelField: 'name' }, startingOrder: 'ranked' });

    expect(store.getState().workspace).toBeNull();
  });

  it('leaves the defaults alone when the open list is set up again', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().switchList({
      source: movies,
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
    });

    expect(store.getState().workspace?.listDefaults.startingOrder).toBe('unordered');
  });

  it('leaves a list derived from the defaults unmarked', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store
      .getState()
      .switchList({ source: actors, roles: { labelField: 'name' }, configuredExplicitly: false });

    expect(openList(store).configuredExplicitly).toBe(false);
  });

  it('marks a list the user set up on the data screen', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store.getState().switchList({ source: actors, roles: { labelField: 'name' } });

    expect(openList(store).configuredExplicitly).toBe(true);
  });

  it('keeps that mark on the list it leaves', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });

    store
      .getState()
      .switchList({ source: actors, roles: { labelField: 'name' }, configuredExplicitly: false });

    expect(listAtPath(store, ['movies'])?.configuredExplicitly).toBe(true);
  });

  it('does not unmark a list that was set up by hand when it is switched back to', () => {
    store.getState().startRanking({ source: movies, roles: { labelField: 'title' } });
    store.getState().switchList({ source: actors, roles: { labelField: 'name' } });
    store
      .getState()
      .switchList({ source: movies, roles: { labelField: 'title' }, configuredExplicitly: false });

    expect(openList(store).configuredExplicitly).toBe(true);
  });

  it('carries the defaults across a switch, so the whole document keeps one answer', () => {
    store.getState().startRanking({
      source: movies,
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
    });

    store
      .getState()
      .switchList({ source: actors, roles: { labelField: 'name' }, configuredExplicitly: false });

    expect(store.getState().workspace?.listDefaults).toEqual({
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
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
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    expect(openList(store).events).toHaveLength(1);

    store.getState().undo();

    expect(openList(store).events).toHaveLength(0);
    expect(store.getState().undoStack).toHaveLength(0);
  });

  it('brings back a removed item', () => {
    const store = started();
    const [a] = openList(store).items;
    store.getState().removeItem(a!.id);
    expect(isItemActive(openList(store), openList(store).items[0]!.id)).toBe(false);

    store.getState().undo();

    expect(isItemActive(openList(store), openList(store).items[0]!.id)).toBe(true);
    expect(openList(store).events).toEqual([]);
  });

  it('takes back a removal after an answer, keeping the answer', () => {
    const store = started();
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    const answer = openList(store).events[0]!;
    store.getState().removeItem(a!.id);

    store.getState().undo();

    expect(openList(store).events).toEqual([answer]);
    expect(isItemActive(openList(store), openList(store).items[0]!.id)).toBe(true);
    expect(store.getState().undoStack).toEqual([
      { actionId: answer.actionId, listIds: [openList(store).id] },
    ]);
  });

  it('takes back a hand reorder in one step', () => {
    const store = started();
    const [a, b] = openList(store).items;
    store.getState().reorderItem(b!.id, [b!.id, a!.id]);
    const added = openList(store).events.length;
    expect(added).toBeGreaterThan(0);

    store.getState().undo();

    expect(openList(store).events).toHaveLength(0);
  });

  it('does nothing when there is nothing to undo', () => {
    const store = started();
    store.getState().undo();
    expect(openList(store).events).toHaveLength(0);
  });
});

describe('recordComparison', () => {
  function started() {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    return store;
  }

  it('appends one pair event', () => {
    const store = started();
    const [a, b] = openList(store).items;

    store.getState().recordComparison(a!.id, b!.id, 'left_strong');

    expect(openList(store).events).toEqual([
      expect.objectContaining({
        kind: 'pair',
        listId: openList(store).id,
        leftItemId: a!.id,
        rightItemId: b!.id,
        outcome: 'left_strong',
      }),
    ]);
  });

  it('records a draw as a pair event', () => {
    const store = started();
    const [a, b] = openList(store).items;

    store.getState().recordComparison(a!.id, b!.id, 'draw');

    expect(openList(store).events[0]).toEqual(expect.objectContaining({ kind: 'pair', outcome: 'draw' }));
  });

  it('ignores a comparison against a removed item', () => {
    const store = started();
    const [a, b] = openList(store).items;
    store.getState().removeItem(b!.id);

    store.getState().recordComparison(a!.id, b!.id, 'left');

    expect(openList(store).events.filter((event) => event.kind === 'pair')).toEqual([]);
  });
});

describe('removeItem', () => {
  function started() {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    return store;
  }

  it('appends one removal event and deactivates the item', () => {
    const store = started();
    const [a] = openList(store).items;

    store.getState().removeItem(a!.id);

    expect(openList(store).events).toEqual([expect.objectContaining({ kind: 'removal', itemIds: [a!.id] })]);
    expect(isItemActive(openList(store), openList(store).items[0]!.id)).toBe(false);
  });

  it('removal takes an item out of the ranking and the export and keeps it in the fit', () => {
    const host = testHost();
    const store = makeStore(memoryBackend(), host);
    const source: DataSource = {
      format: 'json',
      document: { movies: ['Alien', 'Arrival', 'Brazil', 'Contact'].map((title) => ({ title })) },
      arrayPath: ['movies'],
    };
    store.getState().startRanking({ source, roles: { labelField: 'title' } });
    const [alien, arrival, brazil] = openList(store).items.map((item) => item.id);
    store.getState().recordComparison(alien!, arrival!, 'left');
    store.getState().recordComparison(arrival!, brazil!, 'left');
    const before = replay(toEngineList(openList(store)));

    store.getState().removeItem(arrival!);

    const titlesOf = (values: unknown[]) => values.map((value) => (value as { title: string }).title);
    const shown = host.rankingNow(openList(store));
    expect(titlesOf(shown.map((item) => item.value))).not.toContain('Arrival');
    // The export as the app makes it: the document now, in the order the engine host gives.
    const exported = JSON.parse(selectExportText(store.getState().workspace, 'json')) as {
      movies: unknown[];
    };
    expect(titlesOf(exported.movies).sort()).toEqual(['Alien', 'Brazil', 'Contact']);
    const after = replay(toEngineList(openList(store)));
    expect(after.ranked).not.toContain(arrival);
    expect(after.strengths.get(arrival!)).toBeCloseTo(before.strengths.get(arrival!)!, 9);
    expect(after.strengths.get(alien!)).toBeCloseTo(before.strengths.get(alien!)!, 9);
  });

  it('records nothing for an item that is already removed', () => {
    const store = started();
    const [a] = openList(store).items;
    store.getState().removeItem(a!.id);

    store.getState().removeItem(a!.id);

    expect(openList(store).events).toHaveLength(1);
    expect(store.getState().undoStack).toHaveLength(1);
  });
});

describe('loadSession and snapshot', () => {
  it('offers exactly one step back after loading a session: its last answer', () => {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    store.getState().recordComparison(b!.id, a!.id, 'left');
    expect(store.getState().undoStack).toHaveLength(2);
    const session = store.getState().snapshot();
    const last = openList(store).events.at(-1)!;

    store.getState().loadSession(session!);

    expect(store.getState().undoStack).toEqual([{ actionId: last.actionId, listIds: [openList(store).id] }]);
    store.getState().undo();
    expect(openList(store).events).toHaveLength(1);
    expect(store.getState().undoStack).toEqual([]);
  });

  it('has no snapshot before a list is loaded', () => {
    expect(makeStore().getState().snapshot()).toBeNull();
  });
});

describe('active flags and removal events', () => {
  /** The removal events alone say who is active, starting from every original item. */
  function activeFromEvents(list: RankedList): string[] {
    const active = new Set(list.originalItemIds);
    for (const event of list.events) {
      if (event.kind !== 'removal') continue;
      event.itemIds.forEach((id) => active.delete(id));
    }
    return [...active].sort();
  }

  function activeFromFlags(list: RankedList): string[] {
    return activeItems(list)
      .map((item) => item.id)
      .sort();
  }

  /** A small deterministic generator, so a failure names its seed. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  it("items' active flags always agree with replaying the removal events", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const next = random(seed);
      const store = makeStore();
      const titles = ['A', 'B', 'C', 'D', 'E', 'F'];
      const documentOf = (picked: string[]): DataSource => ({
        format: 'yaml',
        document: { movies: picked.map((title) => ({ title })) },
        arrayPath: ['movies'],
      });
      store
        .getState()
        .startRanking({ source: documentOf(titles.slice(0, 4)), roles: { labelField: 'title' } });

      for (let step = 0; step < 30; step += 1) {
        const roll = next();
        const list = openList(store);
        const active = activeItems(list);
        if (roll < 0.35 && active.length > 0) {
          store.getState().removeItem(active[Math.floor(next() * active.length)]!.id);
        } else if (roll < 0.6) {
          store.getState().undo();
        } else if (roll < 0.8 && active.length >= 2) {
          store.getState().recordComparison(active[0]!.id, active[1]!.id, 'left');
        } else {
          const order = active.map((item) => item.id);
          const [moved] = order.splice(Math.floor(next() * order.length), 1);
          if (moved !== undefined) {
            order.splice(Math.floor(next() * (order.length + 1)), 0, moved);
            store.getState().reorderItem(moved, order);
          }
        }

        const after = openList(store);
        expect(activeFromFlags(after), `seed ${seed} step ${step}`).toEqual(activeFromEvents(after));
      }
    }
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
      const [a, b] = openList(store).items;
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

      store.getState().setListRoles({ labelField: 'title', summaryFields: ['year'] });
      // A screen mounting before the delayed save has fired.
      store.getState().hydrate();

      expect(openList(store).roles.summaryFields).toEqual(['year']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the engine host', () => {
  /** localStorage's shape, with key enumeration and a size limit across every key. */
  function limitedBackend(limit: number): StorageLike & {
    data: Map<string, string>;
    length: number;
    /** The size limit, which a test can change as it goes. */
    limit: number;
    /** Characters stored across every key. */
    used(): number;
    key(i: number): string | null;
  } {
    const data = new Map<string, string>();
    const used = (except?: string) =>
      [...data].reduce((total, [key, value]) => (key === except ? total : total + value.length), 0);
    const backend = {
      data,
      limit,
      used: () => used(),
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (used(key) + value.length > backend.limit) throw new Error('QuotaExceededError');
        data.set(key, value);
      },
      removeItem: (key: string) => void data.delete(key),
    };
    return backend;
  }

  const twoLists: DataSource = {
    format: 'yaml',
    document: {
      // Enough of them that the movies entry outweighs what one answer adds to the workspace save.
      movies: Array.from({ length: 20 }, (_, i) => `Movie ${i}`),
      books: ['Dune', 'Emma', 'Ulysses'],
    },
    arrayPath: ['movies'],
  };

  /** A store with an answer on movies, then switched to books with an answer there, both cached. */
  function twoListsCached(backend = limitedBackend(Number.POSITIVE_INFINITY)) {
    const cache = createEngineCache(backend);
    const host = createEngineHost({ builder: createSyncBuilder(), cache });
    const store = makeStore(backend, host);
    store.getState().startRanking({ source: twoLists, roles: {} });
    const movies = openList(store).id;
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    store.getState().switchList({ source: { ...twoLists, arrayPath: ['books'] }, roles: {} });
    const books = openList(store).id;
    const [c, d] = openList(store).items;
    store.getState().recordComparison(c!.id, d!.id, 'left');
    host.flushCache();
    return { backend, cache, host, store, movies, books };
  }

  function readyView(host: EngineHost) {
    const view = host.view();
    if (view?.status !== 'ready') throw new Error(`Expected a ready view, got ${JSON.stringify(view)}.`);
    return view;
  }

  it('follows the open list from its first item to every answer and undo', () => {
    const host = testHost();
    const store = makeStore(memoryBackend(), host);
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    expect(readyView(host).answers).toBe(0);

    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'right');
    expect(readyView(host).answers).toBe(1);
    expect(readyView(host).ranked.map((item) => item.id)).toEqual(
      replay(toEngineList(openList(store))).ranked,
    );

    store.getState().undo();
    expect(readyView(host).answers).toBe(0);
  });

  it('saves a change the host fails to follow, and restores the list from a cold build', async () => {
    const backend = memoryBackend();
    const host = testHost();
    const store = makeStore(backend, host);
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const failing = vi.spyOn(host, 'sync').mockImplementation(() => {
      throw new Error('The sync failed.');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const [a, b] = openList(store).items;

    try {
      store.getState().recordComparison(a!.id, b!.id, 'left');
      expect(logged).toHaveBeenCalled();
    } finally {
      failing.mockRestore();
      logged.mockRestore();
    }

    const saved = createWorkspaceStorage(backend).load();
    expect(Object.values(saved?.workspace.lists ?? {})[0]?.events).toHaveLength(1);
    expect(store.getState().saveOutcome).toBe('saved');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readyView(host).answers).toBe(1);
  });

  it('forgets the open list on reset', () => {
    const host = testHost();
    const store = makeStore(memoryBackend(), host);
    store.getState().startRanking({ source: nested, roles: {} });
    const pruned = vi.spyOn(host, 'pruneCache');

    store.getState().reset();

    expect(host.view()).toBeNull();
    expect(pruned).toHaveBeenCalledWith([]);
  });

  it('resets the host on loadSession, then opens the loaded list', async () => {
    const host = testHost();
    const store = makeStore(memoryBackend(), host);
    store.getState().startRanking({ source: nested, roles: {} });
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'right');
    const session = store.getState().snapshot()!;
    const reset = vi.spyOn(host, 'reset');

    store.getState().loadSession(session);

    expect(reset).toHaveBeenCalledTimes(1);
    expect(host.view()).toEqual({ status: 'restoring', listId: openList(store).id });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readyView(host).answers).toBe(1);
  });

  it('keeps a cached snapshot for every list in the workspace, saving the one left', () => {
    const { cache, store, movies, books } = twoListsCached();
    const moviesList = listAtPath(store, ['movies'])!;
    const booksList = openList(store);

    expect(openSealed(toEngineList(moviesList), cache.load(movies))?.eventIds).toHaveLength(1);
    expect(openSealed(toEngineList(booksList), cache.load(books))?.eventIds).toHaveLength(1);
  });

  it('prunes the cache to the lists in the workspace when the open list changes', () => {
    const host = testHost();
    const store = makeStore(memoryBackend(), host);
    const pruned = vi.spyOn(host, 'pruneCache');
    store.getState().startRanking({ source: twoLists, roles: {} });
    const movies = openList(store).id;
    store.getState().switchList({ source: { ...twoLists, arrayPath: ['books'] }, roles: {} });
    const books = openList(store).id;
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');

    expect(pruned.mock.calls).toEqual([[[movies]], [[movies, books]]]);
  });

  it('gives up the entries of lists not open first when the workspace save runs out of room', () => {
    const { backend, cache, store, movies, books } = twoListsCached();
    // No room for a larger workspace save until the movies entry is gone.
    backend.limit = backend.used();
    const [a, b] = openList(store).items;
    store.getState().recordComparison(b!.id, a!.id, 'left');

    expect(store.getState().saveOutcome).toBe('saved');
    expect(cache.load(movies)).toBeNull();
    expect(cache.load(books)).not.toBeNull();
    expect(createWorkspaceStorage(backend).load()?.workspace).toEqual(store.getState().snapshot()?.workspace);
  });

  it('after a reload, an answer, its undo and one more undo stay warm and equal replay', () => {
    const backend = limitedBackend(Number.POSITIVE_INFINITY);
    const build = vi.fn(createSyncBuilder().build);
    const hostOver = () =>
      createEngineHost({
        builder: { via: 'sync', build, cancel: () => undefined },
        cache: createEngineCache(backend),
      });
    const titles = Array.from({ length: 12 }, (_, i) => `Movie ${i}`);
    const first = hostOver();
    const store = makeStore(backend, first);
    store.getState().startRanking({
      source: { format: 'yaml', document: { movies: titles }, arrayPath: ['movies'] },
      roles: {},
    });
    // Longer than CHECKPOINT_EVERY (500), so an undo far from a checkpoint would be a long replay.
    const items = openList(store).items;
    for (let i = 0; i < 520; i++) {
      const a = items[(i * 7) % 12]!;
      const b = items[(i * 7 + 1 + (i % 11)) % 12]!;
      store.getState().recordComparison(a.id, b.id, i % 3 === 0 ? 'right' : 'left');
    }
    first.flushCache();

    const host = hostOver();
    const reloaded = createListStore({
      storage: createWorkspaceStorage(backend),
      createId: () => `id-${(ids += 1)}`,
      host,
    });
    reloaded.getState().hydrate();
    expect(readyView(host).answers).toBe(520);
    const [a, b] = openList(reloaded).items;
    reloaded.getState().recordComparison(a!.id, b!.id, 'left');
    reloaded.getState().undo();
    reloaded.getState().undo();

    expect(openList(reloaded).events).toHaveLength(519);
    expect(readyView(host).ranked.map((item) => item.id)).toEqual(
      replay(toEngineList(openList(reloaded))).ranked,
    );
    expect(build, 'no cold build after the reload').not.toHaveBeenCalled();
  });

  it('clears the engine cache and saves again when the workspace save runs out of room', () => {
    const backend = limitedBackend(5_000);
    const cache = createEngineCache(backend);
    const host = createEngineHost({ builder: createSyncBuilder(), cache });
    // The new list's own entry, which pruning to the open list keeps.
    cache.save('id-1', 'x'.repeat(4_500));
    const store = makeStore(backend, host);

    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    expect(openList(store).id).toBe('id-1');
    expect(store.getState().saveOutcome).toBe('saved');
    expect(backend.data.has(WORKSPACE_STORAGE_KEY)).toBe(true);
    expect(cache.load('id-1')).toBeNull();
  });
});

describe('the step back a workspace offers after a reload (docs/ARCHITECTURE.md 10.3)', () => {
  const movie = (title: string) => ({ title });
  const source = (titles: string[]): DataSource => ({
    format: 'yaml',
    document: { movies: titles.map(movie), books: [movie('Dune'), movie('Emma')] },
    arrayPath: ['movies'],
  });
  const titlesOf = (store: ReturnType<typeof makeStore>) =>
    activeItems(openList(store)).map((item) => (item.value as { title: string }).title);

  /** A store holding what `build` did, reopened from storage the way a reload is. */
  function reopened(build: (store: ReturnType<typeof makeStore>) => void) {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: source(['Alien', 'Arrival', 'Solaris']), roles: {} });
    build(first);
    const second = makeStore(backend);
    second.getState().hydrate();
    return second;
  }

  it('is the last answer', () => {
    const store = reopened((s) => {
      const [a, b] = openList(s).items;
      s.getState().recordComparison(a!.id, b!.id, 'left');
    });
    const last = openList(store).events.at(-1)!;

    expect(store.getState().undoStack).toEqual([{ actionId: last.actionId, listIds: [openList(store).id] }]);
    store.getState().undo();
    expect(openList(store).events).toEqual([]);
  });

  it('is the last drag', () => {
    const store = reopened((s) => {
      const ids = openList(s).items.map((item) => item.id);
      s.getState().reorderItem(ids[0]!, [ids[1]!, ids[0]!, ids[2]!]);
    });

    expect(openList(store).events.at(-1)!.kind).toBe('placement');
    store.getState().undo();
    expect(openList(store).events).toEqual([]);
  });

  it('is the removal of one item, which undo brings back', () => {
    const store = reopened((s) => s.getState().removeItem(openList(s).items[0]!.id));

    store.getState().undo();
    expect(isItemActive(openList(store), openList(store).items[0]!.id)).toBe(true);
    expect(openList(store).events).toEqual([]);
  });

  it('is nothing with no history', () => {
    expect(reopened(() => undefined).getState().undoStack).toEqual([]);
  });

  it('is a removal made after an answer, which undo brings back without touching the answer', () => {
    const store = reopened((s) => {
      const [a, b, c] = openList(s).items;
      s.getState().recordComparison(a!.id, b!.id, 'left');
      s.getState().removeItem(c!.id);
    });
    expect(titlesOf(store)).toEqual(['Alien', 'Arrival']);

    store.getState().undo();

    expect(titlesOf(store)).toEqual(['Alien', 'Arrival', 'Solaris']);
    expect(openList(store).events.map((event) => event.kind)).toEqual(['pair']);
  });

  it('keeps the steps back across a switch, and offers them only on the list they belong to', () => {
    const store = makeStore();
    store.getState().startRanking({ source: source(['Alien', 'Arrival']), roles: {} });
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    const movies = openList(store);

    store
      .getState()
      .switchList({ source: { ...source(['Alien', 'Arrival']), arrayPath: ['books'] }, roles: {} });
    expect(undoOffer(store.getState())).toEqual(['movies']);
    store.getState().undo();
    expect(listAtPath(store, ['movies'])?.events).toHaveLength(1);

    store.getState().switchList({ source: source(['Alien', 'Arrival']), roles: {} });
    expect(undoOffer(store.getState())).toBe('here');
    store.getState().undo();
    expect(openList(store).events).toEqual([]);
    expect(openList(store).id).toBe(movies.id);
  });
});

describe('setListRoles', () => {
  it('setListRoles changes only the open list, leaves the history and the undo stack as they were', () => {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [first, second] = openList(store).items;
    store.getState().recordComparison(first!.id, second!.id, 'left');
    const other = { ...nested, document: { ...(nested.document as object), actors: ['Weaver', 'Adams'] } };
    store.getState().switchList({ source: { ...other, arrayPath: ['actors'] }, roles: {} });
    store
      .getState()
      .switchList({ source: { ...other, arrayPath: ['movies'] }, roles: { labelField: 'title' } });
    const actorsBefore = listAtPath(store, ['actors']);
    const before = openList(store);
    const stepsBefore = store.getState().undoStack;

    store.getState().setListRoles({ labelField: 'title', summaryFields: ['year'] });

    expect(listAtPath(store, ['actors'])).toBe(actorsBefore);
    expect(openList(store).configuredExplicitly).toBe(true);
    const after = openList(store);
    expect(after.roles).toEqual({ labelField: 'title', summaryFields: ['year'] });
    expect(after.events).toBe(before.events);
    expect(after.items).toBe(before.items);
    expect(after.initialStartingOrder).toBe(before.initialStartingOrder);
    expect(after.updatedAt).toBe('2026-08-16T00:00:00.000Z');
    expect(store.getState().undoStack).toBe(stepsBefore);
  });

  it('is saved like the other setup changes', () => {
    const backend = memoryBackend();
    const store = makeStore(backend);
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    store.getState().setListRoles({ labelField: 'title', summaryFields: ['year'] });

    const saved = JSON.parse(backend.data.get(WORKSPACE_STORAGE_KEY)!);
    expect(JSON.stringify(saved)).toContain('"summaryFields":["year"]');
  });

  it('has nothing to change before there is a document', () => {
    const store = makeStore();

    store.getState().setListRoles({ labelField: 'title' });

    expect(store.getState().workspace).toBeNull();
  });
});

describe('a list started with a sort', () => {
  const albums: DataSource = {
    format: 'yaml',
    document: {
      albums: [
        { title: 'Low', plays: 5 },
        { title: 'High', plays: 90 },
        { title: 'Mid', plays: 40 },
        { title: 'Top', plays: 100 },
      ],
      other: [
        { title: 'Cold', plays: 1 },
        { title: 'Warm', plays: 7 },
      ],
    },
    arrayPath: ['albums'],
  };
  const other: DataSource = { ...albums, arrayPath: ['other'] };
  const roles = { labelField: 'title' };
  const byPlays = { field: 'plays', direction: 'desc' as const };

  const titlesOf = (store: ReturnType<typeof makeStore>, ids: string[]) => {
    const items = openList(store).items;
    return ids.map((id) => (items.find((item) => item.id === id)?.value as { title: string }).title);
  };

  it('a list started with a sort has originalItemIds in field order and items in document order, and starts as roughly in order', () => {
    const store = makeStore();
    store.getState().startRanking({ source: albums, roles, startingOrder: 'ranked', sort: byPlays });

    const list = openList(store);
    expect(list.items.map((item) => (item.value as { title: string }).title)).toEqual([
      'Low',
      'High',
      'Mid',
      'Top',
    ]);
    expect(titlesOf(store, list.originalItemIds)).toEqual(['Top', 'High', 'Mid', 'Low']);
    expect(list.initialStartingOrder).toBe('rough');
    expect(list.initialSort).toEqual(byPlays);
  });

  it('a sorted list leaves the document and items in document order, and exports its sorted prior', () => {
    const store = makeStore();
    store.getState().startRanking({ source: albums, roles, sort: byPlays });

    // The document and the list's items are untouched, in document order.
    const titles = (rows: { title: string }[]) => rows.map((row) => row.title);
    const documentOrder = ['Low', 'High', 'Mid', 'Top'];
    expect(
      titles((store.getState().workspace?.source.document as { albums: { title: string }[] }).albums),
    ).toEqual(documentOrder);
    expect(titles(openList(store).items.map((item) => item.value as { title: string }))).toEqual(
      documentOrder,
    );

    // The export writes the ranking, and with no answers yet that is the sorted prior.
    const exported = JSON.parse(selectExportText(store.getState().workspace, 'json'));
    expect(titles(exported.albums)).toEqual(['Top', 'High', 'Mid', 'Low']);
    expect(titles(exported.other)).toEqual(['Cold', 'Warm']);
  });

  it('a sorted first list does not put roughly in order into the document defaults', () => {
    const store = makeStore();
    store.getState().startRanking({ source: albums, roles, sort: byPlays });

    expect(store.getState().workspace?.listDefaults).toEqual({ roles, startingOrder: 'unordered' });
  });

  it('without a sort nothing changes', () => {
    const store = makeStore();
    store.getState().startRanking({ source: albums, roles });

    expect(openList(store).originalItemIds).toEqual(openList(store).items.map((item) => item.id));
    expect(openList(store)).not.toHaveProperty('initialSort');
  });

  it("the rank screen's switcher keeps a sorted list with no answers as it began", () => {
    const store = makeStore();
    store.getState().startRanking({ source: albums, roles, sort: byPlays });
    const began = openList(store);

    // The switcher passes the list's own config, no sort, and marks it derived.
    store
      .getState()
      .switchList({ source: other, roles, startingOrder: 'unordered', configuredExplicitly: false });
    store.getState().switchList({
      source: albums,
      roles,
      startingOrder: 'rough',
      configuredExplicitly: false,
    });

    expect(openList(store).initialSort).toEqual(byPlays);
    expect(openList(store).initialStartingOrder).toBe('rough');
    expect(openList(store).originalItemIds).toEqual(began.originalItemIds);
    expect(titlesOf(store, openList(store).originalItemIds)).toEqual(['Top', 'High', 'Mid', 'Low']);
  });

  it('switching to a visited list with no answers applies its new sort; with answers it keeps its own', () => {
    const store = makeStore();
    store.getState().startRanking({ source: albums, roles });
    store.getState().switchList({ source: other, roles, sort: byPlays });
    store.getState().switchList({ source: albums, roles });

    // Albums has no answers: a new sort applies.
    store.getState().switchList({ source: albums, roles, sort: { field: 'plays', direction: 'asc' } });
    expect(openList(store).initialStartingOrder).toBe('rough');
    expect(openList(store).initialSort).toEqual({ field: 'plays', direction: 'asc' });
    expect(titlesOf(store, openList(store).originalItemIds)).toEqual(['Low', 'Mid', 'High', 'Top']);

    // And dropping it returns to item order.
    store.getState().switchList({ source: albums, roles });
    expect(openList(store)).not.toHaveProperty('initialSort');
    expect(openList(store).initialStartingOrder).toBe('unordered');
    expect(openList(store).originalItemIds).toEqual(openList(store).items.map((item) => item.id));

    // Other has no answers either, so a switch without a sort drops the one it began with.
    store.getState().switchList({ source: other, roles });
    expect(openList(store)).not.toHaveProperty('initialSort');

    // With an answer the list keeps its own order and sort.
    store.getState().switchList({ source: albums, roles, sort: byPlays });
    const [a, b] = openList(store).items;
    store.getState().recordComparison(a!.id, b!.id, 'left');
    const before = openList(store);
    store.getState().switchList({ source: albums, roles, sort: { field: 'plays', direction: 'asc' } });

    expect(openList(store).initialSort).toEqual(byPlays);
    expect(openList(store).initialStartingOrder).toBe('rough');
    expect(openList(store).originalItemIds).toEqual(before.originalItemIds);
  });
});
