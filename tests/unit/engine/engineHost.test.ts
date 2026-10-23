import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ColdBuilder, type ColdBuildRequest, createSyncBuilder } from '@/lib/engine/coldBuild';
import { createEngineCache, type EngineCache } from '@/lib/engine/engineCache';
import { createEngineHost, type EngineHost, type EngineView } from '@/lib/engine/engineHost';
import { toEngineList } from '@/lib/engine/engineList';
import type * as Engine from '@/lib/ranking/bt/engine';
import { createReplayJob, EngineSession, replay } from '@/lib/ranking/bt/engine';
import { openSealed, openSealedEntry, sealSnapshot } from '@/lib/ranking/bt/sealed';
import type * as Solver from '@/lib/ranking/bt/solver';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { removedIds } from '@/lib/state/membership';
import { drivenHistory } from '@/tests/helpers/engineCorpus';
import { listItem, NOW, rankedList, recorded } from '@/tests/helpers/snapshots';
import type { ListItem } from '@/types/list';
import type { EngineList, RankingEvent } from '@/types/rankingEvents';
import type { RankedList } from '@/types/source';

/** Solves still to report as missed, so a test can force a solver miss (the engine tests' seam). */
const forcedMisses = vi.hoisted(() => ({ remaining: 0 }));
/** Calls to the engine's replay from the priors, so a test can tell whether the host replayed in full. */
const replays = vi.hoisted(() => ({ count: 0, fail: false }));
/** While set, every cold replay job throws, so a test can make every build and sliced replay fail. */
const replayJobs = vi.hoisted(() => ({ fail: false }));
/** Sessions started, and how many of the next to start fail, so a test can tell when the host starts one. */
const sessions = vi.hoisted(() => ({ count: 0, failNext: 0 }));

vi.mock('@/lib/ranking/bt/solver', async (importOriginal) => {
  const actual = await importOriginal<typeof Solver>();
  const solve: typeof actual.solve = (...args) => {
    const result = actual.solve(...args);
    if (forcedMisses.remaining === 0) return result;
    forcedMisses.remaining--;
    return { ...result, converged: false };
  };
  return { ...actual, solve };
});

vi.mock('@/lib/ranking/bt/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof Engine>();
  const replay: typeof actual.replay = (...args) => {
    if (replays.fail) throw new Error('The replay failed.');
    if (args[1]?.snapshot === undefined) replays.count++;
    return actual.replay(...args);
  };
  const createReplayJob: typeof actual.createReplayJob = (...args) => {
    if (replayJobs.fail) throw new Error('The replay failed.');
    return actual.createReplayJob(...args);
  };
  class CountedSession extends actual.EngineSession {
    constructor(...args: ConstructorParameters<typeof actual.EngineSession>) {
      if (sessions.failNext > 0) {
        sessions.failNext--;
        throw new Error('The session could not start.');
      }
      super(...args);
      sessions.count++;
    }
  }
  return { ...actual, replay, createReplayJob, EngineSession: CountedSession };
});

const LIST_ID = 'list-a';

/** A RankedList over an engine history, with an item for every id the history can name. */
function rankedListOf(engine: EngineList, id = LIST_ID): RankedList {
  const ids = [...new Set(engine.originalItemIds)];
  return rankedList({
    id,
    initialStartingOrder: engine.startingOrder,
    originalItemIds: [...engine.originalItemIds],
    items: ids.map((itemId) => listItem(itemId, id, { title: itemId })),
    events: recorded(engine.events),
  });
}

const history = drivenHistory({ n: 14, events: 130, seed: 5, user: 'typical', mix: { placement: 0.08 } });
const otherHistory = drivenHistory({ n: 10, events: 60, seed: 9, user: 'careful', startingOrder: 'ranked' });

/** The first `count` events of the main history, as list `id`. */
function prefix(count: number, id = LIST_ID): RankedList {
  return rankedListOf({ ...history, events: history.events.slice(0, count) }, id);
}

function withEvents(list: RankedList, events: RankingEvent[]): RankedList {
  return { ...list, events: recorded(events) };
}

/** Longer than CHECKPOINT_EVERY (500), built on first use. */
let longHistory: EngineList | undefined;
function long(count?: number): RankedList {
  longHistory ??= drivenHistory({ n: 14, events: 560, seed: 11, user: 'typical', mix: { undo: 0 } });
  return rankedListOf({ ...longHistory, events: longHistory.events.slice(0, count) });
}

const ids = (items: readonly ListItem[]): string[] => items.map((item) => item.id);

/** Lets resolved builds and their callbacks run. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Settles until `check` holds, for work done in slices. */
async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !check(); i++) await settle();
  expect(check()).toBe(true);
}

function readyView(host: EngineHost): Extract<EngineView, { status: 'ready' }> {
  const view = host.view();
  if (view?.status !== 'ready') throw new Error(`Expected a ready view, got ${JSON.stringify(view)}.`);
  return view;
}

/** The ready view shows what a fresh replay of the list gives, as the list's own items. */
function expectReadyEqualsReplay(host: EngineHost, list: RankedList): void {
  const view = readyView(host);
  const expected = replay(toEngineList(list));
  expect(view.listId).toBe(list.id);
  expect(ids(view.ranked)).toEqual(expected.ranked);
  expect(ids(view.unrecognized)).toEqual(expected.unrecognized);
  expect(view.nextPair && ids(view.nextPair)).toEqual(expected.nextPair);
  const byId = new Map(list.items.map((item) => [item.id, item]));
  view.ranked.forEach((item) => expect(item).toBe(byId.get(item.id)));
}

