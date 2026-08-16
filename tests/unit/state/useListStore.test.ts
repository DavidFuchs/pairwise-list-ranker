import { beforeEach, describe, expect, it } from 'vitest';

import { createWorkspaceStorage } from '@/lib/persistence/browserStorage';
import type { StorageLike } from '@/lib/persistence/browserStorage';
import { createListStore } from '@/lib/state/useListStore';
import type { ListStore } from '@/lib/state/useListStore';
import type { ListDocument } from '@/types/workspace';

const NOW = '2026-08-15T12:00:00.000Z';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function idFactory(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
}

function makeStore(backend: StorageLike | null = memoryStorage()): ListStore {
  return createListStore({
    storage: createWorkspaceStorage(backend),
    now: () => NOW,
    createId: idFactory(),
  });
}

const primitiveDoc: ListDocument = {
  version: 1,
  title: 'Weeknight dinners',
  kind: 'primitive',
  items: [{ value: 'Tacos' }, { value: 'Ramen' }, { value: 'Curry' }],
};

const objectDoc: ListDocument = {
  version: 1,
  title: 'Films',
  kind: 'object',
  sortField: 'title',
  items: [{ value: { title: 'Arrival' } }, { value: { title: 'Alien' } }],
};

describe('createListStore', () => {
  let store: ListStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('starts with no list', () => {
    const state = store.getState();

    expect(state.list).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.comparisonEvents).toEqual([]);
  });

  it('shows the GUI preview first, since it is the default view', () => {
    expect(store.getState().previewMode).toBe('gui');
  });
});

