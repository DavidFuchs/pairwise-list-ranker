/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RankScreen from '@/app/rank';
import { WORKSPACE_STORAGE_KEY } from '@/lib/persistence/workspaceStorage';
import { listStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

const dinners: DataSource = {
  format: 'list',
  rawText: 'Tacos\nRamen\nCurry\n',
  document: ['Tacos', 'Ramen', 'Curry'],
  arrayPath: [],
};

function startRanking() {
  listStore.getState().startRanking({ source: dinners, roles: {} });
}

/**
 * A reload keeps whatever localStorage holds but starts with empty memory,
 * which is what makes hydration observable.
 */
function simulateReload() {
  listStore.setState({
    workspace: null,
    items: [],
    comparisonEvents: [],
    previewTab: 'ranked',
    hydrated: false,
    resumed: false,
  });
}

describe('local persistence', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('restores the list after a reload', () => {
    startRanking();
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().items.map((item) => item.value)).toEqual([
      'Tacos',
      'Ramen',
      'Curry',
    ]);
    // Lists have no name to restore; the ranked rows are the proof.
    expect(screen.getAllByRole('listitem').length).toBe(3);
  });

  it('restores the source document, so exports still work after a reload', () => {
    startRanking();
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().workspace?.source.document).toEqual(['Tacos', 'Ramen', 'Curry']);
  });

  it('restores the ranking, not just the items', () => {
    startRanking();
    const pair = listStore.getState().currentPair()!;
    listStore.getState().recordComparison(pair.left.id, pair.right.id, 'left_strong');
    const expected = listStore.getState().ranking()[0]?.item.id;
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().comparisonEvents).toHaveLength(1);
    expect(listStore.getState().ranking()[0]?.item.id).toBe(expected);
  });

  it('keeps the chosen preview tab across a reload', () => {
    startRanking();
    listStore.getState().setPreviewTab('json');
    simulateReload();

    render(<RankScreen />);

    expect(screen.getByRole('tab', { name: /json/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('starts clean when the saved workspace is corrupt', () => {
    globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{"half a snapshot"');
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().workspace).toBeNull();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('starts clean when the saved workspace came from a newer version', () => {
    globalThis.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ version: 99, workspace: {}, items: [], comparisonEvents: [], ui: {} }),
    );
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().workspace).toBeNull();
  });

  it('drops a version 1 snapshot, which has no source document to export', () => {
    globalThis.localStorage.setItem(
      'pairwise-list-ranker:workspace:v1',
      JSON.stringify({
        version: 1,
        list: { id: 'l', title: 'Old', kind: 'primitive', createdAt: '', updatedAt: '' },
        items: [],
        comparisonEvents: [],
        ui: { previewMode: 'gui', editorDrafts: {} },
      }),
    );
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().workspace).toBeNull();
    expect(globalThis.localStorage.getItem('pairwise-list-ranker:workspace:v1')).toBeNull();
  });

  it('clears both the workspace and its saved copy', () => {
    startRanking();

    listStore.getState().reset();

    expect(listStore.getState().workspace).toBeNull();
    expect(globalThis.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('does not restore a workspace that was cleared', () => {
    startRanking();
    listStore.getState().reset();
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().workspace).toBeNull();
  });

  it('tells the user their work is kept in this browser', () => {
    startRanking();

    render(<RankScreen />);

    expect(screen.getByText(/saved in this browser/i)).toBeDefined();
  });
});
