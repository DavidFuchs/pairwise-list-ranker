import { describe, expect, it } from 'vitest';

import {
  buildSessionFile,
  describeLostWork,
  describeSession,
  hasChanges,
  readSavedFile,
  SESSION_FILE_KIND,
  SESSION_FILE_VERSION,
} from '@/lib/session/sessionFile';
import { everyKindOfEvent, listItem, NOW, rankedList, snapshotOf, recorded } from '@/tests/helpers/snapshots';
import type { RankingEvent } from '@/types/rankingEvents';
import type { Workspace } from '@/types/source';

const document = {
  owner: 'me',
  movies: [{ title: 'Alien' }, { title: 'Arrival' }, { title: 'Aliens' }],
  books: [{ title: 'Dune' }, { title: 'Emma' }],
};

const pair = (id: string): RankingEvent => ({
  kind: 'pair',
  id,
  listId: 'movies-1',
  leftItemId: 'a',
  rightItemId: 'b',
  outcome: 'left',
  createdAt: NOW,
});

const removal: RankingEvent = {
  kind: 'removal',
  id: 'm1',
  listId: 'movies-1',
  itemIds: ['c'],
  createdAt: NOW,
};

/** Three films with work in them: a pair, a placement, a removal. */
function workedSnapshot() {
  const items = [
    listItem('a', 'movies-1', { title: 'Alien' }),
    listItem('b', 'movies-1', { title: 'Arrival' }),
    listItem('c', 'movies-1', { title: 'Aliens' }),
  ];
  const list = rankedList({
    items,
    originalItemIds: ['a', 'b', 'c'],
    initialStartingOrder: 'rough',
    roles: { labelField: 'title', summaryFields: ['year'], fieldRenderers: { year: 'compact' } },
    events: recorded([
      pair('e1'),
      {
        kind: 'placement',
        id: 'e2',
        listId: 'movies-1',
        itemId: 'b',
        aboveItemId: 'a',
        createdAt: NOW,
      },
      removal,
    ]),
  });
  return { ...snapshotOf(list, document), ui: { previewTab: 'json' as const } };
}

const roundTrip = (text: string) => JSON.parse(JSON.stringify(JSON.parse(text))) as unknown;

