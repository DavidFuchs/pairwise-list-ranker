import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import {
  LEGACY_STORAGE_KEYS,
  MAX_SNAPSHOT_BYTES,
  WORKSPACE_STORAGE_KEY,
  createWorkspaceStorage,
} from '@/lib/persistence/workspaceStorage';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';

function memoryBackend(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function snapshot(rawText = 'Alien\nArrival\n'): WorkspaceSnapshot {
  return {
    version: 3,
    workspace: {
      id: 'ws-1',
      source: { format: 'list', rawText, document: ['Alien', 'Arrival'], arrayPath: [] },
      roles: {},
      alreadyRanked: false,
      listDefaults: { roles: {}, alreadyRanked: false },
      configuredExplicitly: true,
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    },
    items: [],
    comparisonEvents: [],
    savedLists: [],
    ui: { previewTab: 'ranked' },
  };
}

describe('createWorkspaceStorage', () => {
  let backend: ReturnType<typeof memoryBackend>;

  beforeEach(() => {
    backend = memoryBackend();
  });

  it('round-trips a snapshot', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());

    expect(storage.load()?.workspace.source.document).toEqual(['Alien', 'Arrival']);
  });

  it('reports that it saved', () => {
    expect(createWorkspaceStorage(backend).save(snapshot())).toBe('saved');
  });

  it('is unavailable with no backend', () => {
    const storage = createWorkspaceStorage(null);

    expect(storage.available).toBe(false);
    expect(storage.save(snapshot())).toBe('unavailable');
    expect(storage.load()).toBeNull();
  });

  it('skips snapshots too large for storage, without throwing', () => {
    const storage = createWorkspaceStorage(backend);

    expect(storage.save(snapshot('x'.repeat(MAX_SNAPSHOT_BYTES)))).toBe('too-large');
    expect(backend.data.has(WORKSPACE_STORAGE_KEY)).toBe(false);
  });

  it('keeps an earlier good save when a later one is too large', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());
    storage.save(snapshot('x'.repeat(MAX_SNAPSHOT_BYTES)));

    expect(storage.load()?.workspace.source.document).toEqual(['Alien', 'Arrival']);
  });

  it('reports itself unavailable when the backend rejects every write', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: () => {},
    };

    expect(createWorkspaceStorage(failing).available).toBe(false);
  });

  it('returns null for malformed stored text', () => {
    backend.data.set(WORKSPACE_STORAGE_KEY, '{not json');

    expect(createWorkspaceStorage(backend).load()).toBeNull();
  });

  it('drops a v1 snapshot and deletes its key', () => {
    const legacyKey = LEGACY_STORAGE_KEYS[0] ?? '';
    backend.data.set(legacyKey, JSON.stringify({ version: 1 }));
    const storage = createWorkspaceStorage(backend);

    expect(storage.load()).toBeNull();
    expect(backend.data.has(legacyKey)).toBe(false);
  });

  it('clears the saved snapshot', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());
    storage.clear();

    expect(storage.load()).toBeNull();
  });
});
