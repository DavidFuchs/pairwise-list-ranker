import { describe, expect, it } from 'vitest';

import { parseWorkspaceSnapshot, WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';

const NOW = '2026-08-16T00:00:00.000Z';

const movies = {
  id: 'movies-1',
  arrayPath: ['movies'],
  roles: { labelField: 'title' },
  alreadyRanked: false,
  configuredExplicitly: true,
  items: [
    {
      id: 'item-1',
      listId: 'movies-1',
      value: { title: 'Alien' },
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  comparisonEvents: [],
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
    listDefaults: { roles: { labelField: 'title' }, alreadyRanked: false },
    lists: { movies },
    createdAt: NOW,
    updatedAt: NOW,
  },
  ui: { previewTab: 'ranked' },
};

describe('parseWorkspaceSnapshot', () => {
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
      workspace: { ...valid.workspace, listDefaults: { roles: { labelField: 'name' }, alreadyRanked: true } },
    };

    expect(parseWorkspaceSnapshot(withDefaults)?.workspace.listDefaults).toEqual({
      roles: { labelField: 'name' },
      alreadyRanked: true,
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
