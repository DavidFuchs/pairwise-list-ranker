import { compactSnapshot, parseWorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';

export const WORKSPACE_STORAGE_KEY = 'pairwise-list-ranker:workspace:v2';

/** Keys from shapes we can no longer read. Deleted on first load. */
export const LEGACY_STORAGE_KEYS = ['pairwise-list-ranker:workspace:v1'] as const;

/**
 * Below the usual 5MB localStorage budget, with room for the browser's own
 * overhead. The document is stored once, with items pointing into it, so this
 * is roughly the size of the imported data plus the comparison history.
 */
export const MAX_SNAPSHOT_BYTES = 4_000_000;

const PROBE_KEY = 'pairwise-list-ranker:probe';

/** The slice of the Web Storage API we depend on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveOutcome = 'saved' | 'too-large' | 'unavailable';

export interface WorkspaceStorage {
  /** False in private modes, SSR/static rendering, or when storage is blocked. */
  readonly available: boolean;
  load(): WorkspaceSnapshot | null;
  save(snapshot: WorkspaceSnapshot): SaveOutcome;
  clear(): void;
}

/** localStorage when the browser allows it, otherwise null (memory-only mode). */
export function defaultBackend(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Some browsers throw on property access when storage is disabled.
    return null;
  }
}

export function createWorkspaceStorage(backend: StorageLike | null = defaultBackend()): WorkspaceStorage {
  const available = backend !== null && probe(backend);

  return {
    available,

    load() {
      if (!available || backend === null) return null;

      for (const key of LEGACY_STORAGE_KEYS) {
        try {
          backend.removeItem(key);
        } catch {
          // Nothing to do; the legacy key is unreadable anyway.
        }
      }

      try {
        const raw = backend.getItem(WORKSPACE_STORAGE_KEY);
        if (raw === null) return null;
        return parseWorkspaceSnapshot(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    save(snapshot: WorkspaceSnapshot) {
      if (!available || backend === null) return 'unavailable';

      const serialized = JSON.stringify(compactSnapshot(snapshot));
      // Checking first keeps a previous good save intact rather than letting a
      // quota error replace it with nothing.
      if (serialized.length > MAX_SNAPSHOT_BYTES) return 'too-large';

      try {
        backend.setItem(WORKSPACE_STORAGE_KEY, serialized);
        return 'saved';
      } catch {
        // Out of quota or storage revoked mid-session: keep working in memory.
        return 'too-large';
      }
    },

    clear() {
      if (!available || backend === null) return;
      try {
        backend.removeItem(WORKSPACE_STORAGE_KEY);
      } catch {
        // The in-memory workspace is still authoritative.
      }
    },
  };
}

function probe(backend: StorageLike): boolean {
  try {
    backend.setItem(PROBE_KEY, '1');
    backend.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
