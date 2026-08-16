import { describe, expect, it } from 'vitest';

import { WORKSPACE_STORAGE_KEY, createWorkspaceStorage } from '@/lib/persistence/browserStorage';
import type { StorageLike } from '@/lib/persistence/browserStorage';
import type { WorkspaceSnapshot } from '@/types/workspace';
import { WORKSPACE_VERSION } from '@/types/workspace';

const NOW = '2026-08-15T12:00:00.000Z';

const snapshot: WorkspaceSnapshot = {
  version: WORKSPACE_VERSION,
  list: {
    id: 'list-1',
    title: 'Weeknight dinners',
    kind: 'primitive',
    createdAt: NOW,
    updatedAt: NOW,
  },
  items: [
    { id: 'item-1', listId: 'list-1', value: 'Tacos', active: true, createdAt: NOW, updatedAt: NOW },
  ],
  comparisonEvents: [],
  ui: { previewMode: 'gui', editorDrafts: {} },
};

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('storage is blocked');
    },
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {
      throw new Error('storage is blocked');
    },
  };
}

describe('createWorkspaceStorage', () => {
  it('round-trips a snapshot', () => {
    const storage = createWorkspaceStorage(memoryStorage());

    storage.save(snapshot);

    expect(storage.load()).toEqual(snapshot);
  });

  it('reports that persistence is available when a backend works', () => {
    expect(createWorkspaceStorage(memoryStorage()).available).toBe(true);
  });

  it('returns nothing when no workspace has been saved', () => {
    expect(createWorkspaceStorage(memoryStorage()).load()).toBeNull();
  });

  it('clears the saved workspace', () => {
    const backend = memoryStorage();
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot);

    storage.clear();

    expect(storage.load()).toBeNull();
    expect(backend.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('ignores malformed saved data instead of throwing', () => {
    const storage = createWorkspaceStorage(memoryStorage({ [WORKSPACE_STORAGE_KEY]: '{not json' }));

    expect(storage.load()).toBeNull();
  });

  it('ignores a saved workspace that fails its shape check', () => {
    const storage = createWorkspaceStorage(
      memoryStorage({ [WORKSPACE_STORAGE_KEY]: '{"version":1,"items":"nope"}' }),
    );

    expect(storage.load()).toBeNull();
  });

  it('ignores a workspace saved by a newer app version', () => {
    const future = JSON.stringify({ ...snapshot, version: WORKSPACE_VERSION + 1 });
    const storage = createWorkspaceStorage(memoryStorage({ [WORKSPACE_STORAGE_KEY]: future }));

    expect(storage.load()).toBeNull();
  });

  it('reports persistence as unavailable when there is no backend', () => {
    const storage = createWorkspaceStorage(null);

    expect(storage.available).toBe(false);
    expect(storage.load()).toBeNull();
  });

  it('stays usable when the backend throws on write', () => {
    const storage = createWorkspaceStorage(throwingStorage());

    expect(() => storage.save(snapshot)).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
    expect(storage.load()).toBeNull();
  });
});
