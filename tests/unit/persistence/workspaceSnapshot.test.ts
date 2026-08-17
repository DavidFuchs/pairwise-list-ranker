import { describe, expect, it } from 'vitest';

import { parseWorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';

const valid = {
  version: 2,
  workspace: {
    id: 'ws-1',
    source: {
      format: 'yaml',
      rawText: 'movies:\n  - title: Alien\n',
      document: { movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
      arrayPath: ['movies'],
    },
    roles: { labelField: 'title' },
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  },
  items: [
    {
      id: 'item-1',
      listId: 'ws-1',
      value: { title: 'Alien' },
      active: true,
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    },
  ],
  comparisonEvents: [],
  ui: { previewTab: 'ranked' },
};

describe('parseWorkspaceSnapshot', () => {
  it('accepts a well-formed v2 snapshot', () => {
    expect(parseWorkspaceSnapshot(valid)?.workspace.id).toBe('ws-1');
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

  it('rejects a v1 snapshot, which has no source document', () => {
    const v1 = {
      version: 1,
      list: { id: 'l', title: 't', kind: 'primitive', createdAt: '', updatedAt: '' },
      items: [],
      comparisonEvents: [],
      ui: { previewMode: 'gui', editorDrafts: {} },
    };

    expect(parseWorkspaceSnapshot(v1)).toBeNull();
  });

  it('rejects a snapshot from a newer version', () => {
    expect(parseWorkspaceSnapshot({ ...valid, version: 99 })).toBeNull();
  });

  it('rejects a snapshot missing the array path', () => {
    const broken = {
      ...valid,
      workspace: {
        ...valid.workspace,
        source: { ...valid.workspace.source, arrayPath: undefined },
      },
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
