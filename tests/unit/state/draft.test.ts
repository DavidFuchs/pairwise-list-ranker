import { describe, expect, it } from 'vitest';

import { findArrayCandidates } from '@/lib/import/arrayCandidates';
import { pathKey } from '@/lib/import/paths';
import { buildDraftSeed, selectConfigLines, selectRankedCoverages } from '@/lib/state/draft';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { RankedList, Workspace } from '@/types/source';

const NOW = '2026-08-15T12:00:00.000Z';

const document = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: ['Weaver', 'Adams'],
};

function item(id: string, value: ListItem['value']): ListItem {
  return { id, listId: 'ws', value, active: true, createdAt: NOW, updatedAt: NOW };
}

const arrivalWins: ComparisonEvent[] = [
  { id: 'e1', listId: 'movies', leftItemId: 'm1', rightItemId: 'm2', outcome: 'right', createdAt: NOW },
];

const movies: RankedList = {
  id: 'movies',
  arrayPath: ['movies'],
  roles: { labelField: 'title' },
  alreadyRanked: false,
  configuredExplicitly: true,
  items: [item('m1', { title: 'Alien' }), item('m2', { title: 'Arrival' })],
  comparisonEvents: arrivalWins,
  createdAt: NOW,
  updatedAt: NOW,
};

const actors: RankedList = {
  id: 'actors',
  arrayPath: ['actors'],
  roles: {},
  alreadyRanked: true,
  configuredExplicitly: true,
  items: [item('a1', 'Weaver'), item('a2', 'Adams')],
  comparisonEvents: [],
  createdAt: NOW,
  updatedAt: NOW,
};

function workspaceOf(lists: RankedList[]): Workspace {
  return {
    source: { format: 'json', document, arrayPath: ['movies'] },
    listDefaults: { roles: { labelField: 'title' }, alreadyRanked: false },
    lists: Object.fromEntries(lists.map((list) => [pathKey(list.arrayPath), list])),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('buildDraftSeed', () => {
  it('is undefined with nothing loaded', () => {
    expect(buildDraftSeed({ workspace: null, pendingSwitchPath: null })).toBeUndefined();
  });

  it('opens on the ranked order and remembers every known list', () => {
    const seed = buildDraftSeed({ workspace: workspaceOf([movies, actors]), pendingSwitchPath: ['actors'] })!;

    expect(JSON.parse(seed.rawText).movies.map((movie: { title: string }) => movie.title)).toEqual([
      'Arrival',
      'Alien',
    ]);
    expect(seed.knownLists).toEqual({ movies: false, actors: true });
    expect(seed.arrayPath).toEqual(['movies']);
    expect(seed.initialSelectedPath).toEqual(['actors']);
  });
});

describe('selectRankedCoverages', () => {
  it('reads a meter for each list with progress, open or not', () => {
    const coverages = selectRankedCoverages(workspaceOf([movies, actors]));

    expect(Object.keys(coverages).sort()).toEqual(['actors', 'movies']);
  });

  it('leaves out a list with nothing to show', () => {
    expect(selectRankedCoverages(workspaceOf([{ ...movies, comparisonEvents: [] }]))).toEqual({});
  });
});

describe('selectConfigLines', () => {
  const { candidates } = findArrayCandidates(document);

  it('describes each list, and the one on screen by its controls', () => {
    const lines = selectConfigLines(workspaceOf([movies]), document, candidates, {
      path: ['movies'],
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });

    expect(lines[pathKey(['movies'])]).toBe('shown by title · already ranked');
    expect(lines[pathKey(['actors'])]).toBe('');
  });
});
