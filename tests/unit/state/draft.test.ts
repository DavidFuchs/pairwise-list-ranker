import { describe, expect, it } from 'vitest';

import { findArrayCandidates } from '@/lib/import/arrayCandidates';
import { pathKey } from '@/lib/import/paths';
import { selectExportText } from '@/lib/state/selectors';
import { buildSetupSeed, selectAnswerCounts, selectConfigLines } from '@/lib/state/draft';
import type { ListItem } from '@/types/list';
import type { RankingEvent } from '@/types/rankingEvents';
import type { RankedList, Workspace } from '@/types/source';
import { recorded } from '@/tests/helpers/snapshots';

const NOW = '2026-08-15T12:00:00.000Z';

const document = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: ['Weaver', 'Adams'],
};

function item(id: string, value: ListItem['value']): ListItem {
  return { id, listId: 'ws', value, createdAt: NOW, updatedAt: NOW };
}

const arrivalWins: RankingEvent[] = [
  {
    id: 'e1',
    listId: 'movies',
    kind: 'pair',
    leftItemId: 'm1',
    rightItemId: 'm2',
    outcome: 'right',
    createdAt: NOW,
  },
];

const movies: RankedList = {
  id: 'movies',
  arrayPath: ['movies'],
  roles: { labelField: 'title' },
  initialStartingOrder: 'unordered',
  configuredExplicitly: true,
  originalItemIds: ['m1', 'm2'],
  items: [item('m1', { title: 'Alien' }), item('m2', { title: 'Arrival' })],
  events: recorded(arrivalWins),
  createdAt: NOW,
  updatedAt: NOW,
};

const actors: RankedList = {
  id: 'actors',
  arrayPath: ['actors'],
  roles: {},
  initialStartingOrder: 'ranked',
  configuredExplicitly: true,
  originalItemIds: ['a1', 'a2'],
  items: [item('a1', 'Weaver'), item('a2', 'Adams')],
  events: [],
  createdAt: NOW,
  updatedAt: NOW,
};

function workspaceOf(lists: RankedList[]): Workspace {
  return {
    source: { format: 'json', document, arrayPath: ['movies'] },
    listDefaults: { roles: { labelField: 'title' }, startingOrder: 'unordered' },
    lists: Object.fromEntries(lists.map((list) => [pathKey(list.arrayPath), list])),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('buildSetupSeed', () => {
  it('is undefined with nothing loaded', () => {
    expect(buildSetupSeed({ workspace: null })).toBeUndefined();
  });

  it('buildSetupSeed gives the stored document, not the ranking order', () => {
    const seed = buildSetupSeed({ workspace: workspaceOf([movies, actors]) })!;

    expect(JSON.parse(seed.rawText)).toEqual(document);
    expect(seed.override).toBe('json');
    expect(seed.arrayPath).toEqual(['movies']);
    expect(seed.roles).toEqual({ labelField: 'title' });
    expect(seed.startingOrder).toBe('unordered');
    expect(seed.knownLists).toEqual({ movies: 'unordered', actors: 'ranked' });
  });

  it("remembers each list's own roles, for lists opened or not", () => {
    const seed = buildSetupSeed({ workspace: workspaceOf([movies, actors]) })!;

    expect(seed.knownRoles).toEqual({ movies: { labelField: 'title' }, actors: {} });
  });

  it('the seed carries the shown list sort and every list sort', () => {
    const sorted: RankedList = {
      ...actors,
      arrayPath: ['movies'],
      id: 'movies',
      initialStartingOrder: 'rough',
      initialSort: { field: 'year', direction: 'asc' },
    };
    const other: RankedList = { ...actors, initialSort: { field: 'n', direction: 'desc' } };
    const workspace = workspaceOf([sorted, other]);

    const seed = buildSetupSeed({ workspace })!;
    expect(seed.sort).toEqual({ field: 'year', direction: 'asc' });
    expect(seed.knownSorts).toEqual({
      movies: { field: 'year', direction: 'asc' },
      actors: { field: 'n', direction: 'desc' },
    });

    expect(buildSetupSeed({ workspace }, ['actors'])!.sort).toEqual({ field: 'n', direction: 'desc' });
    expect(buildSetupSeed({ workspace: workspaceOf([movies]) })!.sort).toBeUndefined();
    expect(buildSetupSeed({ workspace: workspaceOf([movies]) })!.knownSorts).toEqual({});
  });

  it('writes a plain list one item per line', () => {
    const workspace: Workspace = {
      ...workspaceOf([{ ...actors, arrayPath: [] }]),
      source: { format: 'list', document: ['Weaver', 'Adams'], arrayPath: [] },
    };

    expect(buildSetupSeed({ workspace })!.rawText).toBe('Weaver\nAdams\n');
  });
});

describe('selectAnswerCounts', () => {
  it('counts the answers of each list that has any, open or not', () => {
    const actorsAnswered: RankedList = {
      ...actors,
      events: recorded([
        {
          id: 'e2',
          listId: 'actors',
          kind: 'pair',
          leftItemId: 'a1',
          rightItemId: 'a2',
          outcome: 'draw',
          createdAt: NOW,
        },
        {
          id: 'e3',
          listId: 'actors',
          kind: 'placement',
          itemId: 'a2',
          aboveItemId: 'a1',
          createdAt: NOW,
        },
      ]),
    };

    expect(selectAnswerCounts(workspaceOf([movies, actorsAnswered]))).toEqual({ movies: 1, actors: 1 });
  });

  it('leaves out a list with no answers, even one declared already ranked', () => {
    expect(selectAnswerCounts(workspaceOf([{ ...movies, events: [] }, actors]))).toEqual({});
  });
});

describe('selectConfigLines', () => {
  const { candidates } = findArrayCandidates(document);

  it('describes each list, and the one on screen by its controls', () => {
    const lines = selectConfigLines(workspaceOf([movies]), document, candidates, {
      path: ['movies'],
      roles: { labelField: 'title' },
      startingOrder: 'ranked',
    });

    expect(lines[pathKey(['movies'])]).toBe('shown by title · already ranked');
    expect(lines[pathKey(['actors'])]).toBe('');
  });
});

describe('selectExportText', () => {
  it('writes every list opened so far in its ranked order, not only the open one', () => {
    // Actors is open; movies, ranked earlier, has Arrival above Alien.
    const workspace = {
      ...workspaceOf([movies, actors]),
      source: { format: 'json' as const, document, arrayPath: ['actors'] },
    };
    const exported = JSON.parse(selectExportText(workspace, 'json'));

    expect(exported.movies.map((movie: { title: string }) => movie.title)).toEqual(['Arrival', 'Alien']);
  });
});

describe('selectConfigLines for a sorted list', () => {
  it('the setup config line says sorted by the chosen field', () => {
    const sortedDocument = { albums: [{ plays: 1 }, { plays: 9 }] };
    const sorted: RankedList = {
      ...movies,
      arrayPath: ['albums'],
      roles: {},
      initialStartingOrder: 'rough',
      initialSort: { field: 'plays', direction: 'desc' },
      items: [item('x1', { plays: 1 }), item('x2', { plays: 9 })],
    };
    const { candidates } = findArrayCandidates(sortedDocument);

    const lines = selectConfigLines(workspaceOf([sorted]), sortedDocument, candidates, null);

    expect(lines[pathKey(['albums'])]).toBe('roughly in order · sorted by plays, high to low');
  });
});
