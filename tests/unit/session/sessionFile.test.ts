import { describe, expect, it } from 'vitest';

import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { buildProgressFile } from '@/lib/progress/progressFile';
import { buildSessionFile, describeSession, readSavedFile, SESSION_FILE_KIND } from '@/lib/session/sessionFile';
import { createListStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';

function memoryBackend(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

let ids = 0;
function makeStore() {
  return createListStore({
    storage: createWorkspaceStorage(memoryBackend()),
    now: () => '2026-08-16T00:00:00.000Z',
    createId: () => `id-${(ids += 1)}`,
  });
}

const films: DataSource = {
  format: 'yaml',
  rawText: 'owner: me\nmovies:\n  - title: Alien\n    year: 1979\n  - title: Arrival\n    year: 2016\n  - title: Aliens\n    year: 1986\nbooks:\n  - title: Dune\n  - title: Emma\n',
  document: {
    owner: 'me',
    movies: [
      { title: 'Alien', year: 1979 },
      { title: 'Arrival', year: 2016 },
      { title: 'Aliens', year: 1986 },
    ],
    books: [{ title: 'Dune' }, { title: 'Emma' }],
  },
  arrayPath: ['movies'],
};

/** A store with real work in it: setup, choices, a placement, a removal and a parked list. */
function workedStore() {
  const store = makeStore();
  store.getState().startRanking({
    source: films,
    roles: { labelField: 'title', summaryFields: ['year'], fieldRenderers: { year: 'compact' } },
    alreadyRanked: true,
  });
  const [alien, arrival, aliens] = store.getState().items.map((item) => item.id) as [string, string, string];
  store.getState().recordComparison(arrival, alien, 'left_strong');
  store.getState().reorderItem(aliens, [aliens, arrival, alien]);
  store.getState().removeItem(alien);
  store.getState().setPreviewTab('json');
  return store;
}

const roundTrip = (text: string) => JSON.parse(JSON.stringify(JSON.parse(text))) as unknown;

describe('session files', () => {
  it('carries a whole session to a fresh store, setup and decisions alike', () => {
    const source = workedStore();
    const text = JSON.stringify(buildSessionFile(source.getState().snapshot()!, '2026-10-16T12:00:00.000Z'));

    const saved = readSavedFile(text);
    expect(saved.type).toBe('session');
    if (saved.type !== 'session') return;

    const target = makeStore();
    target.getState().loadSession(saved.session);
    const [before, after] = [source.getState(), target.getState()];

    expect(after.workspace).toEqual(before.workspace);
    expect(after.items).toEqual(before.items);
    expect(after.comparisonEvents).toEqual(before.comparisonEvents);
    expect(after.previewTab).toBe('json');
    expect(after.ranking().map((entry) => entry.item.id)).toEqual(before.ranking().map((entry) => entry.item.id));
    expect(after.workspace?.roles.fieldRenderers).toEqual({ year: 'compact' });
    expect(after.workspace?.alreadyRanked).toBe(true);
    expect(saved.savedAt).toBe('2026-10-16T12:00:00.000Z');
  });

  it('keeps lists parked while another is open', () => {
    const store = workedStore();
    store.getState().switchList({
      source: { ...films, arrayPath: ['books'] },
      roles: { labelField: 'title' },
      alreadyRanked: false,
      configuredExplicitly: true,
    });
    const text = JSON.stringify(buildSessionFile(store.getState().snapshot()!, ''));

    const saved = readSavedFile(text);
    if (saved.type !== 'session') throw new Error('expected a session');
    expect(saved.session.workspace.source.arrayPath).toEqual(['books']);
    expect(saved.session.savedLists.map((list) => list.arrayPath)).toEqual([['movies']]);
    expect(saved.session.savedLists[0]!.comparisonEvents).toHaveLength(2);
  });

  it('leaves an ordinary JSON document alone, as a list to import', () => {
    expect(readSavedFile(JSON.stringify([{ title: 'Alien' }]))).toEqual({ type: 'other' });
    expect(readSavedFile(JSON.stringify({ kind: 'recipe', items: [] }))).toEqual({ type: 'other' });
    expect(readSavedFile('Alien\nArrival')).toEqual({ type: 'other' });
  });

  it('recognises a progress file from before sessions', () => {
    const store = workedStore();
    const progress = buildProgressFile(store.getState().items, store.getState().comparisonEvents, ['movies'], '');
    expect(readSavedFile(JSON.stringify(progress)).type).toBe('progress');
  });

  it('refuses a session from another version, and says so', () => {
    const file = buildSessionFile(workedStore().getState().snapshot()!, '');
    const newer = { ...file, version: 2 };
    expect(readSavedFile(JSON.stringify(newer))).toEqual({
      type: 'unreadable',
      reason: 'That session was saved by a different version of this app.',
    });
  });

  it('refuses a damaged session rather than half-loading it', () => {
    const file = roundTrip(JSON.stringify(buildSessionFile(workedStore().getState().snapshot()!, ''))) as {
      session: { items: unknown };
    };
    file.session.items = 'not a list';
    expect(readSavedFile(JSON.stringify(file)).type).toBe('unreadable');
  });

  it('labels itself so it can be told apart from a list', () => {
    const file = buildSessionFile(workedStore().getState().snapshot()!, '');
    expect(file.kind).toBe(SESSION_FILE_KIND);
  });

  it('describes what a session holds', () => {
    expect(describeSession(workedStore().getState().snapshot()!)).toBe('2 items · 2 decisions');
  });

  it('starts a loaded session with nothing to undo', () => {
    const store = workedStore();
    const session = store.getState().snapshot()!;
    const target = makeStore();
    target.getState().startRanking({ source: films, roles: {} });
    target.getState().recordComparison(target.getState().items[0]!.id, target.getState().items[1]!.id, 'left');

    target.getState().loadSession(session);

    expect(target.getState().undoStack).toEqual([]);
  });

  it('has nothing to save before a list is loaded', () => {
    expect(makeStore().getState().snapshot()).toBeNull();
  });
});