describe('importing', () => {
  it('replaces the live list with an imported document', () => {
    const store = makeStore();

    store.getState().importDocument(primitiveDoc);

    const state = store.getState();
    expect(state.list?.title).toBe('Weeknight dinners');
    expect(state.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen', 'Curry']);
  });

  it('starts a fresh comparison history on import', () => {
    const store = makeStore();
    store.getState().importDocument(primitiveDoc);
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left!.id, right!.id, 'left');

    store.getState().importDocument(objectDoc);

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('imports pasted text in any supported format', () => {
    const store = makeStore();

    const result = store.getState().importText('- Tacos\n- Ramen\n', 'yaml');

    expect(result.ok).toBe(true);
    expect(store.getState().items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('keeps the live list untouched when pasted text does not parse', () => {
    const store = makeStore();
    store.getState().importDocument(primitiveDoc);

    const result = store.getState().importText('{ broken', 'json');

    expect(result.ok).toBe(false);
    expect(store.getState().items.map((item) => item.value)).toEqual(['Tacos', 'Ramen', 'Curry']);
    expect(store.getState().list?.title).toBe('Weeknight dinners');
  });
});

describe('comparisons', () => {
  let store: ListStore;

  beforeEach(() => {
    store = makeStore();
    store.getState().importDocument(primitiveDoc);
  });

  function itemIds(): string[] {
    return store.getState().items.map((item) => item.id);
  }

  it('appends a comparison event', () => {
    const [left, right] = itemIds();

    store.getState().recordComparison(left!, right!, 'left');

    const events = store.getState().comparisonEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ leftItemId: left, rightItemId: right, outcome: 'left' });
  });

  it('keeps history append-only across several comparisons', () => {
    const [a, b, c] = itemIds();
    store.getState().recordComparison(a!, b!, 'left');
    const first = store.getState().comparisonEvents[0];

    store.getState().recordComparison(b!, c!, 'right_strong');

    expect(store.getState().comparisonEvents).toHaveLength(2);
    expect(store.getState().comparisonEvents[0]).toBe(first);
  });

  it('records a skip without changing any rating', () => {
    const [a, b] = itemIds();

    store.getState().recordComparison(a!, b!, 'skip');

    expect(store.getState().comparisonEvents[0]?.outcome).toBe('skip');
    expect(store.getState().ranking().every((entry) => entry.state.rating === 1500)).toBe(true);
  });

  it('puts the winner above the loser in the ranking', () => {
    const [a, b] = itemIds();

    store.getState().recordComparison(a!, b!, 'right');

    expect(store.getState().ranking()[0]?.item.id).toBe(b);
  });

  it('ignores a comparison between items that are not in the list', () => {
    store.getState().recordComparison('ghost-1', 'ghost-2', 'left');

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('ignores a comparison involving a deleted item', () => {
    const [a, b] = itemIds();
    store.getState().removeItem(a!);

    store.getState().recordComparison(a!, b!, 'left');

    expect(store.getState().comparisonEvents).toEqual([]);
  });
});

describe('editing items', () => {
  let store: ListStore;

  beforeEach(() => {
    store = makeStore();
    store.getState().importDocument(primitiveDoc);
  });

  it('adds an item to the live list', () => {
    store.getState().addItem('Pho');

    expect(store.getState().items.map((item) => item.value)).toContain('Pho');
  });

  it('drops a removed item from the ranking', () => {
    const removed = store.getState().items[0]!.id;

    store.getState().removeItem(removed);

    expect(store.getState().ranking().map((entry) => entry.item.id)).not.toContain(removed);
  });

  it('records no comparison when an item is deleted mid-pair', () => {
    const [a] = store.getState().items;

    store.getState().removeItem(a!.id);

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('offers a pair that excludes the deleted item', () => {
    const removed = store.getState().items[0]!.id;

    store.getState().removeItem(removed);
    const pair = store.getState().currentPair();

    expect(pair).not.toBeNull();
    expect([pair?.left.id, pair?.right.id]).not.toContain(removed);
  });

  it('stops offering pairs once fewer than two items remain', () => {
    for (const item of [...store.getState().items].slice(0, 2)) {
      store.getState().removeItem(item.id);
    }

    expect(store.getState().currentPair()).toBeNull();
  });

  it('sets the sort field for object lists', () => {
    store.getState().importDocument({ ...objectDoc, sortField: undefined });

    store.getState().setSortField('title');

    expect(store.getState().list?.sortField).toBe('title');
  });
});

describe('preview and editor drafts', () => {
  let store: ListStore;

  beforeEach(() => {
    store = makeStore();
    store.getState().importDocument(primitiveDoc);
  });

  it('switches the preview mode', () => {
    store.getState().setPreviewMode('markdown');

    expect(store.getState().previewMode).toBe('markdown');
  });

  it('holds editor text without touching the live list', () => {
    store.getState().setEditorDraft('json', '{"still": "typing"');

    expect(store.getState().editorDrafts.json).toBe('{"still": "typing"');
    expect(store.getState().items).toHaveLength(3);
  });

  it('applies a valid draft to the live list and clears it', () => {
    store.getState().setEditorDraft('yaml', '- Pho\n- Bibimbap\n');

    const result = store.getState().applyEditorDraft('yaml');

    expect(result.ok).toBe(true);
    expect(store.getState().items.map((item) => item.value)).toEqual(['Pho', 'Bibimbap']);
    expect(store.getState().editorDrafts.yaml).toBeUndefined();
  });

  it('keeps an invalid draft and the live list when apply fails', () => {
    store.getState().setEditorDraft('json', '{ broken');

    const result = store.getState().applyEditorDraft('json');

    expect(result.ok).toBe(false);
    expect(store.getState().editorDrafts.json).toBe('{ broken');
    expect(store.getState().items).toHaveLength(3);
  });

  it('reports an error when applying an empty draft', () => {
    const result = store.getState().applyEditorDraft('markdown');

    expect(result.ok).toBe(false);
  });
});

describe('local persistence', () => {
  it('saves the workspace after a change', () => {
    const backend = memoryStorage();
    const store = makeStore(backend);

    store.getState().importDocument(primitiveDoc);

    const restored = makeStore(backend);
    restored.getState().hydrate();
    expect(restored.getState().items.map((item) => item.value)).toEqual([
      'Tacos',
      'Ramen',
      'Curry',
    ]);
  });

  it('restores comparison history on reload', () => {
    const backend = memoryStorage();
    const store = makeStore(backend);
    store.getState().importDocument(primitiveDoc);
    const [a, b] = store.getState().items;
    store.getState().recordComparison(a!.id, b!.id, 'left');

    const restored = makeStore(backend);
    restored.getState().hydrate();

    expect(restored.getState().comparisonEvents).toHaveLength(1);
    expect(restored.getState().ranking()[0]?.item.id).toBe(a!.id);
  });

  it('starts empty when saved data is malformed', () => {
    const store = makeStore(memoryStorage({ 'pairwise-list-ranker:workspace:v1': 'not json' }));

    store.getState().hydrate();

    expect(store.getState().list).toBeNull();
  });

  it('records when the workspace was last saved', () => {
    const store = makeStore();

    store.getState().importDocument(primitiveDoc);

    expect(store.getState().lastSavedAt).toBe(NOW);
  });

  it('never claims a save happened when storage is unavailable', () => {
    const store = makeStore(null);

    store.getState().importDocument(primitiveDoc);

    expect(store.getState().lastSavedAt).toBeUndefined();
  });

  it('forgets the save time when the workspace is reset', () => {
    const store = makeStore();
    store.getState().importDocument(primitiveDoc);

    store.getState().reset();

    expect(store.getState().lastSavedAt).toBeUndefined();
  });

  it('reports when persistence is unavailable but still works in memory', () => {
    const store = makeStore(null);

    store.getState().importDocument(primitiveDoc);

    expect(store.getState().persistenceAvailable).toBe(false);
    expect(store.getState().items).toHaveLength(3);
  });

  it('clears the workspace and the saved copy on reset', () => {
    const backend = memoryStorage();
    const store = makeStore(backend);
    store.getState().importDocument(primitiveDoc);

    store.getState().reset();

    expect(store.getState().list).toBeNull();
    expect(backend.getItem('pairwise-list-ranker:workspace:v1')).toBeNull();
  });
});
