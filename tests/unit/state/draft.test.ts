import { describe, expect, it } from 'vitest';

import { findArrayCandidates } from '@/lib/import/arrayCandidates';
import { pathKey } from '@/lib/import/paths';
import { buildDraftSeed, selectConfigLines, selectRankedCoverages } from '@/lib/state/draft';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { SavedList, Workspace } from '@/types/source';

const NOW = '2026-08-15T12:00:00.000Z';

const document = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: ['Weaver', 'Adams'],
};

const workspace: Workspace = {
  id: 'ws',
  source: { format: 'json', rawText: '', document, arrayPath: ['movies'] },
  roles: { labelField: 'title' },
  alreadyRanked: false,
  listDefaults: { roles: { labelField: 'title' }, alreadyRanked: false },
  configuredExplicitly: true,
  createdAt: NOW,
  updatedAt: NOW,
};

function item(id: string, value: ListItem['value']): ListItem {
  return { id, listId: 'ws', value, active: true, createdAt: NOW, updatedAt: NOW };
}

const movies = [item('m1', { title: 'Alien' }), item('m2', { title: 'Arrival' })];
const arrivalWins: ComparisonEvent[] = [
  { id: 'e1', listId: 'ws', leftItemId: 'm1', rightItemId: 'm2', outcome: 'right', createdAt: NOW },
];

const actorsParked: SavedList = {
  workspaceId: 'ws-actors',
  arrayPath: ['actors'],
  roles: {},
  alreadyRanked: true,
  configuredExplicitly: true,
  items: [item('a1', 'Weaver'), item('a2', 'Adams')],
  comparisonEvents: [],
  createdAt: NOW,
  updatedAt: NOW,
};

describe('buildDraftSeed', () => {
  it('is undefined with nothing loaded', () => {
    expect(
      buildDraftSeed({ workspace: null, items: [], comparisonEvents: [], savedLists: [], pendingSwitchPath: null }),
    ).toBeUndefined();
  });

  it('opens on the ranked order and remembers every known list', () => {
    const seed = buildDraftSeed({
      workspace,
      items: movies,
      comparisonEvents: arrivalWins,
      savedLists: [actorsParked],
      pendingSwitchPath: ['actors'],
    })!;

    expect(JSON.parse(seed.rawText).movies.map((movie: { title: string }) => movie.title)).toEqual(['Arrival', 'Alien']);
    expect(seed.knownLists).toEqual({ movies: false, actors: true });
    expect(seed.initialSelectedPath).toEqual(['actors']);
  });
});

describe('selectRankedCoverages', () => {
  it('reads a meter for each list with progress, active or parked', () => {
    const coverages = selectRankedCoverages(workspace, [actorsParked], movies, arrivalWins);

    expect(Object.keys(coverages).sort()).toEqual(['actors', 'movies']);
  });

  it('leaves out a list with nothing to show', () => {
    expect(selectRankedCoverages(workspace, [], movies, [])).toEqual({});
  });
});

describe('selectConfigLines', () => {
  const { candidates } = findArrayCandidates(document);

  it('describes each list, and the one on screen by its controls', () => {
    const lines = selectConfigLines(workspace, [], document, candidates, {
      path: ['movies'],
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });

    expect(lines[pathKey(['movies'])]).toBe('shown by title · already ranked');
    expect(lines[pathKey(['actors'])]).toBe('');
  });
});
