/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSyncBuilder } from '@/lib/engine/coldBuild';
import { createEngineCache } from '@/lib/engine/engineCache';
import { createEngineHost } from '@/lib/engine/engineHost';
import { WORKSPACE_STORAGE_KEY, createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { createListStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';
import { openList } from '@/tests/helpers/lists';

const dinners: DataSource = {
  format: 'list',
  document: ['Tacos', 'Ramen', 'Curry'],
  arrayPath: [],
};

let ids = 0;

/** One browser tab: its own store over the browser's one localStorage. */
function openTab() {
  const store = createListStore({
    storage: createWorkspaceStorage(window.localStorage),
    createId: () => `id-${(ids += 1)}`,
    host: createEngineHost({ builder: createSyncBuilder(), cache: createEngineCache(null) }),
  });
  store.getState().hydrate();
  return store;
}

/** What the browser does for the other tabs when one writes: jsdom only has the one window. */
function announceSave() {
  window.dispatchEvent(
    new StorageEvent('storage', { key: WORKSPACE_STORAGE_KEY, storageArea: window.localStorage }),
  );
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function answerFirstPair(store: ReturnType<typeof openTab>) {
  const [left, right] = openList(store).items;
  store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
}

describe('a save from another tab', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setVisibility('visible');
  });

  afterEach(() => {
    setVisibility('visible');
  });

  /** A saved list, open in a tab of its own, and a second tab that has loaded it. */
  function twoTabs() {
    const first = openTab();
    first.getState().startRanking({ source: dinners, roles: {} });
    const second = openTab();
    return { first, second };
  }

  it('leaves a tab in front waiting for an answer, with its screen untouched', () => {
    const { first, second } = twoTabs();
    answerFirstPair(first);

    announceSave();

    expect(second.getState().externalChange).toBe('waiting');
    expect(openList(second).events).toHaveLength(0);
  });

  it('is taken on Reload', () => {
    const { first, second } = twoTabs();
    answerFirstPair(first);
    announceSave();

    second.getState().reloadFromStorage();

    expect(openList(second).events).toHaveLength(1);
    expect(second.getState().externalChange).toBe('none');
  });

  it('is overwritten when the user keeps this tab', () => {
    const { first, second } = twoTabs();
    answerFirstPair(first);
    announceSave();

    second.getState().keepThisTab();

    expect(second.getState().externalChange).toBe('none');
    const reopened = openTab();
    expect(openList(reopened).events).toHaveLength(0);
  });

  it('refreshes a hidden tab when it is shown again', () => {
    const { first, second } = twoTabs();
    setVisibility('hidden');
    answerFirstPair(first);
    announceSave();

    expect(second.getState().externalChange).toBe('none');
    expect(openList(second).events).toHaveLength(0);

    setVisibility('visible');

    expect(openList(second).events).toHaveLength(1);
    expect(second.getState().externalChange).toBe('refreshed');
  });

  it('is ignored by a tab that has not loaded the workspace yet', () => {
    const first = openTab();
    first.getState().startRanking({ source: dinners, roles: {} });
    const unloaded = createListStore({
      storage: createWorkspaceStorage(window.localStorage),
      host: createEngineHost({ builder: createSyncBuilder(), cache: createEngineCache(null) }),
    });

    announceSave();

    expect(unloaded.getState().externalChange).toBe('none');
  });

  it('keeps what a tab holds when the saved copy cannot be read', () => {
    const { second } = twoTabs();
    announceSave();
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{ not a manifest');

    second.getState().reloadFromStorage();

    expect(openList(second).items).toHaveLength(3);
  });

  it('is not raised by an unrelated key', () => {
    const { second } = twoTabs();

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'pairwise-list-ranker:theme', storageArea: window.localStorage }),
    );

    expect(second.getState().externalChange).toBe('none');
  });
});
