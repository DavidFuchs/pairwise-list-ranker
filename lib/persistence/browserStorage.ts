import { parseWorkspaceSnapshot } from '@/lib/validation/workspaceSchema';
import type { WorkspaceSnapshot } from '@/types/workspace';

export const WORKSPACE_STORAGE_KEY = 'pairwise-list-ranker:workspace:v1';

const PROBE_KEY = 'pairwise-list-ranker:probe';

/** The slice of the Web Storage API we depend on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WorkspaceStorage {
  /** False in private modes, SSR/static rendering, or when storage is blocked. */
  readonly available: boolean;
  load(): WorkspaceSnapshot | null;
  save(snapshot: WorkspaceSnapshot): void;
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

export function createWorkspaceStorage(
  backend: StorageLike | null = defaultBackend(),
): WorkspaceStorage {
  const available = backend !== null && probe(backend);

  return {
    available,

    load() {
      if (!available || backend === null) return null;
      try {
        const raw = backend.getItem(WORKSPACE_STORAGE_KEY);
        if (raw === null) return null;
        return parseWorkspaceSnapshot(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    save(snapshot: WorkspaceSnapshot) {
      if (!available || backend === null) return;
      try {
        backend.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Out of quota or storage was revoked mid-session: keep working in memory.
      }
    },

    clear() {
      if (!available || backend === null) return;
      try {
        backend.removeItem(WORKSPACE_STORAGE_KEY);
      } catch {
        // Nothing else to do; the in-memory workspace is still authoritative.
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
