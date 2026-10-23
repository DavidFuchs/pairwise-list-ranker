import { defaultBackend, storedKeys, type StorageLike } from '@/lib/persistence/workspaceStorage';

/**
 * Sealed engine snapshots by list id (docs/ARCHITECTURE.md 6.5 item 8). A disposable cache,
 * apart from the workspace save and never in a session file: losing an entry
 * only makes the next open a cold build.
 */
export interface EngineCache {
  load(listId: string): string | null;
  /** False when the entry could not be written, such as with a full quota. */
  save(listId: string, sealed: string): boolean;
  /** Drops every entry but those of the named lists, such as lists no longer in the workspace. */
  prune(keepListIds: string[]): void;
  clear(): void;
}

const KEY_PREFIX = 'pairwise-list-ranker:engine:';

/**
 * The cache on `backend`, localStorage by default. Every storage error, a full
 * quota included, is swallowed: the cache is a speed-up, never a reason to fail.
 */
export function createEngineCache(backend: StorageLike | null = defaultBackend()): EngineCache {
  /** Lists saved by this cache, for a backend that cannot list its keys. */
  const saved = new Set<string>();

  function cachedListIds(store: StorageLike): string[] {
    const keys = storedKeys(store, KEY_PREFIX);
    return keys === null ? [...saved] : keys.map((key) => key.slice(KEY_PREFIX.length));
  }

  function remove(store: StorageLike, listIds: string[]): void {
    for (const listId of listIds) {
      saved.delete(listId);
      try {
        store.removeItem(KEY_PREFIX + listId);
      } catch {
        // A stale entry left behind is still checked before it is used.
      }
    }
  }

  return {
    load(listId) {
      if (backend === null) return null;
      try {
        return backend.getItem(KEY_PREFIX + listId);
      } catch {
        return null;
      }
    },

    save(listId, sealed) {
      if (backend === null) return false;
      try {
        backend.setItem(KEY_PREFIX + listId, sealed);
        saved.add(listId);
        return true;
      } catch {
        // A full quota keeps the older entry, which still opens for a prefix of the history.
        return false;
      }
    },

    prune(keepListIds) {
      if (backend === null) return;
      const keep = new Set(keepListIds);
      try {
        remove(
          backend,
          cachedListIds(backend).filter((listId) => !keep.has(listId)),
        );
      } catch {
        // Enumeration failed; the entries stay until a later prune.
      }
    },

    clear() {
      if (backend === null) return;
      try {
        remove(backend, cachedListIds(backend));
      } catch {
        // As in prune.
      }
    },
  };
}