/** A sync builder that counts its builds. */
function countingBuilder(): ColdBuilder & { requests: ColdBuildRequest[] } {
  const inner = createSyncBuilder();
  const requests: ColdBuildRequest[] = [];
  return {
    requests,
    via: 'sync',
    build(request) {
      requests.push(request);
      return inner.build(request);
    },
    cancel: (key) => inner.cancel(key),
  };
}

interface DeferredRequest extends ColdBuildRequest {
  resolve(): void;
  reject(error: Error): void;
}

/** A builder whose builds resolve only when the test says, and which ignores cancel, as a late reply would. */
function deferredBuilder(): { builder: ColdBuilder; requests: DeferredRequest[]; cancelled: string[] } {
  const inner = createSyncBuilder();
  const requests: DeferredRequest[] = [];
  const cancelled: string[] = [];
  const builder: ColdBuilder = {
    via: 'sync',
    build(request) {
      return new Promise<EngineSnapshot>((resolve, reject) => {
        requests.push({ ...request, resolve: () => resolve(inner.build(request)), reject });
      });
    },
    cancel: (key) => void cancelled.push(key),
  };
  return { builder, requests, cancelled };
}

function requestAt(requests: DeferredRequest[], index: number): DeferredRequest {
  const request = requests[index];
  if (request === undefined) throw new Error(`No build ${index} was started.`);
  return request;
}

/** localStorage's shape in memory. */
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

/** How many events the cached snapshot for the list covers, or null if none opens for it. */
function cachedCoverage(cache: EngineCache, list: RankedList): number | null {
  return openSealed(toEngineList(list), cache.load(list.id))?.eventIds.length ?? null;
}

afterEach(() => {
  forcedMisses.remaining = 0;
  sessions.failNext = 0;
});

