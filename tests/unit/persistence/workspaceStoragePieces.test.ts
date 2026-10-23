import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import {
  LEGACY_STORAGE_KEYS,
  MAX_SNAPSHOT_BYTES,
  WORKSPACE_STORAGE_KEY,
  createWorkspaceStorage,
} from '@/lib/persistence/workspaceStorage';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { answered, enumerableBackend, ranked, withList } from '@/tests/helpers/storedWorkspaces';
import type { Backend } from '@/tests/helpers/storedWorkspaces';

/** A backend that records what is written, and can be made to fail writes. */
function watched(backend: Backend = enumerableBackend()) {
  const writes: { key: string; chars: number }[] = [];
  let allowed = Number.POSITIVE_INFINITY;
  const watching: StorageLike = {
    getItem: backend.getItem,
    removeItem: backend.removeItem,
    setItem: (key, value) => {
      if (allowed <= 0) throw new Error('QuotaExceededError');
      allowed--;
      writes.push({ key, chars: value.length });
      backend.data.set(key, value);
    },
  };
  return {
    /** The backend as the code under test sees it. */
    backend: watching,
    /** The backend as a later reload sees it, with the writes failing no longer. */
    raw: backend,
    writes,
    written: () => writes.reduce((sum, write) => sum + write.chars, 0),
    stored: () => [...backend.data.values()].reduce((total, value) => total + value.length, 0),
    /** Lets `count` more writes through, then fails every one until healed. */
    failAfter(count: number) {
      allowed = count;
    },
    heal() {
      allowed = Number.POSITIVE_INFINITY;
    },
    forget() {
      writes.length = 0;
    },
  };
}

