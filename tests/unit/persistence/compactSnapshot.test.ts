import { describe, expect, it } from 'vitest';

import { compactSnapshot, parseWorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { everyKindOfEvent, listItem, rankedList, snapshotOf } from '@/tests/helpers/snapshots';
import type { ListItem } from '@/types/list';

const films = [
  { title: 'Alien', year: 1979 },
  { title: 'Arrival', year: 2016 },
  { title: 'Aliens', year: 1986 },
];

/** A list over `films` whose items are a, b, c in document order. */
function filmSnapshot(values: ListItem['value'][] = films, document: unknown = { movies: films }) {
  const ids = ['a', 'b', 'c', 'd'];
  const items = values.map((value, index) => listItem(ids[index]!, 'movies-1', value));
  const list = rankedList({
    items,
    originalItemIds: items.map((item) => item.id),
    events: everyKindOfEvent('movies-1'),
  });
  return snapshotOf(list, document);
}

/** Written and read back, the way storage and session files carry it. */
function roundTrip(snapshot: WorkspaceSnapshot) {
  return parseWorkspaceSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot))));
}

describe('compactSnapshot', () => {
  it('names each item by its entry rather than writing its value again', () => {
    const items = compactSnapshot(filmSnapshot()).workspace.lists.movies!.items;

    expect(items.map((item) => item.entry)).toEqual([0, 1, 2]);
    expect(items.every((item) => item.value === undefined)).toBe(true);
  });

  it('reads back exactly what was written, events and original items included', () => {
    const snapshot = filmSnapshot();

    expect(roundTrip(snapshot)).toEqual(snapshot);
  });

  it('finds an entry by its value once an edit has moved it', () => {
    const reordered = [films[2]!, films[0]!, films[1]!];
    const snapshot = filmSnapshot(films, { movies: reordered });

    const items = compactSnapshot(snapshot).workspace.lists.movies!.items;
    expect(items.map((item) => item.entry)).toEqual([1, 2, 0]);
    expect(roundTrip(snapshot)).toEqual(snapshot);
  });

  it('keeps the value of an item the document no longer holds', () => {
    const snapshot = filmSnapshot(films, { movies: films.slice(0, 2) });

    const items = compactSnapshot(snapshot).workspace.lists.movies!.items;
    const removed = items.filter((item) => item.entry === undefined);
    expect(removed.map((item) => item.value)).toEqual([films[2]]);
    expect(roundTrip(snapshot)).toEqual(snapshot);
  });

  it('saves the space of every item value, which the document already holds', () => {
    const many = Array.from({ length: 300 }, (_, index) => ({
      title: `Film ${index}`,
      synopsis: 'x'.repeat(200),
    }));
    const items = many.map((value, index) => listItem(`item-${index}`, 'movies-1', value));
    const snapshot = snapshotOf(rankedList({ items }), { movies: many });

    const full = JSON.stringify(snapshot).length;
    const compact = JSON.stringify(compactSnapshot(snapshot)).length;
    const values = many.reduce((sum, movie) => sum + JSON.stringify(movie).length, 0);
    expect(full - compact).toBeGreaterThan(values * 0.95);
  });

  it('rejects an item that names an entry the document does not have', () => {
    const stored = JSON.parse(JSON.stringify(compactSnapshot(filmSnapshot())));
    stored.workspace.lists.movies.items[0].entry = 99;

    expect(parseWorkspaceSnapshot(stored)).toBeNull();
  });

  it('reloads a list of numbers, which the old item check turned away', () => {
    const items = [3, 1, 2].map((value, index) =>
      listItem(`n-${index}`, 'scores-1', value as unknown as string),
    );
    const list = rankedList({ id: 'scores-1', arrayPath: ['scores'], items });

    const parsed = roundTrip(snapshotOf(list, { scores: [3, 1, 2], flags: [true, false] }));

    expect(parsed?.workspace.lists.scores?.items.map((item) => item.value)).toEqual([3, 1, 2]);
  });
});
