import { describe, expect, it } from 'vitest';

import {
  describeAnswers,
  describeCounts,
  describeRoles,
  selectAvailableTabs,
  selectContextLine,
  selectExportText,
  selectListConfig,
  selectListOptions,
} from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { RankingEvent } from '@/types/rankingEvents';
import { pathKey } from '@/lib/import/paths';
import { activeList, withList } from '@/lib/state/lists';
import type { DataSource, ListConfig, RankedList, Workspace } from '@/types/source';
import { recorded } from '@/tests/helpers/snapshots';

const NOW = '2026-08-15T12:00:00.000Z';

function rankedList(arrayPath: string[], overrides: Partial<RankedList> = {}): RankedList {
  return {
    id: `list-${arrayPath.join('-') || 'root'}`,
    arrayPath,
    roles: {},
    initialStartingOrder: 'unordered',
    configuredExplicitly: true,
    originalItemIds: [],
    items: [],
    events: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** A workspace open at its source's arrayPath, holding these lists. */
function workspaceWith(
  source: DataSource,
  lists: RankedList[],
  listDefaults: ListConfig = { roles: { labelField: 'title' }, startingOrder: 'unordered' },
): Workspace {
  return {
    source,
    listDefaults,
    lists: Object.fromEntries(lists.map((list) => [pathKey(list.arrayPath), list])),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** The workspace with its open list changed. */
function withOpen(workspace: Workspace, changes: Partial<RankedList>): Workspace {
  return withList(workspace, { ...activeList(workspace), ...changes });
}

const workspace = workspaceWith(
  {
    format: 'yaml',
    document: {
      owner: 'david',
      movies: [{ title: 'Alien' }, { title: 'Arrival' }],
    },
    arrayPath: ['movies'],
  },
  [rankedList(['movies'], { roles: { labelField: 'title' } })],
);

function item(id: string, value: ListItem['value']): ListItem {
  return {
    id,
    listId: 'list-1',
    value,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** A pair answer: the right item wins. */
function rightWins(id: string, leftItemId: string, rightItemId: string): RankingEvent {
  return { id, listId: 'list-1', kind: 'pair', leftItemId, rightItemId, outcome: 'right', createdAt: NOW };
}

describe('selectListOptions', () => {
  const movies = [{ ...item('m-1', { title: 'Alien' }) }, { ...item('m-2', { title: 'Arrival' }) }];
  const movieWin: RankingEvent[] = [rightWins('event-1', 'm-1', 'm-2')];
  const twoLists = workspaceWith(
    {
      format: 'yaml',
      document: {
        movies: [{ title: 'Alien' }, { title: 'Arrival' }],
        actors: [{ name: 'Weaver' }, { name: 'Adams' }],
      },
      arrayPath: ['movies'],
    },
    [
      rankedList(['movies'], {
        roles: { labelField: 'title' },
        items: movies,
        originalItemIds: ['m-1', 'm-2'],
      }),
    ],
  );

  it("offers every list with its setup, and the open list's answer count", () => {
    const options = selectListOptions(withOpen(twoLists, { events: recorded(movieWin) }));

    expect(options.map((option) => option.path)).toEqual([['movies'], ['actors']]);
    expect(options[0]!.configLine).toBe('shown by title');
    expect(options[0]!.answers).toBe(1);
    expect(options[1]!.answers).toBeUndefined();
  });

  it('works out a list never opened once, however the open list changes', () => {
    const before = selectListOptions(twoLists);
    const after = selectListOptions(withOpen(twoLists, { events: recorded(movieWin) }));

    expect(after[1]!.configLine).toBe('shown by name');
    expect(selectListConfig(withOpen(twoLists, {}), ['actors'])).toBe(selectListConfig(twoLists, ['actors']));
    expect(before[0]!.answers).toBe(0);
    expect(after[0]!.answers).toBe(1);
  });
});

describe('describeAnswers', () => {
  it('counts answers so far, in the singular for one', () => {
    expect(describeAnswers(0)).toBe('0 answers so far');
    expect(describeAnswers(1)).toBe('1 answer so far');
    expect(describeAnswers(312)).toBe('312 answers so far');
    expect(describeAnswers(12_400)).toBe('12,400 answers so far');
  });
});

describe('describeCounts', () => {
  it('puts the size of the list before the answers', () => {
    expect(describeCounts(120, 312)).toBe('120 items · 312 answers so far');
    expect(describeCounts(1_500, 1)).toBe('1,500 items · 1 answer so far');
  });

  it('counts a single item in the singular', () => {
    expect(describeCounts(1, 0)).toBe('1 item · 0 answers so far');
  });

  it('says only the answers when the size is not known', () => {
    expect(describeCounts(undefined, 4)).toBe('4 answers so far');
  });
});

describe('selectExportText', () => {
  it('serializes the user document with the ranking applied', () => {
    const objects = [item('item-1', { title: 'Alien' }), item('item-2', { title: 'Arrival' })];
    const ranked = withOpen(workspace, {
      items: objects,
      originalItemIds: ['item-1', 'item-2'],
      events: recorded([rightWins('event-1', 'item-1', 'item-2')]),
    });

    const text = selectExportText(ranked, 'yaml');
    expect(text).toContain('owner: david');
    expect(text.indexOf('Arrival')).toBeLessThan(text.indexOf('Alien'));
  });

  it('is empty with no workspace', () => {
    expect(selectExportText(null, 'yaml')).toBe('');
  });
});

describe('selectContextLine', () => {
  it('names the array and the label field', () => {
    expect(selectContextLine(workspace)).toBe('movies · shown by title');
  });

  it('mentions the position field when there is one', () => {
    const withOrder = withOpen(workspace, {
      roles: { labelField: 'title', positionField: 'order' },
    });

    expect(selectContextLine(withOrder)).toBe('movies · shown by title · order written back');
  });

  it('mentions already-ranked status when set', () => {
    const ranked = withOpen(workspace, { initialStartingOrder: 'ranked' });

    expect(selectContextLine(ranked)).toBe('movies · shown by title · already ranked');
  });

  it('names a bare list plainly', () => {
    const bare = workspaceWith({ format: 'list', document: ['a'], arrayPath: [] }, [rankedList([])]);

    expect(selectContextLine(bare)).toBe('the list');
  });

  it('is empty with no workspace', () => {
    expect(selectContextLine(null)).toBe('');
  });
});

describe('selectAvailableTabs', () => {
  it('offers ranked plus the text formats for a structured source', () => {
    expect(selectAvailableTabs(workspace)).toEqual(['ranked', 'yaml', 'json']);
  });

  it('offers the plain list tab for a plain list source', () => {
    const bare = workspaceWith({ format: 'list', document: ['a'], arrayPath: [] }, [rankedList([])]);

    expect(selectAvailableTabs(bare)).toEqual(['ranked', 'list', 'yaml', 'json']);
  });

  it('offers only the ranked tab with no workspace', () => {
    expect(selectAvailableTabs(null)).toEqual(['ranked']);
  });
});

describe('describeRoles', () => {
  it('names the label field', () => {
    expect(describeRoles({ labelField: 'title' }, 'unordered')).toBe('shown by title');
  });

  it('mentions the position field when there is one', () => {
    expect(describeRoles({ labelField: 'title', positionField: 'order' }, 'unordered')).toBe(
      'shown by title · order written back',
    );
  });

  it('mentions already-ranked status when set', () => {
    expect(describeRoles({ labelField: 'title' }, 'ranked')).toBe('shown by title · already ranked');
  });

  it('describeRoles names a rough list', () => {
    expect(describeRoles({ labelField: 'title' }, 'rough')).toBe('shown by title · roughly in order');
    expect(describeRoles({}, 'rough')).toBe('roughly in order');
  });

  it('says nothing about a plain list that is in no particular order', () => {
    expect(describeRoles({}, 'unordered')).toBe('');
  });
});

describe('selectListConfig', () => {
  const document = {
    movies: [{ title: 'Alien' }, { title: 'Arrival' }],
    actors: [{ name: 'Weaver' }, { name: 'Adams' }],
  };
  const openMovies = rankedList(['movies'], {
    roles: { labelField: 'title' },
    initialStartingOrder: 'ranked',
  });
  const multiList = workspaceWith({ format: 'yaml', document, arrayPath: ['movies'] }, [openMovies], {
    roles: { labelField: 'title' },
    startingOrder: 'ranked',
  });
  const setUpActors = rankedList(['actors'], { roles: { labelField: 'name' } });

  it('reports the open list its own configuration', () => {
    expect(selectListConfig(multiList, ['movies'])).toEqual({
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
    });
  });

  it('reports a list set up by hand the configuration it was set up with', () => {
    expect(selectListConfig(withList(multiList, setUpActors), ['actors'])).toEqual({
      roles: { labelField: 'name' },
      startingOrder: 'unordered',
    });
  });

  it('takes the order answer for an unconfigured list from the document defaults', () => {
    const defaultNotRanked = {
      ...multiList,
      listDefaults: { roles: { labelField: 'title' }, startingOrder: 'unordered' as const },
    };

    expect(selectListConfig(defaultNotRanked, ['actors']).startingOrder).toBe('unordered');
  });

  it('falls back to the target list own label field when the default one is absent', () => {
    expect(selectListConfig(multiList, ['actors']).roles).toEqual({
      labelField: 'name',
    });
  });

  it('keeps the default label field when the target list carries it too', () => {
    const shared = workspaceWith(
      {
        format: 'yaml',
        document: {
          movies: [{ title: 'Alien' }, { title: 'Arrival' }],
          books: [{ title: 'Dune' }, { title: 'Ubik' }],
        },
        arrayPath: ['movies'],
      },
      [openMovies],
      multiList.listDefaults,
    );

    expect(selectListConfig(shared, ['books']).roles).toEqual({
      labelField: 'title',
    });
  });

  it('takes an unconfigured list from the defaults, not from whatever list is open', () => {
    const onYear = workspaceWith(
      {
        format: 'yaml',
        document: {
          movies: [{ title: 'Alien', year: 1979 }],
          books: [{ title: 'Dune', year: 1965 }],
        },
        arrayPath: ['movies'],
      },
      [rankedList(['movies'], { roles: { labelField: 'year' } })],
      { roles: { labelField: 'title' }, startingOrder: 'ranked' },
    );

    expect(selectListConfig(onYear, ['books'])).toEqual({
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
    });
  });

  it('re-derives a list left earlier that was never set up by hand', () => {
    const inherited = rankedList(['actors'], {
      roles: { labelField: 'name' },
      configuredExplicitly: false,
    });
    const defaults = workspaceWith(
      {
        format: 'yaml',
        document: {
          movies: [{ title: 'Alien' }],
          actors: [{ name: 'Weaver', nickname: 'Ripley' }],
        },
        arrayPath: ['movies'],
      },
      [openMovies, inherited],
      { roles: { labelField: 'nickname' }, startingOrder: 'ranked' },
    );

    expect(selectListConfig(defaults, ['actors'])).toEqual({
      roles: { labelField: 'nickname' },
      startingOrder: 'ranked',
    });
  });

  it('has nothing to inherit with no workspace', () => {
    expect(selectListConfig(null, ['movies'])).toEqual({
      roles: {},
      startingOrder: 'unordered',
    });
  });
});

describe('a sorted list in the switcher rows', () => {
  it('a row says sorted by, in the words the toolbar uses', () => {
    const albums = [
      { title: 'Low', plays: 5 },
      { title: 'Top', plays: 100 },
    ];
    const workspace = workspaceWith(
      { format: 'yaml', document: { albums, other: [{ name: 'x' }] }, arrayPath: ['other'] },
      [
        rankedList(['albums'], {
          roles: { labelField: 'title' },
          initialStartingOrder: 'rough',
          initialSort: { field: 'plays', direction: 'desc' },
          items: albums.map((value, index) => item(`a-${index}`, value)),
        }),
      ],
    );

    const row = selectListOptions(workspace).find((option) => option.path[0] === 'albums');
    expect(row?.configLine).toBe('shown by title · roughly in order · sorted by plays, high to low');
  });
});

describe('a sorted list in the config line', () => {
  const albums = [
    { title: 'Low', plays: 5 },
    { title: 'Top', plays: 100 },
  ];
  const sorted = workspaceWith({ format: 'yaml', document: { albums }, arrayPath: ['albums'] }, [
    rankedList(['albums'], {
      roles: { labelField: 'title' },
      initialStartingOrder: 'rough',
      initialSort: { field: 'plays', direction: 'desc' },
      items: albums.map((value, index) => item(`a-${index}`, value)),
    }),
  ]);

  it('the config line says sorted by the field', () => {
    expect(selectContextLine(sorted)).toBe(
      'albums · shown by title · roughly in order · sorted by plays, high to low',
    );
    expect(describeRoles({}, 'rough', 'sorted by plays, high to low')).toBe(
      'roughly in order · sorted by plays, high to low',
    );
  });

  it('describes a date field as newest or oldest first, and a vanished field as a number sort', () => {
    const dated = [{ at: '2024-01-01' }, { at: '2025-06-01' }];
    const onDates = workspaceWith({ format: 'yaml', document: { d: dated }, arrayPath: ['d'] }, [
      rankedList(['d'], {
        initialStartingOrder: 'rough',
        initialSort: { field: 'at', direction: 'asc' },
        items: dated.map((value, index) => item(`d-${index}`, value)),
      }),
    ]);
    const gone = withOpen(sorted, { initialSort: { field: 'missing', direction: 'asc' } });

    expect(selectContextLine(onDates)).toBe('d · roughly in order · sorted by at, oldest first');
    expect(selectContextLine(gone)).toBe(
      'albums · shown by title · roughly in order · sorted by missing, low to high',
    );
  });
});
