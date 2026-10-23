import { describe, expect, it } from 'vitest';

import { createEngineCache } from '@/lib/engine/engineCache';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';

/** localStorage's shape in memory, with the enumeration prune and clear use. */
function memoryBackend(): StorageLike & {
  entries: Map<string, string>;
  length: number;
  key(i: number): string | null;
} {
  const entries = new Map<string, string>();
  return {
    entries,
    get length() {
      return entries.size;
    },
    key: (i) => [...entries.keys()][i] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
}

const throwing: StorageLike = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

describe('createEngineCache', () => {
  it('saves and loads an entry under the list id', () => {
    const backend = memoryBackend();
    const cache = createEngineCache(backend);
    expect(cache.save('list-1', '{"v":1}')).toBe(true);
    expect(backend.entries.get('pairwise-list-ranker:engine:list-1')).toBe('{"v":1}');
    expect(cache.load('list-1')).toBe('{"v":1}');
    expect(cache.load('list-2')).toBeNull();
  });

  it('prune keeps only the named lists and leaves other keys alone', () => {
    const backend = memoryBackend();
    backend.setItem('pairwise-list-ranker:workspace:v2', 'workspace');
    const cache = createEngineCache(backend);
    cache.save('a', 'A');
    cache.save('b', 'B');
    cache.save('c', 'C');
    cache.prune(['b']);
    expect([...backend.entries.keys()].sort()).toEqual([
      'pairwise-list-ranker:engine:b',
      'pairwise-list-ranker:workspace:v2',
    ]);
  });

  it('prune and clear also reach entries saved before this page loaded', () => {
    const backend = memoryBackend();
    backend.setItem('pairwise-list-ranker:engine:old', 'O');
    backend.setItem('pairwise-list-ranker:engine:kept', 'K');
    const cache = createEngineCache(backend);
    cache.prune(['kept']);
    expect(cache.load('old')).toBeNull();
    expect(cache.load('kept')).toBe('K');
    cache.clear();
    expect(backend.entries.size).toBe(0);
  });

  it('without enumeration, prune and clear reach the entries it saved', () => {
    const entries = new Map<string, string>();
    const backend: StorageLike = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => void entries.set(key, value),
      removeItem: (key) => void entries.delete(key),
    };
    const cache = createEngineCache(backend);
    cache.save('a', 'A');
    cache.save('b', 'B');
    cache.prune(['a']);
    expect([...entries.keys()]).toEqual(['pairwise-list-ranker:engine:a']);
    cache.clear();
    expect(entries.size).toBe(0);
  });

  it('a full or throwing backend never throws, and loads nothing', () => {
    const cache = createEngineCache(throwing);
    expect(cache.save('a', 'A'), 'not written').toBe(false);
    expect(cache.load('a')).toBeNull();
    expect(() => cache.prune([])).not.toThrow();
    expect(() => cache.clear()).not.toThrow();
  });

  it('with no backend it keeps nothing and never throws', () => {
    const cache = createEngineCache(null);
    expect(cache.save('a', 'A')).toBe(false);
    expect(cache.load('a')).toBeNull();
    expect(() => cache.prune([])).not.toThrow();
    expect(() => cache.clear()).not.toThrow();
  });
});
