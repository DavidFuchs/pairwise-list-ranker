/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import RankScreen from '@/app/rank';
import { engineHost } from '@/lib/engine/engineHost';
import { toEngineList } from '@/lib/engine/engineList';
import { WORKSPACE_STORAGE_KEY } from '@/lib/persistence/workspaceStorage';
import { replay } from '@/lib/ranking/bt/engine';
import { listStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';
import { openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
  const { engineHostModule } = await import('@/tests/helpers/engineHost');
  return engineHostModule(await importOriginal());
});

const dinners: DataSource = {
  format: 'list',
  document: ['Tacos', 'Ramen', 'Curry'],
  arrayPath: [],
};

function startRanking() {
  listStore.getState().startRanking({ source: dinners, roles: {} });
}

/**
 * A reload keeps whatever localStorage holds but starts with empty memory,
 * which is what makes hydration observable: the engine host forgets its
 * session too. The page flushes a pending save as it goes away, so the helper
 * does too.
 */
function simulateReload() {
  listStore.getState().flush();
  engineHost.reset();
  listStore.setState({
    workspace: null,
    previewTab: 'ranked',
    hydrated: false,
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

    expect(openList(listStore).items.map((item) => item.value)).toEqual(['Tacos', 'Ramen', 'Curry']);
    // Lists have no name to restore; the ranked rows are the proof.
    expect(screen.getAllByRole('listitem').length).toBe(3);
  });

  it('restores the source document, so exports still work after a reload', () => {
    startRanking();
    simulateReload();

    render(<RankScreen />);

    expect(listStore.getState().workspace?.source.document).toEqual(['Tacos', 'Ramen', 'Curry']);
  });

  it('restores the ranking, not just the items', async () => {
    startRanking();
    const view = engineHost.view();
    if (view?.status !== 'ready' || view.nextPair === null) throw new Error('Expected a pair to answer.');
    const [left, right] = view.nextPair;
    listStore.getState().recordComparison(left.id, right.id, 'right_strong');
    const before = (engineHost.view() as Extract<typeof view, { status: 'ready' }>).ranked.map(
      (item) => item.value,
    );
    expect(before[0]).toBe(right.value);
    simulateReload();

    render(<RankScreen />);

    // A reload is a cold open: restoring first, then the same order as before.
    expect(screen.getAllByText('Restoring your ranking…').length).toBeGreaterThan(0);
    expect(await screen.findByText('3 items · 1 answer so far')).toBeDefined();
    expect(openList(listStore).events).toHaveLength(1);
    const rows = screen.getAllByRole('listitem').map((row) => row.textContent);
    expect(rows).toEqual(before.map((value, index) => `⠿${index + 1}${String(value)}`));
    const restored = engineHost.view();
    expect(restored?.status === 'ready' && restored.ranked.map((item) => item.id)).toEqual(
      replay(toEngineList(openList(listStore))).ranked,
    );
  });

  it('keeps the chosen preview tab across a reload', () => {
    startRanking();
    listStore.getState().setPreviewTab('json');
    simulateReload();

    render(<RankScreen />);

    expect(screen.getByRole('tab', { name: /json/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('resumes a saved list into ranking when the site opens on the paste page', () => {
    startRanking();
    simulateReload();

    render(<DataScreen />);

    expect(replace).toHaveBeenCalledWith('/rank');
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

  it('says nothing about saving while saving works', () => {
    startRanking();

    render(<RankScreen />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('saves the engine snapshot as the page goes away', () => {
    startRanking();
    const flushed = vi.spyOn(engineHost, 'flushCache');

    window.dispatchEvent(new Event('pagehide'));

    expect(flushed).toHaveBeenCalledTimes(1);
    flushed.mockRestore();
  });

  it('warns when the list is too large for the browser to keep', () => {
    startRanking();
    render(<RankScreen />);

    act(() => listStore.setState({ saveOutcome: 'too-large' }));

    expect(screen.getByRole('status').textContent).toMatch(/too large to save in this browser/i);
  });
});