describe('sync', () => {
  it('a list with no history is ready at once, with no build', () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    const list = prefix(0);
    host.sync(list);
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(0);
  });

  it('cold: restoring until the build resolves, then ready, equal to replay, and cached', async () => {
    const { builder, requests } = deferredBuilder();
    const cache = createEngineCache(memoryBackend());
    const host = createEngineHost({ builder, cache });
    const list = prefix(60);
    host.sync(list);
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    const request = requestAt(requests, 0);
    expect(request.key).toBe(`${LIST_ID}:60:${list.events[59]?.id}`);
    request.resolve();
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(cachedCoverage(cache, list)).toBe(60);
  });

  it('warm: one more event each time is appended, with no build', async () => {
    // No cache, so any path but the warm one would need a build.
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    host.sync(prefix(60));
    await settle();
    for (let count = 61; count <= 70; count++) {
      const list = prefix(count);
      host.sync(list);
      expectReadyEqualsReplay(host, list);
    }
    expect(builder.requests).toHaveLength(1);
  });

  /** Two events at once: a removal, then a move of one item. */
  function removalAndMove(list: RankedList): RankingEvent[] {
    const ranked = replay(toEngineList(list)).ranked;
    const common = { listId: LIST_ID, createdAt: NOW };
    return [
      { ...common, id: 'cut-r', kind: 'removal', itemIds: [ranked[4] as string] },
      {
        ...common,
        id: 'cut-p',
        kind: 'placement',
        itemId: ranked[0] as string,
        aboveItemId: ranked[6],
        belowItemId: ranked[7],
      },
    ];
  }

  it('warm: two events at once (a removal and a move) are appended whole, with no build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const base = prefix(60);
    host.sync(base);
    await settle();

    const changed = withEvents(base, [...base.events, ...removalAndMove(base)]);
    host.sync(changed);

    expectReadyEqualsReplay(host, changed);
    expect(builder.requests).toHaveLength(1);
  });

  it('warm: a move taken back is undone from the undo snapshot, with no build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const base = prefix(60);
    host.sync(base);
    await settle();
    const [removal, move] = removalAndMove(base) as [RankingEvent, RankingEvent];
    host.sync(withEvents(base, [...base.events, removal]));

    const moved = withEvents(base, [...base.events, removal, move]);
    host.sync(moved);
    expectReadyEqualsReplay(host, moved);
    const undone = withEvents(base, [...base.events, removal]);
    host.sync(undone);

    expectReadyEqualsReplay(host, undone);
    expect(builder.requests).toHaveLength(1);
  });

  it('three or more events at once are not appended warm, but rebuilt', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    host.sync(prefix(60));
    await settle();

    const list = prefix(63);
    host.sync(list);

    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(2);
  });

  it('undo: the last event removed is undone from the undo snapshot, with no build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    host.sync(prefix(70));
    await settle();
    host.sync(prefix(71));
    const list = prefix(70);
    host.sync(list);
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(1);
  });

  it('a second undo within CHECKPOINT_EVERY events of the start replays warm, with no build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    host.sync(prefix(70));
    await settle();
    for (const count of [69, 68]) {
      const list = prefix(count);
      host.sync(list);
      expectReadyEqualsReplay(host, list);
    }
    expect(builder.requests).toHaveLength(1);
  });

  it('after an open, a second undo far from any checkpoint goes to a cold build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const n = long().events.length;
    expect(n).toBeGreaterThan(502);
    host.sync(long());
    await settle();
    const undone = long(n - 1);
    host.sync(undone);
    expectReadyEqualsReplay(host, undone);
    expect(builder.requests, 'the first undo uses the undo snapshot').toHaveLength(1);

    const list = long(n - 2);
    host.sync(list);
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    expect(builder.requests.map((request) => request.list.events.length)).toEqual([n, n - 2]);
    await settle();
    expectReadyEqualsReplay(host, list);
  });

  it('after an open, an answer, its undo and one more undo stay warm, with no build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const n = long().events.length;
    host.sync(long(n - 1));
    await settle();
    // The answer and its undo, then the undo of the last event the list opened with.
    for (const count of [n, n - 1, n - 2]) {
      const list = long(count);
      host.sync(list);
      expectReadyEqualsReplay(host, list);
    }
    expect(builder.requests).toHaveLength(1);
  });

  it('the same history again only refreshes the items', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const list = prefix(60);
    host.sync(list);
    await settle();
    const renamed = {
      ...list,
      items: list.items.map((item) => ({ ...item, value: { title: `${item.id}!` } })),
    };
    host.sync(renamed);
    expectReadyEqualsReplay(host, renamed);
    expect(builder.requests).toHaveLength(1);
  });

  it('cache: an accepted cached snapshot opens on the main thread, with no build', async () => {
    const backend = memoryBackend();
    const first = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(backend) });
    first.sync(prefix(60));
    await settle();

    for (const count of [60, 75]) {
      const builder = countingBuilder();
      const host = createEngineHost({ builder, cache: createEngineCache(backend) });
      const list = prefix(count);
      host.sync(list);
      expectReadyEqualsReplay(host, list);
      expect(builder.requests).toHaveLength(0);
    }
  });

  it('a cached snapshot far behind the history is passed over for a cold build', async () => {
    const backend = memoryBackend();
    const first = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(backend) });
    first.sync(prefix(5));
    await settle();

    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(backend) });
    // Precondition: more than 100 events past the cached 5, whatever the driven mix.
    expect(history.events.length).toBeGreaterThan(105);
    const list = prefix(history.events.length);
    host.sync(list);
    expect(host.view()?.status).toBe('restoring');
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(1);
  });

  it.each([
    {
      name: 'a removal in place of the last event',
      next: (list: RankedList) =>
        withEvents(list, [
          ...list.events.slice(0, -1),
          {
            id: 'edit-1',
            listId: LIST_ID,
            createdAt: NOW,
            kind: 'removal',
            itemIds: ['i3'],
          },
        ]),
      builds: 2,
    },
    { name: 'a loaded session with a shorter history', next: () => prefix(40), builds: 2 },
    // The cached snapshot from the first build covers a prefix of it.
    { name: 'a loaded session with a longer history', next: () => prefix(66), builds: 1 },
    {
      name: 'a change of starting order',
      next: (list: RankedList) => ({ ...list, initialStartingOrder: 'ranked' as const }),
      builds: 2,
    },
  ])('the same list with $name opens again, by event id, not by length', async ({ next, builds }) => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    host.sync(prefix(60));
    await settle();
    const list = next(prefix(60));
    host.sync(list);
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(builds);
  });
});

describe('stale builds', () => {
  const scenarios: { name: string; then(host: EngineHost): RankedList | null }[] = [
    {
      name: 'switching list',
      then: (host) => {
        const other = rankedListOf(otherHistory, 'list-b');
        host.sync(other);
        return other;
      },
    },
    {
      name: 'loading a session',
      then: (host) => {
        const loaded = prefix(40);
        host.sync(loaded);
        return loaded;
      },
    },
    {
      name: 'a removal',
      then: (host) => {
        const list = prefix(60);
        const edited = withEvents(list, [
          ...list.events,
          {
            id: 'edit-1',
            listId: LIST_ID,
            createdAt: NOW,
            kind: 'removal',
            itemIds: ['i2'],
          },
        ]);
        host.sync(edited);
        return edited;
      },
    },
    {
      name: 'a reset',
      then: (host) => {
        host.reset();
        return null;
      },
    },
  ];

  it.each(scenarios)('a stale build is discarded after $name', async ({ then }) => {
    const { builder, requests, cancelled } = deferredBuilder();
    const cache = createEngineCache(memoryBackend());
    const host = createEngineHost({ builder, cache });
    host.sync(prefix(60));
    const stale = requestAt(requests, 0);
    const latest = then(host);
    expect(cancelled).toContain(stale.key);

    stale.resolve();
    await settle();
    if (latest === null) {
      expect(host.view()).toBeNull();
      expect(cache.load(LIST_ID)).toBeNull();
      return;
    }
    expect(host.view()).toEqual({ status: 'restoring', listId: latest.id });
    expect(cache.load(LIST_ID)).toBeNull();

    requestAt(requests, 1).resolve();
    await settle();
    expectReadyEqualsReplay(host, latest);
  });

  it('a build for the same history keeps running when the list syncs again', async () => {
    const { builder, requests } = deferredBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    const list = prefix(60);
    host.sync(list);
    host.sync({ ...list, items: [...list.items] });
    expect(requests).toHaveLength(1);
    requestAt(requests, 0).resolve();
    await settle();
    expectReadyEqualsReplay(host, list);
  });

  it('a forced solver miss on append triggers a cold build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    host.sync(prefix(60));
    await settle();
    forcedMisses.remaining = 1;
    const list = prefix(61);
    host.sync(list);
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    expect(builder.requests.map((request) => request.key)).toEqual([
      `${LIST_ID}:60:${list.events[59]?.id}`,
      `${LIST_ID}:61:${list.events[60]?.id}`,
    ]);
    await settle();
    expectReadyEqualsReplay(host, list);
  });

  it('a starting order change while restoring starts a new build and drops the old one', async () => {
    const { builder, requests, cancelled } = deferredBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    const list = prefix(60);
    host.sync(list);
    const reordered: RankedList = { ...list, initialStartingOrder: 'ranked' };
    host.sync(reordered);
    expect(requests).toHaveLength(2);
    expect(cancelled).toEqual([requestAt(requests, 0).key]);
    requestAt(requests, 0).resolve();
    await settle();
    expect(host.view()?.status).toBe('restoring');
    requestAt(requests, 1).resolve();
    await settle();
    expectReadyEqualsReplay(host, reordered);
  });

  it('switching A, B, A quickly: only the last build applies, with the latest items', async () => {
    const { builder, requests } = deferredBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    const a = prefix(60);
    host.sync(a);
    host.sync(rankedListOf(otherHistory, 'list-b'));
    const renamed: RankedList = {
      ...a,
      items: a.items.map((item) => ({ ...item, value: { title: `${item.id}!` } })),
    };
    host.sync(renamed);
    expect(requests).toHaveLength(3);
    requestAt(requests, 0).resolve();
    requestAt(requests, 1).resolve();
    await settle();
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    requestAt(requests, 2).resolve();
    await settle();
    expectReadyEqualsReplay(host, renamed);
  });
});