describe('session files', () => {
  it('carries a whole session across, setup and decisions alike', () => {
    const snapshot = workedSnapshot();
    const text = JSON.stringify(buildSessionFile(snapshot, '2026-10-16T12:00:00.000Z'));

    const saved = readSavedFile(text);
    expect(saved.type).toBe('session');
    if (saved.type !== 'session') return;

    expect(saved.session).toEqual(snapshot);
    expect(saved.session.workspace.lists.movies?.events).toHaveLength(3);
    expect(saved.session.workspace.lists.movies?.initialStartingOrder).toBe('rough');
    expect(saved.savedAt).toBe('2026-10-16T12:00:00.000Z');
  });

  it('carries a workspace holding every kind of event', () => {
    const list = rankedList({
      items: ['a', 'b', 'c', 'd', 'e'].map((id) => listItem(id, 'movies-1', { title: id })),
      originalItemIds: ['a', 'b', 'c', 'd'],
      events: everyKindOfEvent('movies-1'),
    });
    const snapshot = snapshotOf(list, { movies: ['a', 'b', 'c', 'd', 'e'].map((title) => ({ title })) });

    const saved = readSavedFile(JSON.stringify(buildSessionFile(snapshot, '')));

    expect(saved.type === 'session' && saved.session).toEqual(snapshot);
  });

  it('keeps every list, not only the open one', () => {
    const snapshot = workedSnapshot();
    const books = rankedList({
      id: 'books-1',
      arrayPath: ['books'],
      items: [listItem('d', 'books-1', { title: 'Dune' }), listItem('e', 'books-1', { title: 'Emma' })],
      originalItemIds: ['d', 'e'],
      initialStartingOrder: 'ranked',
    });
    const workspace: Workspace = {
      ...snapshot.workspace,
      source: { ...snapshot.workspace.source, arrayPath: ['books'] },
      lists: { ...snapshot.workspace.lists, books },
    };

    const saved = readSavedFile(JSON.stringify(buildSessionFile({ ...snapshot, workspace }, '')));
    if (saved.type !== 'session') throw new Error('expected a session');

    expect(saved.session.workspace.source.arrayPath).toEqual(['books']);
    expect(Object.values(saved.session.workspace.lists).map((list) => list.arrayPath)).toEqual([
      ['movies'],
      ['books'],
    ]);
    expect(saved.session.workspace.lists.movies!.events).toHaveLength(3);
    expect(saved.session.workspace.lists.books!.initialStartingOrder).toBe('ranked');
  });

  it('leaves an ordinary JSON document alone, as a list to import', () => {
    expect(readSavedFile(JSON.stringify([{ title: 'Alien' }]))).toEqual({ type: 'other' });
    expect(readSavedFile(JSON.stringify({ kind: 'recipe', items: [] }))).toEqual({ type: 'other' });
    expect(readSavedFile('Alien\nArrival')).toEqual({ type: 'other' });
  });

  it('is version 4', () => {
    expect(SESSION_FILE_VERSION).toBe(4);
  });

  it('a version 3 session file gives today\'s "different version" message', () => {
    const file = buildSessionFile(workedSnapshot(), '');
    const old = { ...file, version: 3, session: { ...file.session, version: 7 } };

    expect(readSavedFile(JSON.stringify(old))).toEqual({
      type: 'unreadable',
      reason: 'That session was saved by a different version of this app.',
    });
  });

  it('a version 1 session file gives today\'s "different version" message', () => {
    const file = buildSessionFile(workedSnapshot(), '');
    const old = { ...file, version: 1, session: { ...file.session, version: 5 } };

    expect(readSavedFile(JSON.stringify(old))).toEqual({
      type: 'unreadable',
      reason: 'That session was saved by a different version of this app.',
    });
  });

  it('refuses a newer session file the same way', () => {
    const file = buildSessionFile(workedSnapshot(), '');

    expect(readSavedFile(JSON.stringify({ ...file, version: 5 }))).toEqual({
      type: 'unreadable',
      reason: 'That session was saved by a different version of this app.',
    });
  });

  it('refuses a damaged session rather than half-loading it', () => {
    const file = roundTrip(JSON.stringify(buildSessionFile(workedSnapshot(), ''))) as {
      session: { workspace: { lists: unknown } };
    };
    file.session.workspace.lists = 'not a list';
    expect(readSavedFile(JSON.stringify(file)).type).toBe('unreadable');
  });

  it('refuses a session whose history holds an event of an unknown kind', () => {
    const file = roundTrip(JSON.stringify(buildSessionFile(workedSnapshot(), ''))) as {
      session: { workspace: { lists: { movies: { events: unknown[] } } } };
    };
    file.session.workspace.lists.movies.events.push({ id: 'x', listId: 'movies-1', kind: 'skip' });

    expect(readSavedFile(JSON.stringify(file)).type).toBe('unreadable');
  });

  it('labels itself so it can be told apart from a list', () => {
    expect(buildSessionFile(workedSnapshot(), '').kind).toBe(SESSION_FILE_KIND);
  });

  it('describes what a session holds, counting changes: every action, a removal included', () => {
    expect(describeSession(workedSnapshot())).toBe('2 items · 3 changes');
  });
});

describe('hasChanges', () => {
  it('is false with nothing recorded', () => {
    expect(hasChanges(null)).toBe(false);
    expect(hasChanges(snapshotOf(rankedList(), document).workspace)).toBe(false);
  });

  it('is true once any action is recorded, a removal included', () => {
    expect(hasChanges(snapshotOf(rankedList({ events: recorded([removal]) }), document).workspace)).toBe(
      true,
    );
    expect(hasChanges(workedSnapshot().workspace)).toBe(true);
  });
});

describe('describeLostWork', () => {
  it('counts the changes a start-over would throw away', () => {
    expect(describeLostWork(workedSnapshot().workspace)).toBe('Your 3 changes will be lost.');
  });

  it('names the lists when more than one has changes', () => {
    const snapshot = workedSnapshot();
    const books = rankedList({
      id: 'books-1',
      arrayPath: ['books'],
      events: recorded([{ ...pair('e9'), listId: 'books-1' }]),
    });
    const workspace: Workspace = { ...snapshot.workspace, lists: { ...snapshot.workspace.lists, books } };

    expect(describeLostWork(workspace)).toBe('Your 4 changes across 2 lists will be lost.');
  });

  it('says nothing when nothing would be lost', () => {
    const empty = snapshotOf(rankedList(), document).workspace;

    expect(describeLostWork(empty)).toBeUndefined();
    expect(describeLostWork(null)).toBeUndefined();
  });
});

describe('a sorted list in a session file', () => {
  it('initialSort survives a save and load and a session file round trip', () => {
    const sort = { field: 'plays', direction: 'desc' as const };
    const snapshot = workedSnapshot();
    const list = snapshot.workspace.lists['movies'];
    snapshot.workspace.lists['movies'] = { ...list!, initialSort: sort };

    const read = readSavedFile(JSON.stringify(buildSessionFile(snapshot, '')));

    expect(read.type).toBe('session');
    if (read.type === 'session') {
      expect(read.session.workspace.lists['movies']?.initialSort).toEqual(sort);
    }
  });
});
