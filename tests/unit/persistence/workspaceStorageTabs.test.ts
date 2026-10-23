import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { WORKSPACE_STORAGE_KEY, createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { answered, enumerableBackend, ranked } from '@/tests/helpers/storedWorkspaces';
import type { Backend } from '@/tests/helpers/storedWorkspaces';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** One tab's view of a backend shared with other tabs, with hooks to run another tab's work mid-save. */
function tab(
  backend: Backend,
  hooks: {
    afterGet?: (key: string) => void;
    beforeSet?: (key: string) => void;
    removeFails?: boolean;
    getFails?: boolean;
  } = {},
) {
  return {
    get length() {
      return backend.length;
    },
    key: backend.key,
    getItem: (key: string) => {
      if (hooks.getFails) throw new Error('SecurityError');
      const value = backend.getItem(key);
      hooks.afterGet?.(key);
      return value;
    },
    setItem: (key: string, value: string) => {
      hooks.beforeSet?.(key);
      backend.setItem(key, value);
    },
    removeItem: (key: string) => {
      if (hooks.removeFails) throw new Error('SecurityError');
      backend.removeItem(key);
    },
  };
}

const onceOnly = (run: () => void) => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    run();
  };
};

function loaded(backend: Backend): WorkspaceSnapshot | null {
  return createWorkspaceStorage(backend).load();
}

describe('two tabs on one workspace', () => {
  it('rewrites everything when the other tab committed after this save read the manifest', () => {
    const backend = enumerableBackend();
    const base = ranked(600);
    const a = createWorkspaceStorage(backend);
    a.save(base);
    const seen = onceOnly(() => a.save(answered(base)));
    let armed = false;
    const b = createWorkspaceStorage(
      tab(backend, { afterGet: (key) => key === WORKSPACE_STORAGE_KEY && armed && seen() }),
    );
    const held = b.load()!;
    armed = true;

    // Only the preview tab changes, so this save would keep every piece, including the last run of
    // the history that the other tab's answer replaces.
    const mine: WorkspaceSnapshot = { ...held, ui: { previewTab: 'json' } };
    expect(b.save(mine)).toBe('saved');

    expect(loaded(backend)).toEqual(mine);
  });

  it('keeps the pieces a save names when the other tab commits between its check and its commit', () => {
    const backend = enumerableBackend();
    const base = ranked(600);
    const a = createWorkspaceStorage(backend);
    a.save(base);
    const commit = onceOnly(() => a.save(answered(base)));
    const b = createWorkspaceStorage(
      tab(backend, { beforeSet: (key) => key === WORKSPACE_STORAGE_KEY && commit() }),
    );
    const held = b.load()!;

    const mine: WorkspaceSnapshot = { ...held, ui: { previewTab: 'json' } };
    expect(b.save(mine)).toBe('saved');
    // The other tab's save has replaced the last run of the history and, if it had removed the old
    // one at once, this manifest would name a piece that is gone.
    expect(loaded(backend)).toEqual(mine);

    // Later saves by either tab, past the grace, heal or keep it loadable; they never leave it broken.
    vi.advanceTimersByTime(30_000);
    a.save(answered(answered(base)));
    expect(loaded(backend)).toEqual(answered(answered(base)));
    b.save(mine);
    expect(loaded(backend)).toEqual(mine);
  });

  it('rewrites everything when a piece the save would keep has gone missing', () => {
    const backend = enumerableBackend();
    const base = ranked(600);
    const a = createWorkspaceStorage(backend);
    a.save(base);
    const pieceKeys = Array.from({ length: backend.length }, (_, i) => backend.key(i)!).filter(
      (key) => key !== WORKSPACE_STORAGE_KEY && key.startsWith(`${WORKSPACE_STORAGE_KEY}:`),
    );
    backend.removeItem(pieceKeys[0]!);

    const mine: WorkspaceSnapshot = { ...base, ui: { previewTab: 'json' } };
    expect(a.save(mine)).toBe('saved');
    expect(loaded(backend)).toEqual(mine);
  });

  it('reads the new manifest when a piece goes missing because the other tab committed mid-load', () => {
    const backend = enumerableBackend();
    const base = ranked(600);
    createWorkspaceStorage(backend).save(base);
    const before = new Set(backend.data.keys());
    const next = answered(base);
    const swap = onceOnly(() => {
      const other = createWorkspaceStorage(backend);
      other.save(next);
      // The other tab has long since removed what it replaced.
      const current = backend.getItem(WORKSPACE_STORAGE_KEY)!;
      for (const key of before)
        if (key !== WORKSPACE_STORAGE_KEY && !current.includes(key)) backend.removeItem(key);
    });
    // After the document piece is read: the next pieces of the old manifest are gone.
    const c = createWorkspaceStorage(
      tab(backend, { afterGet: (key) => key !== WORKSPACE_STORAGE_KEY && swap() }),
    );

    expect(c.load()).toEqual(next);
  });

  it('refuses a workspace whose piece is gone for good, after looking again', () => {
    const backend = enumerableBackend();
    createWorkspaceStorage(backend).save(ranked(600));
    const piece = [...backend.data.keys()].find((key) => key !== WORKSPACE_STORAGE_KEY)!;
    backend.data.delete(piece);

    expect(loaded(backend)).toBeNull();
  });

  it('removes what a save replaced only after a grace, and never what the manifest names', () => {
    const backend = enumerableBackend();
    const storage = createWorkspaceStorage(backend);
    const base = ranked(600);
    storage.save(base);
    const keysBefore = new Set(backend.data.keys());

    const next = answered(base);
    storage.save(next);
    const replaced = [...keysBefore].filter(
      (key) => key !== WORKSPACE_STORAGE_KEY && !backend.getItem(WORKSPACE_STORAGE_KEY)!.includes(key),
    );
    expect(replaced.length).toBeGreaterThan(0);
    for (const key of replaced) expect(backend.data.has(key), 'kept for now').toBe(true);

    vi.advanceTimersByTime(30_000);
    storage.save(answered(next));
    for (const key of replaced) expect(backend.data.has(key), 'removed after the grace').toBe(false);
    expect(loaded(backend)).toEqual(answered(next));
  });

  it('does not grow without bound over many saves, as long as time passes between them', () => {
    const backend = enumerableBackend();
    const storage = createWorkspaceStorage(backend);
    let snapshot = ranked(700);
    storage.save(snapshot);
    const keys = backend.data.size;
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersByTime(2_000);
      snapshot = answered(snapshot);
      storage.save(snapshot);
    }

    // The pieces replaced in the last grace (a few answers' worth) are still there, and no more.
    expect(backend.data.size).toBeLessThan(keys + 12);
    expect(loaded(backend)).toEqual(snapshot);
  });
});