describe('failed builds', () => {
  afterEach(() => {
    replayJobs.fail = false;
    vi.restoreAllMocks();
  });

  function rejecting(): ColdBuilder & { requests: ColdBuildRequest[] } {
    const requests: ColdBuildRequest[] = [];
    return {
      requests,
      via: 'sync',
      build(request) {
        requests.push(request);
        return Promise.reject(new Error('The replay failed.'));
      },
      cancel: () => undefined,
    };
  }

  it('a failed build is retried once through the slice builder, and the session carries on warm', async () => {
    const builder = rejecting();
    const retryBuilder = countingBuilder();
    const host = createEngineHost({ builder, retryBuilder, cache: createEngineCache(null) });
    const list = prefix(60);
    host.sync(list);
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(retryBuilder.requests.map((request) => request.key)).toEqual([builder.requests[0]?.key]);
    const next = prefix(61);
    host.sync(next);
    expectReadyEqualsReplay(host, next);
    expect(builder.requests).toHaveLength(1);
  });

  it('a retry that finishes after the list changed is dropped', async () => {
    const { builder: retryBuilder, requests } = deferredBuilder();
    const host = createEngineHost({ builder: rejecting(), retryBuilder, cache: createEngineCache(null) });
    host.sync(prefix(60));
    await settle();
    expect(requests).toHaveLength(1);
    host.reset();
    requestAt(requests, 0).resolve();
    await settle();
    expect(host.view()).toBeNull();
  });

  it('when the retry fails too, it logs and shows the ranking from a sliced replay', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createEngineHost({
      builder: rejecting(),
      retryBuilder: rejecting(),
      cache: createEngineCache(null),
    });
    const list = prefix(60);
    host.sync(list);
    await waitFor(() => host.view()?.status === 'ready');
    expectReadyEqualsReplay(host, list);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('rankingNow gives the active items in arrival order when its replay fails, and never throws', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(null) });
    const list = prefix(60);
    replays.fail = true;
    try {
      const removed = removedIds(list.events);
      expect(ids(host.rankingNow(list))).toEqual(ids(list.items).filter((id) => !removed.has(id)));
      expect(logged).toHaveBeenCalled();
    } finally {
      replays.fail = false;
    }
  });

  it('when even the sliced replay fails, the list shows in arrival order with no question', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    replayJobs.fail = true;
    const host = createEngineHost({ builder: rejecting(), cache: createEngineCache(null) });
    const list = prefix(60);
    host.sync(list);
    await waitFor(() => host.view()?.status === 'ready');
    const view = readyView(host);
    const removed = removedIds(list.events);
    expect(ids(view.ranked)).toEqual(ids(list.items).filter((id) => !removed.has(id)));
    expect(view.unrecognized).toEqual([]);
    expect(view.nextPair).toBeNull();
    expect(view.answers).toBe(list.events.filter((event) => event.kind === 'pair').length);
    expect(view.fallback).toBe('arrival');
    expect(logged).toHaveBeenCalled();
  });

  it('a view from a replay carries no fallback marker', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(null) });
    host.sync(prefix(60));
    await settle();
    expect(readyView(host).fallback).toBeUndefined();
  });

  it('an append that throws goes to a cold build and never throws out of sync', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    host.sync(prefix(60));
    await settle();
    vi.spyOn(EngineSession.prototype, 'append').mockImplementationOnce(() => {
      throw new Error('The append failed.');
    });
    const list = prefix(61);
    expect(() => host.sync(list)).not.toThrow();
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(2);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('an undo that throws goes to a cold build and never throws out of sync', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    host.sync(prefix(60));
    await settle();
    vi.spyOn(EngineSession.prototype, 'undo').mockImplementationOnce(() => {
      throw new Error('The undo failed.');
    });
    const list = prefix(59);
    expect(() => host.sync(list)).not.toThrow();
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(2);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('restore drops the open session for a cold build', async () => {
    const builder = countingBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const list = prefix(60);
    host.sync(list);
    await settle();
    host.restore(list);
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(2);
  });
});

