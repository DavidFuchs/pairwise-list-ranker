import { describe, expect, it } from 'vitest';

import {
  compactSnapshot,
  parseWorkspaceSnapshot,
  WORKSPACE_VERSION,
} from '@/lib/persistence/workspaceSnapshot';
import { everyKindOfEvent, listItem, rankedList, snapshotOf } from '@/tests/helpers/snapshots';
import type { FieldRoles } from '@/types/source';

const NOW = '2026-08-16T00:00:00.000Z';

/** Anything JSON-shaped, so a test can break one field of a valid snapshot. */
type Json = any;

const movies = {
  id: 'movies-1',
  arrayPath: ['movies'],
  roles: { labelField: 'title' },
  initialStartingOrder: 'unordered',
  configuredExplicitly: true,
  originalItemIds: ['item-1'],
  items: [
    {
      id: 'item-1',
      listId: 'movies-1',
      value: { title: 'Alien' },
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  events: [],
  createdAt: NOW,
  updatedAt: NOW,
};

const actors = {
  ...movies,
  id: 'actors-1',
  arrayPath: ['actors'],
  roles: {},
  configuredExplicitly: false,
  items: [],
};

const valid = {
  version: WORKSPACE_VERSION,
  workspace: {
    source: {
      format: 'yaml',
      document: { movies: [{ title: 'Alien' }, { title: 'Arrival' }], actors: ['Weaver'] },
      arrayPath: ['movies'],
    },
    listDefaults: { roles: { labelField: 'title' }, startingOrder: 'unordered' },
    lists: { movies },
    createdAt: NOW,
    updatedAt: NOW,
  },
  ui: { previewTab: 'ranked' },
};

describe('parseWorkspaceSnapshot', () => {
  it('a stored list that still carries a sortMode field loads, and the field is not kept', () => {
    const old = {
      ...valid,
      workspace: { ...valid.workspace, lists: { movies: { ...movies, sortMode: 'auto' } } },
    };

    const list = parseWorkspaceSnapshot(old)?.workspace.lists.movies;

    expect(list?.id).toBe('movies-1');
    expect(list).not.toHaveProperty('sortMode');
  });

  it('accepts a well-formed snapshot', () => {
    expect(parseWorkspaceSnapshot(valid)?.workspace.lists.movies?.id).toBe('movies-1');
  });

  it('round-trips every list in the document, open or not', () => {
    const both = { ...valid, workspace: { ...valid.workspace, lists: { movies, actors } } };

    const parsed = parseWorkspaceSnapshot(both);
    expect(Object.keys(parsed?.workspace.lists ?? {})).toEqual(['movies', 'actors']);
    expect(parsed?.workspace.lists.actors?.configuredExplicitly).toBe(false);
  });

  it('round-trips the document defaults', () => {
    const withDefaults = {
      ...valid,
      workspace: {
        ...valid.workspace,
        listDefaults: { roles: { labelField: 'name' }, startingOrder: 'ranked' },
      },
    };

    expect(parseWorkspaceSnapshot(withDefaults)?.workspace.listDefaults).toEqual({
      roles: { labelField: 'name' },
      startingOrder: 'ranked',
    });
  });

  it('keeps an arbitrary source document untouched', () => {
    const wild = {
      ...valid,
      workspace: {
        ...valid.workspace,
        source: { ...valid.workspace.source, document: { a: [1, { b: null }], c: true } },
      },
    };

    expect(parseWorkspaceSnapshot(wild)?.workspace.source.document).toEqual({
      a: [1, { b: null }],
      c: true,
    });
  });

  it('rejects a snapshot from any other version', () => {
    expect(parseWorkspaceSnapshot({ ...valid, version: WORKSPACE_VERSION - 1 })).toBeNull();
    expect(parseWorkspaceSnapshot({ ...valid, version: 99 })).toBeNull();
  });

  it('rejects a workspace without its open list', () => {
    const orphaned = { ...valid, workspace: { ...valid.workspace, lists: { actors } } };

    expect(parseWorkspaceSnapshot(orphaned)).toBeNull();
  });

  it('rejects a list filed under a path that is not its own', () => {
    const misfiled = { ...valid, workspace: { ...valid.workspace, lists: { movies, other: actors } } };

    expect(parseWorkspaceSnapshot(misfiled)).toBeNull();
  });

  it('rejects a snapshot missing the array path', () => {
    const broken = {
      ...valid,
      workspace: { ...valid.workspace, source: { ...valid.workspace.source, arrayPath: undefined } },
    };

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it('rejects an unknown source format', () => {
    const broken = {
      ...valid,
      workspace: { ...valid.workspace, source: { ...valid.workspace.source, format: 'toml' } },
    };

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it('rejects junk', () => {
    expect(parseWorkspaceSnapshot('nope')).toBeNull();
    expect(parseWorkspaceSnapshot(null)).toBeNull();
  });
});

describe('version 8 workspaces', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => listItem(id, 'movies-1', { title: id }));
  const document = { movies: items.map((item) => item.value) };

  /** Written as storage writes it, then read back. */
  function roundTrip(snapshot: ReturnType<typeof snapshotOf>) {
    return parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot))));
  }

  const withEvents = (events: unknown[]): Json => {
    const stored = JSON.parse(JSON.stringify(compactSnapshot(snapshotOf(rankedList({ items }), document))));
    stored.workspace.lists.movies.events = events;
    return stored;
  };

  it('round-trips a workspace holding every kind of event', () => {
    const list = rankedList({
      items,
      originalItemIds: ['a', 'b', 'c', 'd'],
      events: everyKindOfEvent('movies-1'),
    });
    const snapshot = snapshotOf(list, document);

    expect(WORKSPACE_VERSION).toBe(8);
    expect(roundTrip(snapshot)).toEqual(snapshot);
  });

  it.each(['unordered', 'rough', 'ranked'] as const)('round-trips the %s starting order', (startingOrder) => {
    const snapshot = snapshotOf(rankedList({ items, initialStartingOrder: startingOrder }), document);

    const parsed = roundTrip(snapshot);
    expect(parsed?.workspace.lists.movies?.initialStartingOrder).toBe(startingOrder);
    expect(parsed?.workspace.listDefaults.startingOrder).toBe(startingOrder);
  });

  it('keeps the original import order, which the items array does not', () => {
    const list = rankedList({ items: [...items].reverse(), originalItemIds: ['a', 'b', 'c', 'd', 'e'] });

    expect(roundTrip(snapshotOf(list, document))?.workspace.lists.movies?.originalItemIds).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('a version 5 browser save is rejected', () => {
    const old = {
      version: 5,
      workspace: {
        ...valid.workspace,
        listDefaults: { roles: {}, alreadyRanked: false },
        lists: { movies: { ...movies, alreadyRanked: false, comparisonEvents: [] } },
      },
      ui: valid.ui,
    };

    expect(parseWorkspaceSnapshot(old)).toBeNull();
  });

  it('rejects a version 5 shape even when it claims version 7', () => {
    const {
      initialStartingOrder: _startingOrder,
      originalItemIds: _original,
      events: _events,
      ...rest
    } = movies;
    const old = {
      ...valid,
      workspace: { ...valid.workspace, lists: { movies: { ...rest, alreadyRanked: false } } },
    };

    expect(parseWorkspaceSnapshot(old)).toBeNull();
  });

  it('an event of an unknown kind or with missing fields is rejected', () => {
    const base = { id: 'e1', listId: 'movies-1', createdAt: NOW };
    const bad: unknown[] = [
      { ...base, kind: 'skip', leftItemId: 'a', rightItemId: 'b' },
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'b' },
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'skip' },
      { ...base, kind: 'pair', leftItemId: '', rightItemId: 'b', outcome: 'left' },
      { kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      // A five-card sort as an earlier version of the app recorded it: no longer an event.
      { ...base, kind: 'group', presentedItemIds: ['a', 'b'], itemIds: ['b', 'a'] },
      { ...base, kind: 'placement', itemId: 'a' },
      { ...base, kind: 'placement', aboveItemId: 'b' },
      { ...base, kind: 'reshuffle' },
      // A placement as an earlier version of the app recorded it: no longer an event.
      { ...base, kind: 'placement', targets: [{ itemId: 'a', aboveItemId: 'b' }] },
      { ...base, kind: 'placement', itemId: '', aboveItemId: 'b' },
      { ...base, kind: 'placement', itemId: 7, aboveItemId: 'b' },
      // A starting-order change as an earlier version of the app recorded it: no longer an event.
      { ...base, kind: 'startingOrder', startingOrder: 'rough' },
      { ...base, kind: 'unrecognized' },
      { ...base, kind: 'removal' },
      // A removal as an earlier version of the app recorded it: no longer an event.
      { ...base, kind: 'membership', added: [], removed: ['a'], restored: [] },
      { id: 'e1', listId: 'movies-1', createdAt: NOW, leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      { ...base, createdAt: 5, kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      { ...base, kind: 'placement', itemId: 'a', aboveItemId: null },
      { ...base, kind: 'placement', itemId: 'a', aboveItemId: 'b', belowItemId: 7 },
      { ...base, kind: 'unrecognized', itemIds: ['a', 2] },
      { ...base, kind: 'removal', itemIds: [''] },
      null,
      'pair',
      [],
    ];

    for (const event of bad) expect(parseWorkspaceSnapshot(withEvents([event]))).toBeNull();
    // An event with no action to undo it by is not one a list's history holds.
    const { actionId: _action, ...unclaimed } = everyKindOfEvent('movies-1')[0]!;
    expect(parseWorkspaceSnapshot(withEvents([unclaimed]))).toBeNull();
    expect(parseWorkspaceSnapshot(withEvents([]))).not.toBeNull();
  });

  it('keeps only the fields an event has', () => {
    const base = { id: 'e1', actionId: 'a1', listId: 'movies-1', createdAt: NOW };
    const stored = withEvents([
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left', extra: 1 },
      { ...base, id: 'e2', kind: 'placement', itemId: 'a', aboveItemId: 'b', stray: true },
    ]);

    const events = parseWorkspaceSnapshot(stored)?.workspace.lists.movies?.events;
    expect(events).toEqual([
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      { ...base, id: 'e2', kind: 'placement', itemId: 'a', aboveItemId: 'b' },
    ]);
    expect(Object.keys(events?.[0] ?? {})).not.toContain('extra');
  });

  it('rejects one bad event among good ones rather than dropping it', () => {
    const good = everyKindOfEvent('movies-1');

    expect(parseWorkspaceSnapshot(withEvents([...good, { ...good[0], kind: 'nonsense' }]))).toBeNull();
    expect(parseWorkspaceSnapshot(withEvents(good))).not.toBeNull();
  });

  it('rejects an unknown starting order', () => {
    const stored = withEvents([]);
    stored.workspace.lists.movies.initialStartingOrder = 'sorted';

    expect(parseWorkspaceSnapshot(stored)).toBeNull();
  });

  it('compactSnapshot still names items by entry', () => {
    const list = rankedList({ items, originalItemIds: items.map((item) => item.id) });

    const stored = compactSnapshot(snapshotOf(list, document)).workspace.lists.movies!;

    expect(stored.items.map((item) => item.entry)).toEqual([0, 1, 2, 3, 4]);
    expect(stored.items.every((item) => item.value === undefined)).toBe(true);
    expect(stored.originalItemIds).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('the shapes a snapshot is read from', () => {
  const items = ['a', 'b'].map((id) => listItem(id, 'movies-1', { title: id }));
  const document = { movies: items.map((item) => item.value) };

  /** A stored snapshot to break one field of. */
  function stored(): Json {
    const list = rankedList({ items, originalItemIds: ['a', 'b'] });
    return JSON.parse(JSON.stringify(compactSnapshot(snapshotOf(list, document))));
  }

  it('keeps every field of a list setup, roles included', () => {
    const roles: FieldRoles = {
      labelField: 'title',
      positionField: 'rank',
      summaryFields: ['year', 'genre'],
      fieldRenderers: { year: 'year', poster: 'image', score: 'stars-10' },
    };
    const list = rankedList({
      items,
      originalItemIds: ['a', 'b'],
      roles,
      initialStartingOrder: 'rough',
      configuredExplicitly: false,
    });
    const snapshot = snapshotOf(list, document);
    snapshot.workspace.listDefaults = { roles, startingOrder: 'ranked' };
    snapshot.ui = { previewTab: 'json' };

    expect(parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot))))).toEqual(snapshot);
  });

  it.each([
    ['a label field that is not text', { labelField: 5 }],
    ['a position field that is not text', { positionField: ['rank'] }],
    ['summary fields that are not a list of text', { summaryFields: 'year' }],
    ['a summary field that is not text', { summaryFields: ['year', 2] }],
    ['a renderer that does not exist', { fieldRenderers: { year: 'sparkle' } }],
    ['renderers that are a list', { fieldRenderers: ['link'] }],
    ['roles that are not an object', 'title'],
  ])('rejects %s', (_name, roles) => {
    const broken = stored();
    broken.workspace.lists.movies.roles = roles;

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it('rejects document defaults that are not a setup', () => {
    const broken = stored();
    broken.workspace.listDefaults = { roles: {}, startingOrder: 'sideways' };

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it.each([
    ['both an entry and a value', { entry: 0, value: { title: 'a' } }],
    ['neither an entry nor a value', { entry: undefined }],
    ['a negative entry', { entry: -1 }],
    ['a fractional entry', { entry: 0.5 }],
    ['an entry that is text', { entry: '0' }],
    ['no id', { id: '' }],
    ['an id that is not text', { id: 7 }],
    ['no list', { listId: undefined }],
    ['no creation time', { createdAt: undefined }],
  ])('rejects an item with %s', (_name, change) => {
    const broken = stored();
    const item = broken.workspace.lists.movies.items[0];
    Object.assign(item, change);

    expect(parseWorkspaceSnapshot(JSON.parse(JSON.stringify(broken)))).toBeNull();
  });

  it('keeps the value of an item that has one, whatever it is', () => {
    const list = rankedList({
      items: [listItem('a', 'movies-1', null as never), listItem('b', 'movies-1', { title: 'gone' })],
      originalItemIds: ['a', 'b'],
    });
    const snapshot = snapshotOf(list, { movies: [] });

    expect(parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot))))).toEqual(snapshot);
  });

  it('rejects an entry the document does not hold', () => {
    const broken = stored();
    broken.workspace.lists.movies.items[1].entry = 2;

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it.each([
    ['a preview tab that is not one', (s: Json) => (s.ui.previewTab = 'chart')],
    ['no ui', (s: Json) => delete s.ui],
    ['no workspace', (s: Json) => delete s.workspace],
    ['a creation time that is not text', (s: Json) => (s.workspace.createdAt = 3)],
    ['lists that are a list', (s: Json) => (s.workspace.lists = [])],
    [
      'original item ids that are not ids',
      (s: Json) => (s.workspace.lists.movies.originalItemIds = ['a', '']),
    ],
    [
      'a list that does not say whether it was configured',
      (s: Json) => delete s.workspace.lists.movies.configuredExplicitly,
    ],
    ['events that are not a list', (s: Json) => (s.workspace.lists.movies.events = {})],
    ['a version that is text', (s: Json) => (s.version = '6')],
  ])('rejects a snapshot with %s', (_name, damage) => {
    const broken = stored();
    damage(broken);

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it('drops the fields it does not know instead of carrying them', () => {
    const extra = stored();
    extra.extra = 1;
    extra.ui.extra = 1;
    extra.workspace.extra = 1;
    extra.workspace.source.extra = 1;
    extra.workspace.lists.movies.extra = 1;
    extra.workspace.lists.movies.roles.extra = 1;
    extra.workspace.lists.movies.items[0].extra = 1;

    expect(parseWorkspaceSnapshot(extra)).toEqual(parseWorkspaceSnapshot(stored()));
  });

  it('files a list under a path that is a key of Object.prototype without confusing it', () => {
    const list = rankedList({ arrayPath: ['constructor'], items, originalItemIds: ['a', 'b'] });
    const snapshot = snapshotOf(list, { constructor: items.map((item) => item.value) });
    const parsed = parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot))));

    expect(parsed).toEqual(snapshot);
    const orphan = JSON.parse(JSON.stringify(compactSnapshot(snapshot))) as Json;
    orphan.workspace.lists = {};
    expect(parseWorkspaceSnapshot(orphan), 'the open list is not in the workspace').toBeNull();
  });
});

describe('initialSort in a stored list', () => {
  const withSort = (initialSort: unknown) => ({
    ...valid,
    workspace: { ...valid.workspace, lists: { movies: { ...movies, initialSort } } },
  });

  it('initialSort survives a save and load', () => {
    const sort = { field: 'plays', direction: 'asc' };
    const snapshot = parseWorkspaceSnapshot(withSort(sort));

    const list = snapshot?.workspace.lists.movies;
    expect(list?.initialSort).toEqual(sort);
    const again = parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot!))));
    expect(again?.workspace.lists.movies?.initialSort).toEqual(sort);
  });

  it('a stored list with a malformed initialSort is refused, and one without initialSort loads', () => {
    for (const bad of [
      'plays',
      null,
      [],
      {},
      { field: '', direction: 'desc' },
      { field: 3, direction: 'desc' },
      { field: 'plays', direction: 'up' },
      { field: 'plays' },
    ]) {
      expect(parseWorkspaceSnapshot(withSort(bad))).toBeNull();
    }
    const plain = parseWorkspaceSnapshot(valid)?.workspace.lists.movies;
    expect(plain?.id).toBe('movies-1');
    expect(plain).not.toHaveProperty('initialSort');
  });
});