/** A backend with a capacity across every key, as localStorage has. */
function limited(limit: number) {
  const backend = enumerableBackend();
  const used = (except?: string) =>
    [...backend.data].reduce((total, [key, value]) => (key === except ? total : total + value.length), 0);
  const setItem = (key: string, value: string) => {
    if (used(key) + value.length > limit) throw new Error('QuotaExceededError');
    backend.data.set(key, value);
  };
  return Object.assign(backend, { setItem, used: () => used() });
}

describe('a workspace that fits only once the old one is gone', () => {
  it('replaces a whole document when old and new together do not fit but the new alone does', () => {
    const first = ranked(600, 8);
    const second = ranked(600, 40);
    const sizer = limited(Number.POSITIVE_INFINITY);
    createWorkspaceStorage(sizer).save(first);
    const firstSize = sizer.used();
    const secondSizer = limited(Number.POSITIVE_INFINITY);
    createWorkspaceStorage(secondSizer).save(second);
    const secondSize = secondSizer.used();
    // Room for either, and for the first with a little to spare, but not for both at once.
    const backend = limited(Math.max(firstSize, secondSize) + 5_000);
    expect(firstSize + secondSize).toBeGreaterThan(backend.used() + 1);
    const storage = createWorkspaceStorage(backend);
    expect(storage.save(first)).toBe('saved');

    expect(storage.save(second)).toBe('saved');

    expect(loaded(backend)).toEqual(second);
    // Nothing of the first is left once the second is committed.
    expect(backend.used()).toBeLessThanOrEqual(secondSize + 5_000);
  });

  it('keeps the previous save when the new one does not fit even alone', () => {
    const first = ranked(600, 8);
    const second = ranked(3000, 60);
    const sizer = limited(Number.POSITIVE_INFINITY);
    createWorkspaceStorage(sizer).save(first);
    const backend = limited(sizer.used() + 5_000);
    const storage = createWorkspaceStorage(backend);
    storage.save(first);

    expect(storage.save(second)).toBe('too-large');

    expect(loaded(backend)).toEqual(first);
    // And the tab can still save what fits.
    expect(storage.save(answered(first))).toBe('saved');
    expect(loaded(backend)).toEqual(answered(first));
  });

  it('frees the pieces it kept for a grace when an answer has no room, before touching the live save', () => {
    const base = ranked(2000);
    const sizer = limited(Number.POSITIVE_INFINITY);
    createWorkspaceStorage(sizer).save(base);
    const backend = limited(sizer.used() + 100_000);
    const storage = createWorkspaceStorage(backend);
    storage.save(base);
    let snapshot = base;
    // Each answer leaves a replaced piece (about 30 KB) for the grace; the room runs out after three.
    for (let i = 0; i < 30; i++) {
      snapshot = answered(snapshot);
      expect(storage.save(snapshot), `answer ${i}`).toBe('saved');
    }

    expect(loaded(backend)).toEqual(snapshot);
  });
});

describe('storage that fails', () => {
  it('reports a save as not made, without throwing, when reading the manifest throws', () => {
    const backend = enumerableBackend();
    createWorkspaceStorage(backend).save(ranked(10));
    const reader = createWorkspaceStorage(tab(backend, { getFails: true }));

    expect(reader.save(ranked(11))).toBe('too-large');
    expect(reader.load()).toBeNull();
    expect(loaded(backend)).toEqual(ranked(10));
  });

  it('saves and loads whether or not the old pieces can be removed', () => {
    const backend = enumerableBackend();
    const hooks = { removeFails: false };
    const stubborn = createWorkspaceStorage(tab(backend, hooks));
    stubborn.save(ranked(600));
    hooks.removeFails = true;
    const mine = answered(ranked(600));

    expect(stubborn.save(mine)).toBe('saved');
    vi.advanceTimersByTime(30_000);
    expect(stubborn.save(answered(mine))).toBe('saved');

    expect(loaded(backend)).toEqual(answered(mine));
  });
});