describe('the cache', () => {
  it.each([
    { name: 'corrupted', entry: () => '{"v":1,"sum":"00000000","snapshot":{' },
    {
      name: 'foreign',
      // Another list's snapshot under this list's key.
      entry: () => {
        const job = createReplayJob(otherHistory);
        job.step(Infinity);
        return sealSnapshot(job.snapshot());
      },
    },
  ])('a $name cache entry is ignored and a cold build runs', async ({ entry }) => {
    const backend = memoryBackend();
    backend.setItem(`pairwise-list-ranker:engine:${LIST_ID}`, entry());
    const builder = countingBuilder();
    const cache = createEngineCache(backend);
    const host = createEngineHost({ builder, cache });
    const list = prefix(60);
    host.sync(list);
    expect(host.view()?.status).toBe('restoring');
    await settle();
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(1);
    expect(cachedCoverage(cache, list)).toBe(60);
  });

  it('a full or throwing storage backend never throws out of the host', async () => {
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
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(throwing) });
    host.sync(prefix(10));
    await settle();
    let list = prefix(10);
    for (let count = 11; count <= 62; count++) {
      list = prefix(count);
      host.sync(list);
    }
    expectReadyEqualsReplay(host, list);
    expect(() => host.flushCache()).not.toThrow();
    expect(() => host.reset()).not.toThrow();
  });

  it("a save with no room drops other lists' entries to make room for the open list's", async () => {
    const inner = createEngineCache(memoryBackend());
    let full = false;
    const cache: EngineCache = {
      ...inner,
      save: (listId, sealed) => !full && inner.save(listId, sealed),
      prune: (keep) => {
        full = false;
        inner.prune(keep);
      },
    };
    inner.save('list-b', 'B');
    const host = createEngineHost({ builder: countingBuilder(), cache });
    const list = prefix(30);
    host.sync(list);
    await settle();
    full = true;
    host.sync(prefix(31));
    host.flushCache();
    expect(inner.load('list-b')).toBeNull();
    expect(cachedCoverage(inner, prefix(31))).toBe(31);
  });

  it('flushCache saves the open session, and every 50 appends save on their own', async () => {
    const cache = createEngineCache(memoryBackend());
    const host = createEngineHost({ builder: countingBuilder(), cache });
    host.sync(prefix(10));
    await settle();
    expect(cachedCoverage(cache, prefix(10))).toBe(10);
    for (let count = 11; count <= 59; count++) host.sync(prefix(count));
    expect(cachedCoverage(cache, prefix(59))).toBe(10);
    host.sync(prefix(60));
    expect(cachedCoverage(cache, prefix(60))).toBe(60);
    host.sync(prefix(61));
    host.flushCache();
    expect(cachedCoverage(cache, prefix(61))).toBe(61);
  });

  it('reset forgets the view and the session but keeps the cache', async () => {
    const cache = createEngineCache(memoryBackend());
    const host = createEngineHost({ builder: countingBuilder(), cache });
    host.sync(prefix(30));
    await settle();
    host.sync(prefix(31));
    host.reset();
    expect(host.view()).toBeNull();
    host.flushCache();
    expect(cachedCoverage(cache, prefix(31)), 'nothing open to save').toBe(30);
  });

  it('pruneCache drops the snapshots of lists not kept', async () => {
    const cache = createEngineCache(memoryBackend());
    const host = createEngineHost({ builder: countingBuilder(), cache });
    const other = rankedListOf(otherHistory, 'list-b');
    host.sync(prefix(30));
    await settle();
    host.sync(other);
    await settle();
    host.pruneCache(['list-b']);
    expect(cache.load(LIST_ID)).toBeNull();
    expect(cachedCoverage(cache, other)).toBe(other.events.length);
  });

  it('leaving a list while the cache is full keeps the entry of the list being opened', async () => {
    const backend = memoryBackend();
    const cache = createEngineCache(backend);
    const host = createEngineHost({ builder: countingBuilder(), cache });
    const other = rankedListOf(otherHistory, 'list-b');
    host.sync(other);
    await settle();
    host.sync(prefix(30));
    await settle();
    // A full cache refuses the old list's save once, until something else makes room.
    const save = cache.save.bind(cache);
    let refused = false;
    cache.save = (listId, sealed) => {
      if (!refused && listId === LIST_ID) {
        refused = true;
        return false;
      }
      return save(listId, sealed);
    };
    host.sync(other);
    expect(refused).toBe(true);
    expect(cachedCoverage(cache, other)).toBe(other.events.length);
  });

  it('forgetLists drops the remembered orders of lists not kept', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(null) });
    const other = rankedListOf(otherHistory, 'list-b');
    host.sync(prefix(30));
    await settle();
    host.sync(other);
    await settle();
    let before = replays.count;
    host.rankingNow(prefix(30));
    expect(replays.count - before, 'remembered when it was left').toBe(0);
    host.forgetLists(['list-b']);
    before = replays.count;
    host.rankingNow(prefix(30));
    expect(replays.count - before, 'forgotten, with no cache to open from').toBe(1);
  });
});