describe('the pieces a workspace is stored in', () => {
  it('reads back a long history exactly, in order', () => {
    const backend = enumerableBackend();
    const snapshot = ranked(2000);
    createWorkspaceStorage(backend).save(snapshot);

    expect(createWorkspaceStorage(backend).load()).toEqual(snapshot);
  });

  it('writes only the end of the history and the manifest for one more answer', () => {
    const spy = watched();
    const storage = createWorkspaceStorage(spy.backend);
    const before = ranked(2000);
    storage.save(before);
    const total = spy.stored();
    spy.forget();

    const after = answered(before);
    expect(storage.save(after)).toBe('saved');

    expect(spy.writes.length).toBeLessThanOrEqual(2);
    expect(spy.written()).toBeLessThan(total / 5);
    expect(createWorkspaceStorage(spy.raw).load()).toEqual(after);
  });

  it('writes a few thousand characters for an answer on a 10,000-event history, not the whole workspace', () => {
    // The same size as the app benchmark's workspace. There, one answer writes 6,500 characters (the
    // last piece of the history and the manifest) of the 1.64 million the workspace holds.
    const spy = watched();
    const storage = createWorkspaceStorage(spy.backend);
    const before = ranked(10_000);
    storage.save(before);
    const total = spy.stored();
    spy.forget();

    storage.save(answered(before));

    expect(total).toBeGreaterThan(1_000_000);
    expect(spy.written()).toBeLessThan(20_000);
  });

  it('writes as little for an answer after a reload', () => {
    const spy = watched();
    createWorkspaceStorage(spy.backend).save(ranked(2000));
    const storage = createWorkspaceStorage(spy.backend);
    const loaded = storage.load()!;
    spy.forget();

    storage.save(answered(loaded));

    expect(spy.writes.length).toBeLessThanOrEqual(2);
    expect(spy.written()).toBeLessThan(spy.stored() / 5);
  });

  it('does not serialize the document again for a save that leaves it as it was', () => {
    let serialized = 0;
    const document = {
      items: Array.from({ length: 8 }, (_, i) => `Item ${i}`),
      // JSON.stringify calls this, so it counts the times the document is written out.
      toJSON() {
        serialized++;
        return { items: this.items };
      },
    };
    const base = ranked(300);
    const list = { ...base.workspace.lists['']!, arrayPath: ['items'] };
    const snapshot: WorkspaceSnapshot = {
      ...base,
      workspace: {
        ...base.workspace,
        source: { format: 'json', document, arrayPath: ['items'] },
        lists: { items: list },
      },
    };
    const storage = createWorkspaceStorage(enumerableBackend());
    storage.save(snapshot);
    expect(serialized).toBe(1);

    const events = [...list.events, { ...list.events[0]!, id: 'one-more' }];
    storage.save({
      ...snapshot,
      workspace: { ...snapshot.workspace, lists: { items: { ...list, events } } },
    });

    expect(serialized).toBe(1);
  });

  it('keeps a list whose path is a name every object already has', () => {
    for (const name of ['__proto__', 'constructor', 'toString']) {
      const base = ranked(300);
      const list = { ...base.workspace.lists['']!, arrayPath: [name] };
      const document = JSON.parse(`{"${name}": ${JSON.stringify(list.items.map((item) => item.value))}}`);
      const snapshot: WorkspaceSnapshot = {
        ...base,
        workspace: {
          ...base.workspace,
          source: { format: 'json', document, arrayPath: [name] },
          lists: Object.fromEntries([[name, list]]),
        },
      };
      const backend = enumerableBackend();
      createWorkspaceStorage(backend).save(snapshot);

      const loaded = createWorkspaceStorage(backend).load();

      expect(Object.keys(loaded?.workspace.lists ?? {}), name).toEqual([name]);
      expect(Object.getPrototypeOf(loaded?.workspace.lists), name).toBe(Object.prototype);
      expect(Object.values(loaded?.workspace.lists ?? {})[0]?.events, name).toEqual(list.events);
    }
  });

  it('writes nothing for a save that changes nothing', () => {
    const spy = watched();
    const storage = createWorkspaceStorage(spy.backend);
    const snapshot = ranked(300);
    storage.save(snapshot);
    spy.forget();

    expect(storage.save({ ...snapshot })).toBe('saved');

    expect(spy.writes).toEqual([]);
  });

  it('rewrites only the end of the history for an undo, and reads back the shorter one', () => {
    const spy = watched();
    const storage = createWorkspaceStorage(spy.backend);
    const before = ranked(2000);
    storage.save(before);
    spy.forget();

    const undone = withList(before, { events: before.workspace.lists['']!.events.slice(0, -1) });
    storage.save(undone);

    expect(spy.writes.length).toBeLessThanOrEqual(2);
    expect(spy.written()).toBeLessThan(spy.stored() / 5);
    expect(createWorkspaceStorage(spy.raw).load()).toEqual(undone);
  });

  it('does not write the history again when only the items change', () => {
    const spy = watched();
    const storage = createWorkspaceStorage(spy.backend);
    const before = ranked(2000);
    storage.save(before);
    spy.forget();

    const items = before.workspace.lists['']!.items.map((item, i) =>
      i === 3 ? { ...item, updatedAt: 'later' } : item,
    );
    const removed = withList(before, { items });
    storage.save(removed);

    expect(spy.writes.length).toBeLessThanOrEqual(2);
    expect(createWorkspaceStorage(spy.raw).load()).toEqual(removed);
  });

  it('writes the whole workspace again for a new document', () => {
    const spy = watched();
    const storage = createWorkspaceStorage(spy.backend);
    storage.save(ranked(1000, 8));
    spy.forget();

    const next = ranked(2200, 12);
    storage.save(next);

    expect(spy.written()).toBeGreaterThan(spy.stored() / 2);
    expect(createWorkspaceStorage(spy.raw).load()).toEqual(next);
  });

  it('leaves no old pieces behind, however many saves it takes to get there', () => {
    const backend = enumerableBackend();
    const storage = createWorkspaceStorage(backend);
    vi.useFakeTimers();
    try {
      let snapshot = ranked(700);
      storage.save(snapshot);
      const keys = backend.data.size;
      for (let i = 0; i < 40; i++) {
        // A replaced piece is kept for a few seconds; a minute between saves is more than that.
        vi.advanceTimersByTime(60_000);
        snapshot = answered(snapshot);
        storage.save(snapshot);
      }

      // Forty more answers can start one more piece of the history, and leave the one just replaced.
      expect(backend.data.size).toBeLessThanOrEqual(keys + 2);
      expect(createWorkspaceStorage(backend).load()).toEqual(snapshot);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the earlier save, whole, when a write fails at any point of a later one', () => {
    const before = ranked(600);
    // Items, history and manifest all change, so a failure can fall between any two of the writes.
    const after = withList(answered(before), {
      items: before.workspace.lists['']!.items.map((item, i) =>
        i === 0 ? { ...item, updatedAt: 'later' } : item,
      ),
    });
    for (let allowed = 0; allowed < 4; allowed++) {
      const spy = watched();
      const storage = createWorkspaceStorage(spy.backend);
      storage.save(before);
      spy.failAfter(allowed);

      const outcome = storage.save(after);

      if (outcome === 'saved') {
        expect(createWorkspaceStorage(spy.raw).load(), `after ${allowed} writes`).toEqual(after);
        continue;
      }
      expect(outcome).toBe('too-large');
      expect(createWorkspaceStorage(spy.raw).load(), `after ${allowed} writes`).toEqual(before);
      spy.heal();
      expect(storage.save(after)).toBe('saved');
      expect(createWorkspaceStorage(spy.raw).load(), `after ${allowed} writes, retried`).toEqual(after);
    }
  });

  it('counts every piece against the limit, not just the largest', () => {
    const backend = enumerableBackend();
    const storage = createWorkspaceStorage(backend);
    const small = ranked(10);
    storage.save(small);

    // Each piece is well under the limit, but together they are over it.
    const heavy = withList(small, {
      items: small.workspace.lists['']!.items.map((item) => ({
        ...item,
        value: 'x'.repeat(MAX_SNAPSHOT_BYTES / 6),
      })),
    });

    expect(storage.save(heavy)).toBe('too-large');
    expect(createWorkspaceStorage(backend).load()).toEqual(small);
  });

  const saved = () => {
    const backend = enumerableBackend();
    createWorkspaceStorage(backend).save(ranked(600));
    return backend;
  };

  const damages: [string, (backend: Backend, key: string) => void][] = [
    ['a missing piece', (backend, key) => void backend.data.delete(key)],
    ['a piece cut short', (backend, key) => void backend.data.set(key, backend.data.get(key)!.slice(0, -5))],
    [
      'a piece that is not JSON',
      (backend, key) => void backend.data.set(key, 'x'.repeat(backend.data.get(key)!.length)),
    ],
  ];

  it.each(damages)('refuses the workspace with %s', (_name, damage) => {
    const pieces = (backend: Backend) =>
      [...backend.data.keys()].filter((key) => key !== WORKSPACE_STORAGE_KEY);
    const count = pieces(saved()).length;
    // The document, the items, and the history in more than one piece.
    expect(count).toBeGreaterThan(3);

    for (let piece = 0; piece < count; piece++) {
      const backend = saved();
      damage(backend, pieces(backend)[piece]!);

      expect(createWorkspaceStorage(backend).load(), `piece ${piece}`).toBeNull();
    }
  });

  it('refuses a history with an event that is not one, though the piece is the right length', () => {
    const backend = enumerableBackend();
    createWorkspaceStorage(backend).save(ranked(10));
    const key = [...backend.data.keys()].find((k) => backend.data.get(k)!.includes('"kind":"pair"'))!;
    backend.data.set(key, backend.data.get(key)!.replace('"outcome":"left"', '"outcome":"lefs"'));

    expect(createWorkspaceStorage(backend).load()).toBeNull();
  });

  it('writes everything again when something else has changed the manifest', () => {
    const backend = enumerableBackend();
    const first = createWorkspaceStorage(backend);
    first.save(ranked(600));
    // Another tab saves a different workspace, and tidies the pieces the first knew of.
    createWorkspaceStorage(backend).save(ranked(40, 3));

    const ours = answered(ranked(600));
    first.save(ours);

    expect(createWorkspaceStorage(backend).load()).toEqual(ours);
  });

  it('deletes the pieces of a workspace it replaced, and the key of the single-key layout', () => {
    const backend = enumerableBackend();
    const legacyKey = LEGACY_STORAGE_KEYS.at(-1)!;
    backend.data.set(legacyKey, '{"version":6}');
    const storage = createWorkspaceStorage(backend);
    const next = ranked(30, 3);
    vi.useFakeTimers();
    try {
      storage.save(ranked(600));
      storage.save(next);
      // The replaced pieces go once they have had their grace, at the next save, even one that writes nothing.
      vi.advanceTimersByTime(60_000);
      storage.save(next);
    } finally {
      vi.useRealTimers();
    }
    const fresh = enumerableBackend();
    createWorkspaceStorage(fresh).save(ranked(30, 3));

    expect(storage.load()).toEqual(next);
    expect(backend.data.has(legacyKey)).toBe(false);
    expect(backend.data.size).toBe(fresh.data.size);
  });

  it('removes pieces a crash left behind once they are old, and leaves a newer one alone', () => {
    vi.useFakeTimers();
    try {
      const backend = enumerableBackend();
      createWorkspaceStorage(backend).save(ranked(10));
      const stamp = (ageMs: number) => (Date.now() - ageMs).toString(36);
      const old = `${WORKSPACE_STORAGE_KEY}:${stamp(120_000)}.zzzz0`;
      const recent = `${WORKSPACE_STORAGE_KEY}:${stamp(1_000)}.zzzz1`;
      backend.data.set(old, '[]');
      backend.data.set(recent, '[]');

      expect(createWorkspaceStorage(backend).load()).toEqual(ranked(10));

      expect(backend.data.has(old)).toBe(false);
      expect(backend.data.has(recent)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears every piece', () => {
    const backend = enumerableBackend();
    const storage = createWorkspaceStorage(backend);
    storage.save(ranked(600));
    storage.clear();

    expect(backend.data.size).toBe(0);
    expect(storage.load()).toBeNull();
  });

  it('works, and tidies up after itself, on a backend that cannot list its keys', () => {
    const backend = enumerableBackend();
    const plain: StorageLike = {
      getItem: backend.getItem,
      setItem: backend.setItem,
      removeItem: backend.removeItem,
    };
    const storage = createWorkspaceStorage(plain);
    const before = ranked(600);
    storage.save(before);
    const keys = backend.data.size;
    storage.save(answered(before));

    expect(backend.data.size).toBeLessThanOrEqual(keys + 1);
    storage.clear();
    expect(backend.data.size).toBe(0);
  });
});

describe('the manifest', () => {
  type Manifest = any;

  it('a version 7 browser save is rejected', () => {
    const backend = enumerableBackend();
    createWorkspaceStorage(backend).save(ranked(40, 3));
    const manifest = JSON.parse(backend.data.get(WORKSPACE_STORAGE_KEY)!) as Manifest;
    manifest.version = 7;
    backend.data.set(WORKSPACE_STORAGE_KEY, JSON.stringify(manifest));

    expect(createWorkspaceStorage(backend).load()).toBeNull();
  });

  const damages: [string, (manifest: Manifest) => void][] = [
    ['another version', (m) => (m.version = 5)],
    ['no preview tab', (m) => delete m.ui.previewTab],
    ['no document piece', (m) => delete m.workspace.source.document],
    ['a document piece with no key', (m) => (m.workspace.source.document.key = '')],
    ['a document piece of negative length', (m) => (m.workspace.source.document.chars = -1)],
    [
      'a list under the wrong path',
      (m) => ((m.workspace.lists.other = m.workspace.lists['']), delete m.workspace.lists['']),
    ],
    ['no open list', (m) => (m.workspace.lists = {})],
    ['an items piece that is a string', (m) => (m.workspace.lists[''].items = 'items')],
    ['history pieces that are not a list', (m) => (m.workspace.lists[''].events = {})],
    ['a history piece with no events in it', (m) => (m.workspace.lists[''].events[0].count = 0)],
    ['a history piece that is not a piece', (m) => (m.workspace.lists[''].events[0] = null)],
    ['a list with no id', (m) => delete m.workspace.lists[''].id],
  ];

  it.each(damages)('refuses a workspace whose manifest has %s', (_name, damage) => {
    const backend = enumerableBackend();
    createWorkspaceStorage(backend).save(ranked(600));
    const manifest = JSON.parse(backend.data.get(WORKSPACE_STORAGE_KEY)!) as Manifest;
    damage(manifest);
    backend.data.set(WORKSPACE_STORAGE_KEY, JSON.stringify(manifest));

    expect(createWorkspaceStorage(backend).load()).toBeNull();
  });

  it('refuses a manifest that is not JSON, or not an object', () => {
    for (const text of ['{', 'null', '[]', '7', '"manifest"']) {
      const backend = enumerableBackend();
      createWorkspaceStorage(backend).save(ranked(10));
      backend.data.set(WORKSPACE_STORAGE_KEY, text);

      expect(createWorkspaceStorage(backend).load(), text).toBeNull();
    }
  });
});
