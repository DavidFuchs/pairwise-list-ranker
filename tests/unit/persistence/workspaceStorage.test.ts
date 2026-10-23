import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import {
  LEGACY_STORAGE_KEYS,
  MAX_SNAPSHOT_BYTES,
  WORKSPACE_STORAGE_KEY,
  createWorkspaceStorage,
} from '@/lib/persistence/workspaceStorage';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { enumerableBackend, ranked } from '@/tests/helpers/storedWorkspaces';

function memoryBackend(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** A one-list session whose document holds `text`, so a test can make it as large as it needs. */
function snapshot(text = 'Alien'): WorkspaceSnapshot {
  const at = '2026-08-16T00:00:00.000Z';
  return {
    version: WORKSPACE_VERSION,
    workspace: {
      source: { format: 'list', document: [text, 'Arrival'], arrayPath: [] },
      listDefaults: { roles: {}, startingOrder: 'unordered' },
      lists: {
        '': {
          id: 'list-1',
          arrayPath: [],
          roles: {},
          initialStartingOrder: 'unordered',
          configuredExplicitly: true,
          originalItemIds: [],
          items: [],
          events: [],
          createdAt: at,
          updatedAt: at,
        },
      },
      createdAt: at,
      updatedAt: at,
    },
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

  it('a stored history with a group event is refused, and the stored pieces are cleared', () => {
    const stored = enumerableBackend();
    createWorkspaceStorage(stored).save(ranked(3));
    const manifest = JSON.parse(stored.data.get(WORKSPACE_STORAGE_KEY)!);
    const [piece] = manifest.workspace.lists[''].events as { key: string; chars: number; count: number }[];
    const events = JSON.parse(stored.data.get(piece!.key)!) as Record<string, unknown>[];
    // A five-card sort as an earlier version of the app recorded it.
    const { leftItemId: _left, rightItemId: _right, outcome: _outcome, ...rest } = events[1]!;
    events[1] = {
      ...rest,
      kind: 'group',
      presentedItemIds: ['item-0', 'item-1', 'item-2', 'item-3', 'item-4'],
      itemIds: ['item-1', 'item-0', 'item-2', 'item-3', 'item-4'],
    };
    const text = JSON.stringify(events);
    stored.data.set(piece!.key, text);
    piece!.chars = text.length;
    stored.data.set(WORKSPACE_STORAGE_KEY, JSON.stringify(manifest));
    const refused = [...stored.data.keys()];

    vi.useFakeTimers();
    try {
      const storage = createWorkspaceStorage(stored);
      expect(storage.load()).toBeNull();
      // As for any piece that is not what the loader expects: the next save
      // replaces the workspace, and its pieces go once they have had their grace.
      storage.save(ranked(1));
      vi.advanceTimersByTime(60_000);
      storage.save(ranked(2));
    } finally {
      vi.useRealTimers();
    }
    expect(refused.filter((key) => key !== WORKSPACE_STORAGE_KEY && stored.data.has(key))).toEqual([]);
    expect(createWorkspaceStorage(stored).load()).toEqual(ranked(2));
  });

  it('a stored history containing a membership event is refused whole', () => {
    const stored = enumerableBackend();
    createWorkspaceStorage(stored).save(ranked(3));
    const manifest = JSON.parse(stored.data.get(WORKSPACE_STORAGE_KEY)!);
    const [piece] = manifest.workspace.lists[''].events as { key: string; chars: number; count: number }[];
    const events = JSON.parse(stored.data.get(piece!.key)!) as Record<string, unknown>[];
    // A removal as an earlier version of the app recorded it.
    const { leftItemId: _left, rightItemId: _right, outcome: _outcome, ...rest } = events[1]!;
    events[1] = { ...rest, kind: 'membership', added: [], removed: ['item-1'], restored: [] };
    const text = JSON.stringify(events);
    stored.data.set(piece!.key, text);
    piece!.chars = text.length;
    stored.data.set(WORKSPACE_STORAGE_KEY, JSON.stringify(manifest));

    expect(createWorkspaceStorage(stored).load()).toBeNull();
    // The same history with the event as it is recorded now loads.
    events[1] = { ...rest, kind: 'removal', itemIds: ['item-1'] };
    const current = JSON.stringify(events);
    stored.data.set(piece!.key, current);
    piece!.chars = current.length;
    stored.data.set(WORKSPACE_STORAGE_KEY, JSON.stringify(manifest));
    const loaded = createWorkspaceStorage(stored).load();
    expect(loaded?.workspace.lists['']?.events[1]).toEqual(expect.objectContaining({ kind: 'removal' }));
  });

  /**
   * Saves a three-answer workspace, then stores `replace(second event)` in
   * place of its second event, and loads it.
   */
  function loadWithSecondEvent(
    replace: (rest: Record<string, unknown>) => Record<string, unknown>,
  ): ReturnType<ReturnType<typeof createWorkspaceStorage>['load']> {
    const stored = enumerableBackend();
    createWorkspaceStorage(stored).save(ranked(3));
    const manifest = JSON.parse(stored.data.get(WORKSPACE_STORAGE_KEY)!);
    const [piece] = manifest.workspace.lists[''].events as { key: string; chars: number; count: number }[];
    const events = JSON.parse(stored.data.get(piece!.key)!) as Record<string, unknown>[];
    const { leftItemId: _left, rightItemId: _right, outcome: _outcome, ...rest } = events[1]!;
    events[1] = replace(rest);
    const text = JSON.stringify(events);
    stored.data.set(piece!.key, text);
    piece!.chars = text.length;
    stored.data.set(WORKSPACE_STORAGE_KEY, JSON.stringify(manifest));
    return createWorkspaceStorage(stored).load();
  }

  it('a stored history containing a startingOrder event is refused whole', () => {
    // A starting-order change as an earlier version of the app recorded it.
    expect(
      loadWithSecondEvent((rest) => ({ ...rest, kind: 'startingOrder', startingOrder: 'rough' })),
    ).toBeNull();
  });

  it('a stored placement with a targets array is refused whole', () => {
    // A placement as an earlier version of the app recorded it.
    const target = { itemId: 'item-1', aboveItemId: 'item-0' };
    expect(loadWithSecondEvent((rest) => ({ ...rest, kind: 'placement', targets: [target] }))).toBeNull();
    // The same history with the placement as it is recorded now loads.
    const loaded = loadWithSecondEvent((rest) => ({ ...rest, kind: 'placement', ...target }));
    expect(loaded?.workspace.lists['']?.events[1]).toEqual(
      expect.objectContaining({ kind: 'placement', itemId: 'item-1', aboveItemId: 'item-0' }),
    );
  });

  it('clears the saved snapshot', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());
    storage.clear();

    expect(storage.load()).toBeNull();
  });
});

describe('a sorted list in storage', () => {
  it('initialSort survives a save and load', () => {
    const backend = memoryBackend();
    const sort = { field: 'plays', direction: 'asc' as const };
    const base = snapshot();
    const list = base.workspace.lists['']!;
    const sorted: WorkspaceSnapshot = {
      ...base,
      workspace: { ...base.workspace, lists: { '': { ...list, initialSort: sort } } },
    };

    createWorkspaceStorage(backend).save(sorted);

    expect(createWorkspaceStorage(backend).load()?.workspace.lists['']?.initialSort).toEqual(sort);
  });
});