describe('rankingNow', () => {
  it('returns the ready order without replaying, and replays when restoring', async () => {
    const { builder, requests } = deferredBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(memoryBackend()) });
    const list = prefix(60);
    const expected = replay(toEngineList(list));
    const order = [...expected.ranked, ...expected.unrecognized];

    host.sync(list);
    let before = replays.count;
    expect(ids(host.rankingNow(list))).toEqual(order);
    expect(replays.count - before).toBe(1);

    requestAt(requests, 0).resolve();
    await settle();
    before = replays.count;
    const ranking = host.rankingNow(list);
    expect(replays.count - before).toBe(0);
    expect(ids(ranking)).toEqual(order);
    expect(ranking[0]).toBe(list.items.find((item) => item.id === order[0]));

    // A list the view does not show is replayed.
    const other = prefix(50);
    before = replays.count;
    const ranking50 = host.rankingNow(other);
    expect(replays.count - before).toBe(1);
    const expected50 = replay(toEngineList(other));
    expect(ids(ranking50)).toEqual([...expected50.ranked, ...expected50.unrecognized]);
  });

  /** The ranking equals a fresh replay's order, and was worked out with no replay. */
  function expectRankingWithoutReplay(host: EngineHost, list: RankedList): void {
    const before = replays.count;
    const ranking = host.rankingNow(list);
    expect(replays.count - before, 'replays').toBe(0);
    const expected = replay(toEngineList(list));
    expect(ids(ranking)).toEqual([...expected.ranked, ...expected.unrecognized]);
  }

  const listB = rankedListOf(otherHistory, 'list-b');

  it('a list that is not open gives the order it was left with, and replays once it has changed', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(null) });
    const list = prefix(60);
    host.sync(list);
    await settle();
    host.sync(listB);
    await settle();

    expectRankingWithoutReplay(host, list);
    const changed = prefix(59);
    const before = replays.count;
    host.rankingNow(changed);
    expect(replays.count - before, 'a different history is not taken for the one left').toBe(1);
  });

  it('a list that is not open opens from its cached snapshot, with no replay, then from memory', async () => {
    const cache = createEngineCache(memoryBackend());
    const list = prefix(60);
    const first = createEngineHost({ builder: countingBuilder(), cache });
    first.sync(list);
    await settle();

    // A reload: a new host, with only the cache carried over.
    const host = createEngineHost({ builder: countingBuilder(), cache });
    host.sync(listB);
    await settle();
    const opened = vi.spyOn(cache, 'load');
    expectRankingWithoutReplay(host, list);
    expect(opened).toHaveBeenCalledWith(LIST_ID);
    opened.mockClear();
    expectRankingWithoutReplay(host, list);
    expect(opened, 'the second time comes from memory').not.toHaveBeenCalled();
  });

  it('a list that is not open, with nothing cached or remembered, is replayed', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(memoryBackend()) });
    host.sync(listB);
    await settle();
    const before = replays.count;
    host.rankingNow(prefix(60));
    expect(replays.count - before).toBe(1);
  });

  it('the open list while it restores gives the order it was left with, with no replay', async () => {
    const { builder, requests } = deferredBuilder();
    const host = createEngineHost({ builder, cache: createEngineCache(null) });
    const list = prefix(60);
    host.sync(list);
    requestAt(requests, 0).resolve();
    await settle();
    host.sync(listB);
    host.sync(list);
    expect(host.view()).toEqual({ status: 'restoring', listId: LIST_ID });

    expectRankingWithoutReplay(host, list);
  });
});

describe('answers', () => {
  it('answers counts pairs and draws, and no other event (docs/ARCHITECTURE.md 6.12)', async () => {
    const base = { listId: LIST_ID, createdAt: NOW };
    const events: RankingEvent[] = [
      { ...base, id: 'p1', kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      { ...base, id: 'p2', kind: 'pair', leftItemId: 'b', rightItemId: 'c', outcome: 'draw' },
      {
        ...base,
        id: 'd1',
        kind: 'placement',
        itemId: 'd',
        aboveItemId: 'a',
        belowItemId: 'c',
      },
      { ...base, id: 'u1', kind: 'unrecognized', itemIds: ['e'] },
      { ...base, id: 'm1', kind: 'removal', itemIds: ['b'] },
      { ...base, id: 'p3', kind: 'pair', leftItemId: 'a', rightItemId: 'c', outcome: 'right_strong' },
    ];
    const list = rankedListOf({
      originalItemIds: ['a', 'b', 'c', 'd', 'e'],
      startingOrder: 'unordered',
      events,
    });
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(null) });
    host.sync(list);
    await settle();
    expect(readyView(host).answers).toBe(3);
  });
});

describe('a cached snapshot with its view', () => {
  /** A backend holding the entry a host left for the first `count` events of the main history. */
  async function leftBehind(count: number) {
    const backend = memoryBackend();
    const first = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(backend) });
    first.sync(prefix(count));
    await settle();
    first.flushCache();
    return backend;
  }

  /** A host over a backend, with the builds it makes counted. */
  function reopened(backend: ReturnType<typeof memoryBackend>) {
    const builder = countingBuilder();
    const cache = createEngineCache(backend);
    return { builder, cache, host: createEngineHost({ builder, cache }) };
  }

  /** The order a fresh replay of the list gives, ranked and then unrecognized. */
  function replayedOrder(list: RankedList): string[] {
    const state = replay(toEngineList(list));
    return [...state.ranked, ...state.unrecognized];
  }

  it('opens ready at once without starting a session, then starts one once a screen has shown the view and the page is idle', async () => {
    const { builder, host } = reopened(await leftBehind(60));
    const started = sessions.count;
    const list = prefix(60);

    host.sync(list);

    expectReadyEqualsReplay(host, list);
    expect(sessions.count).toBe(started);
    const shown = host.view();
    await settle();
    expect(sessions.count, 'nothing has shown the view yet').toBe(started);
    host.viewShown();
    host.viewShown();
    expect(sessions.count, 'not before the page is idle').toBe(started);
    await settle();
    expect(sessions.count).toBe(started + 1);
    // The same view, now with the disorder only a session can give: worked out once the page is idle again.
    expect(shown).toMatchObject({ status: 'ready', disorder: null });
    await settle();
    expect(host.view(), 'not until an answer clicked right after the open has had its turn').toEqual(shown);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(host.view()).toEqual({ ...shown, disorder: expect.any(Number) });
    expect(builder.requests).toHaveLength(0);
  });

  it('shows what a replay shows when the entry was saved after warm appends', async () => {
    const backend = memoryBackend();
    const first = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(backend) });
    first.sync(prefix(60));
    await settle();
    first.sync(prefix(61));
    first.sync(prefix(62));
    first.flushCache();
    const { host } = reopened(backend);
    const started = sessions.count;
    const list = prefix(62);

    host.sync(list);

    expect(sessions.count, 'opened from the view, with no session').toBe(started);
    expectReadyEqualsReplay(host, list);
  });

  it.each([
    { seed: 21, user: 'typical', startingOrder: 'unordered', mix: {} },
    { seed: 22, user: 'careful', startingOrder: 'ranked', mix: { placement: 0.1 } },
    { seed: 23, user: 'typical', startingOrder: 'rough', mix: { placement: 0.06, undo: 0 } },
    { seed: 24, user: 'typical', startingOrder: 'unordered', mix: { unrecognized: 0.1, removal: 0.08 } },
  ] as const)('shows what a fresh replay shows, for history $seed ($startingOrder)', async (shape) => {
    const engine = drivenHistory({ n: 16, events: 90, ...shape });
    const list = rankedListOf(engine);
    const backend = memoryBackend();
    const first = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(backend) });
    first.sync(list);
    await settle();
    first.flushCache();
    const { host } = reopened(backend);
    const started = sessions.count;

    host.sync(list);

    expect(sessions.count).toBe(started);
    expectReadyEqualsReplay(host, list);
  });

  it('starts the session for an answer given straight after the open, and only one', async () => {
    const { builder, host } = reopened(await leftBehind(60));
    const started = sessions.count;
    host.sync(prefix(60));
    const answered = prefix(61);

    host.sync(answered);

    expectReadyEqualsReplay(host, answered);
    await settle();
    expect(sessions.count).toBe(started + 1);
    expect(builder.requests).toHaveLength(0);
  });

  it('does not start the deferred session for a change that is reopened rather than appended', async () => {
    const { host } = reopened(await leftBehind(60));
    const started = sessions.count;
    host.sync(prefix(60));
    const longer = prefix(63);

    host.sync(longer);

    // Three events at once are not appended warm: the list opens again from the cache, once.
    expect(sessions.count).toBe(started + 1);
    expectReadyEqualsReplay(host, longer);
  });

  it('starts the session for the undo of the last event, which stays warm', async () => {
    const { builder, host } = reopened(await leftBehind(60));
    host.sync(prefix(60));
    const undone = prefix(59);

    host.sync(undone);

    expectReadyEqualsReplay(host, undone);
    expect(builder.requests).toHaveLength(0);
  });

  it('stays warm over an answer, its undo and one more undo, as an open that started its session does', async () => {
    const n = long().events.length;
    const backend = memoryBackend();
    const first = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(backend) });
    first.sync(long(n - 1));
    await settle();
    first.flushCache();
    const { builder, host } = reopened(backend);
    host.sync(long(n - 1));

    // The answer and its undo, then the undo of the last event the list opened with.
    for (const count of [n, n - 1, n - 2]) {
      const list = long(count);
      host.sync(list);
      expectReadyEqualsReplay(host, list);
    }
    expect(builder.requests).toHaveLength(0);
  });

  it('answers rankingNow for the list it opened with no session and no replay', async () => {
    const { host } = reopened(await leftBehind(60));
    const started = sessions.count;
    const list = prefix(60);
    host.sync(list);
    const expected = replayedOrder(list);
    const replayed = replays.count;

    const order = ids(host.rankingNow(list));

    expect(sessions.count).toBe(started);
    expect(replays.count).toBe(replayed);
    expect(order).toEqual(expected);
  });

  it('flushCache before the session starts leaves the entry as it was', async () => {
    const { cache, host } = reopened(await leftBehind(60));
    const entry = cache.load(LIST_ID);
    host.sync(prefix(60));

    host.flushCache();

    expect(cache.load(LIST_ID)).toBe(entry);
  });

  it('leaves for another list remembering its order, with no session started for it', async () => {
    const { host } = reopened(await leftBehind(60));
    const started = sessions.count;
    const list = prefix(60);
    host.sync(list);
    const expected = replayedOrder(list);
    const replayed = replays.count;

    host.sync(
      rankedListOf({ originalItemIds: ['x1', 'x2', 'x3'], startingOrder: 'unordered', events: [] }, 'list-b'),
    );
    const order = ids(host.rankingNow(list));

    expect(sessions.count).toBe(started + 1);
    expect(replays.count).toBe(replayed);
    expect(order).toEqual(expected);
  });

  it('is passed over for an ordinary open when its view does not fit the list', async () => {
    const backend = await leftBehind(60);
    const cache = createEngineCache(backend);
    const list = prefix(60);
    const entry = openSealedEntry(toEngineList(list), cache.load(LIST_ID));
    if (entry?.shown == null) throw new Error('Expected a view beside the snapshot.');
    cache.save(
      LIST_ID,
      sealSnapshot(entry.snapshot, { ...entry.shown, ranked: [...entry.shown.ranked.slice(1), 'nobody'] }),
    );
    const { builder, host } = reopened(backend);
    const started = sessions.count;

    host.sync(list);

    expect(sessions.count).toBe(started + 1);
    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(0);
  });

  it('is passed over for an ordinary open when the entry carries none', async () => {
    const backend = await leftBehind(60);
    const cache = createEngineCache(backend);
    const list = prefix(60);
    const snapshot = openSealed(toEngineList(list), cache.load(LIST_ID));
    if (snapshot === null) throw new Error('Expected a snapshot.');
    cache.save(LIST_ID, sealSnapshot(snapshot));
    const { host } = reopened(backend);
    const started = sessions.count;

    host.sync(list);

    expect(sessions.count).toBe(started + 1);
    expectReadyEqualsReplay(host, list);
  });

  it('is passed over for an ordinary open when the snapshot is behind the history', async () => {
    const { host } = reopened(await leftBehind(60));
    const started = sessions.count;
    const list = prefix(70);

    host.sync(list);

    expect(sessions.count).toBe(started + 1);
    expectReadyEqualsReplay(host, list);
  });

  it('goes to a cold build, without throwing, when the session it deferred cannot start', async () => {
    const { builder, host } = reopened(await leftBehind(60));
    const list = prefix(60);
    host.sync(list);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sessions.failNext = 1;

    try {
      host.viewShown();
      await settle();
      await settle();
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }

    expectReadyEqualsReplay(host, list);
    expect(builder.requests).toHaveLength(1);
  });

  it('goes to a cold build, without throwing, when the session an answer needs cannot start', async () => {
    const { builder, host } = reopened(await leftBehind(60));
    host.sync(prefix(60));
    const answered = prefix(61);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sessions.failNext = 1;

    try {
      expect(() => host.sync(answered)).not.toThrow();
      expect(host.view()?.status).toBe('restoring');
      await settle();
    } finally {
      logged.mockRestore();
    }

    expectReadyEqualsReplay(host, answered);
    expect(builder.requests).toHaveLength(1);
  });

  it('starts no session after a reset', async () => {
    const { host } = reopened(await leftBehind(60));
    const started = sessions.count;
    host.sync(prefix(60));

    host.viewShown();
    host.reset();
    await settle();

    expect(sessions.count).toBe(started);
    expect(host.view()).toBeNull();
  });

  it('starts one session, not two, when the list is restored before the deferred one starts', async () => {
    const { host } = reopened(await leftBehind(60));
    const started = sessions.count;
    const list = prefix(60);
    host.sync(list);

    host.viewShown();
    host.restore(list);
    await settle();

    expect(sessions.count).toBe(started + 1);
    expectReadyEqualsReplay(host, list);
  });
});

describe('the disorder the progress line reads (docs/ARCHITECTURE.md 6.12)', () => {
  it('is worked out when the page is idle after a build, not as part of the build', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(memoryBackend()) });

    host.sync(prefix(60));
    await settle();
    expect(host.view()).toMatchObject({ status: 'ready', disorder: null });

    await settle();
    expect(host.view()).toMatchObject({ status: 'ready', disorder: expect.any(Number) });
  });

  it('is carried by the view of the next answer, so the line does not blink out', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(memoryBackend()) });
    host.sync(prefix(60));
    await settle();
    await settle();
    const known = (host.view() as { disorder: number | null }).disorder;
    expect(known).not.toBeNull();

    host.sync(prefix(61));

    expect((host.view() as { disorder: number | null }).disorder).not.toBeNull();
  });

  it('is forgotten with the list', async () => {
    const host = createEngineHost({ builder: countingBuilder(), cache: createEngineCache(memoryBackend()) });
    host.sync(prefix(60));
    await settle();
    await settle();

    expect(host.view()).toMatchObject({ disorder: expect.any(Number) });
    host.forgetLists([]);
    host.reset();
    host.sync(prefix(60));

    expect(host.view()).toMatchObject({ status: 'ready', disorder: null });
  });
});
