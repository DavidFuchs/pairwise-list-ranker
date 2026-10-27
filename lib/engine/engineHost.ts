import { useEffect } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  type ColdBuilder,
  createColdBuilder,
  createSliceBuilder,
  createYielder,
} from '@/lib/engine/coldBuild';
import { createEngineCache, type EngineCache } from '@/lib/engine/engineCache';
import { toEngineList } from '@/lib/engine/engineList';
import { createReplayJob, EngineSession, type EngineState, replay } from '@/lib/ranking/bt/engine';
import { disorderOfState } from '@/lib/ranking/bt/progress';
import { countAnswers } from '@/lib/state/counts';
import { removedIds } from '@/lib/state/membership';
import { openSealed, openSealedEntry, sealSnapshot } from '@/lib/ranking/bt/sealed';
import type { SealedView } from '@/lib/ranking/bt/sealed';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';
import type { ListItem } from '@/types/list';
import type { EngineList, RankingEvent, StartingOrder } from '@/types/rankingEvents';
import type { RankedList } from '@/types/source';

/** What the ranking screens show for the open list: its ranking, or that a cold build is under way. */
export type EngineView =
  | {
      status: 'ready';
      listId: string;
      ranked: ListItem[];
      unrecognized: ListItem[];
      nextPair: [ListItem, ListItem] | null;
      answers: number;
      /**
       * How far the shown order may be from the one the answers describe
       * (expectedDisorder), or null when the engine's strengths are not at
       * hand: a view shown from a cached snapshot before its session starts,
       * or the arrival-order fallback.
       */
      disorder: number | null;
      /**
       * Set only on the last resort, when no replay worked: `ranked` is then
       * the active items in arrival order, not a ranking, and must not be
       * shown as one.
       */
      fallback?: 'arrival';
    }
  | { status: 'restoring'; listId: string };

export interface EngineHost {
  /** Call on every change to the open list; it picks the warm, undo, cached or cold path. */
  sync(list: RankedList): void;
  /** Drops the open session and opens the list from a cold build: the way back when a sync failed. */
  restore(list: RankedList): void;
  view(): EngineView | null;
  /**
   * The list's full displayed order, ranked then unrecognized, for export:
   * the ready view's when it shows this history, else the order
   * last shown for it, else (for a list that is not open) its cached snapshot,
   * and only when none of those fits a synchronous replay. Never throws: when
   * the replay fails it is the active items in arrival order.
   */
  rankingNow(list: RankedList): ListItem[];
  /** Saves the open session's sealed snapshot to the cache. */
  flushCache(): void;
  /** Drops cached snapshots of lists not named, such as lists no longer in the workspace. */
  pruneCache(keepListIds: string[]): void;
  /** Forgets the remembered orders of lists not named, such as lists no longer in the workspace. */
  forgetLists(keepListIds: string[]): void;
  /** Forgets the open list and any build under way. The cache stays: it is checked before use. */
  reset(): void;
  /**
   * A screen has put the current view on the page. An open that showed a
   * cached view and put its session off starts the session once the page is
   * idle, so the question is up before the session's work begins; until a
   * screen says so, the session starts only when something needs it.
   */
  viewShown(): void;
  /** The view as a store, for useEngineView. */
  readonly store: StoreApi<{ view: EngineView | null }>;
}

/** The open session saves itself after this many appends, so a crash loses at most this much warm work. */
const SAVE_EVERY_APPENDS = 50;

/**
 * Events a cached snapshot may leave for the main thread to replay. The saves
 * every 50 appends and on pagehide keep the usual gap well below it; a longer
 * one (a session file carrying more history than the cache) is a cold build.
 */
const MAX_CACHED_GAP = 100;

/**
 * Events one sync may append warm. Every action (an answer, a move, a mark or
 * a removal) adds one event, and no path produces two at once; 2 is a safety
 * margin for a sync that comes a change late. Anything longer is some other
 * change, such as a loaded session.
 */
const MAX_WARM_APPENDS = 2;

/** How long a last-resort replay on the main thread runs before it lets the browser in. */
const SLICE_MS = 12;

/** The part of an engine state the view and the remembered orders are made from. */
type ShownState = Pick<EngineState, 'ranked' | 'unrecognized' | 'nextPair'> &
  Partial<Pick<EngineState, 'strengths' | 'uncertainty' | 'eventCount' | 'fit' | 'slots'>>;

/**
 * The session for the open list, and the history it covers. A list opened
 * from a cached snapshot that carries its view shows that view at once and
 * starts its session afterwards (`session` is null meanwhile, and `deferred`
 * holds what starts it): the view is the state the session will be in.
 */
interface OpenList {
  listId: string;
  originalItemIds: readonly string[];
  startingOrder: StartingOrder;
  session: EngineSession | null;
  deferred: { engineList: EngineList; snapshot: EngineSnapshot; shown: SealedView } | null;
  /** Set once the deferred session is waiting for the page to paint, so it is only waited for once. */
  starting: boolean;
  /** Compared with each synced history by event id, so a replaced history is never taken for this one. */
  events: RankingEvent[];
  /** The items the view was built from, so an unchanged sync leaves the view alone. */
  shownItems: readonly ListItem[];
  appendsSinceSave: number;
}

/**
 * A list's displayed order, ranked then unrecognized, and the whole history
 * it is for, so it is never taken for a list that has changed since.
 */
interface KnownOrder {
  originalItemIds: readonly string[];
  startingOrder: StartingOrder;
  eventIds: string[];
  order: string[];
}

/** A cold build, and the whole history it is for. */
interface Build {
  key: string;
  listId: string;
  originalItemIds: readonly string[];
  startingOrder: StartingOrder;
  eventIds: string[];
}

/** Tags a cold build with the history it is for (the builder's key format). */
function buildKey(list: RankedList): string {
  const last = list.events[list.events.length - 1];
  return `${list.id}:${list.events.length}:${last?.id ?? ''}`;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((id, i) => id === b[i]));
}

/** The first `count` events of both histories are the same events. */
function samePrefix(a: readonly RankingEvent[], b: readonly RankingEvent[], count: number): boolean {
  for (let i = 0; i < count; i++) if (a[i]?.id !== b[i]?.id) return false;
  return true;
}

/**
 * The view a cached snapshot carried, if it can stand for the list: it names
 * no item twice, and every item it names is one of the list's. The snapshot
 * covers the list's whole history, so the view was made from exactly it; this
 * only keeps a view that names what the list does not have from being shown.
 * A view that does not fit is passed over, and the list opens with its session.
 */
function viewFitting(list: RankedList, shown: SealedView | null): SealedView | null {
  if (shown === null) return null;
  const known = new Set(list.items.map((item) => item.id));
  const listed = new Set<string>();
  for (const id of [...shown.ranked, ...shown.unrecognized]) {
    if (!known.has(id) || listed.has(id)) return null;
    listed.add(id);
  }
  for (const id of shown.nextPair ?? []) if (!known.has(id)) return null;
  return shown;
}

/** How long after a deferred session starts its first disorder waits, so an answer clicked meanwhile is not slowed by it. */
const FIRST_DISORDER_DELAY_MS = 500;

/**
 * Runs `run` when the page is idle: after what is queued has run and the
 * browser has painted. Where there is no idle callback, after the next paint.
 */
function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => run(), { timeout: 1000 });
  else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0));
  else setTimeout(run, 0);
}

/** Engine ids as the list's items, in the same order. `byId` is the list's items by id, when the caller has it. */
function itemsOf(
  list: RankedList,
  ids: readonly string[],
  byId: ReadonlyMap<string, ListItem> = new Map(list.items.map((item) => [item.id, item])),
): ListItem[] {
  const found: ListItem[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item !== undefined) found.push(item);
  }
  return found;
}

function isFor(build: Build, list: RankedList): boolean {
  return (
    build.listId === list.id &&
    build.startingOrder === list.initialStartingOrder &&
    sameIds(build.originalItemIds, list.originalItemIds) &&
    build.eventIds.length === list.events.length &&
    list.events.every((event, i) => event.id === build.eventIds[i])
  );
}

/** A cold replay in slices on the main thread, to its state; null once `current` says it is stale. */
async function slicedReplay(list: EngineList, current: () => boolean): Promise<EngineState | null> {
  const job = createReplayJob(list);
  const yielder = createYielder();
  try {
    while (!job.step(SLICE_MS)) {
      await yielder.next();
      if (!current()) return null;
    }
  } finally {
    yielder.close();
  }
  return job.state();
}

/** The list's active items in import order (docs/ARCHITECTURE.md 6.9): what is shown when no replay works. */
export function arrivalOrder(list: RankedList): ListItem[] {
  const removed = removedIds(list.events);
  return itemsOf(list, [...new Set(list.originalItemIds)]).filter((item) => !removed.has(item.id));
}

/** The last resort when no replay works: the active items in arrival order, with nothing to ask. */
function arrivalView(list: RankedList): EngineView {
  return {
    status: 'ready',
    listId: list.id,
    ranked: arrivalOrder(list),
    unrecognized: [],
    nextPair: null,
    answers: countAnswers(list.events),
    disorder: null,
    fallback: 'arrival',
  };
}

function readyView(list: RankedList, state: ShownState, disorder: number | null): EngineView {
  // One lookup serves all four lists: an answer builds this view with the whole item list in play.
  const byId = new Map(list.items.map((item) => [item.id, item]));
  const pair = state.nextPair && itemsOf(list, state.nextPair, byId);
  return {
    status: 'ready',
    listId: list.id,
    ranked: itemsOf(list, state.ranked, byId),
    unrecognized: itemsOf(list, state.unrecognized, byId),
    nextPair: pair?.length === 2 ? (pair as [ListItem, ListItem]) : null,
    answers: countAnswers(list.events),
    disorder,
  };
}

/**
 * Keeps one EngineSession for the open list in step with the store's history
 * (docs/ARCHITECTURE.md 6.5): an answer is appended warm, an undo of the last event is undone
 * warm, and anything else opens the list again, from a cached snapshot when
 * one fits and otherwise from a cold build, showing "restoring" meanwhile.
 * A fresh replay stays the canonical result (docs/ARCHITECTURE.md 6.6); every path here
 * equals it.
 */
export function createEngineHost(
  options: {
    builder?: ColdBuilder;
    /** Retries a failed build once; main-thread slices by default. */
    retryBuilder?: ColdBuilder;
    cache?: EngineCache;
  } = {},
): EngineHost {
  const builder = options.builder ?? createColdBuilder();
  const retryBuilder = options.retryBuilder ?? createSliceBuilder();
  const cache = options.cache ?? createEngineCache();
  const store = createStore<{ view: EngineView | null }>()(() => ({ view: null }));
  let open: OpenList | null = null;
  /** The cold build under way; a result applies only while it is still this one. */
  let pending: Build | null = null;
  /** The list last synced, which a finished build opens. */
  let latest: RankedList | null = null;

  /** What the open list shows: its session's state, or the view it opened with while the session waits. */
  function shownBy(current: OpenList): ShownState {
    return current.session !== null
      ? current.session.state
      : (current.deferred as { shown: SealedView }).shown;
  }

  /**
   * The disorder last worked out for each list, and the event count it was for.
   * Working it out takes milliseconds on a long list, and it changes slowly, so
   * it is never worked out as part of an answer: a view carries the last value,
   * and a fresh one is worked out when the page is idle, about every n/50
   * events, and shown only once it has moved enough to change what is drawn.
   */
  const disorders = new Map<string, { value: number; at: number }>();
  const refreshing = new Set<string>();

  /** The disorder to the nearest 0.002: a smaller move does not change a level or when one is left. */
  const coarsely = (value: number): number => Math.round(value / 0.002);

  function refreshDisorder(listId: string, state: ShownState, delayMs = 0): void {
    if (state.fit === undefined || refreshing.has(listId)) return;
    const known = disorders.get(listId);
    const every = Math.max(1, Math.ceil(state.ranked.length / 50));
    if (
      known !== undefined &&
      state.eventCount !== undefined &&
      Math.abs(state.eventCount - known.at) < every
    ) {
      return;
    }
    refreshing.add(listId);
    const work = (): void => {
      refreshing.delete(listId);
      const value = disorderOfState(state);
      if (value === null) return;
      disorders.set(listId, { value, at: state.eventCount ?? 0 });
      const view = store.getState().view;
      if (view?.status !== 'ready' || view.listId !== listId) return;
      if (view.disorder === null || coarsely(view.disorder) !== coarsely(value)) {
        store.setState({ view: { ...view, disorder: value } });
      }
    };
    // A delay lets a first answer clicked right after the open run before this work does.
    if (delayMs > 0) setTimeout(() => whenIdle(work), delayMs);
    else whenIdle(work);
  }

  /** Puts the state on the page as the list's ready view, with the disorder known so far. */
  function publish(list: RankedList, state: ShownState): void {
    store.setState({ view: readyView(list, state, disorders.get(list.id)?.value ?? null) });
    refreshDisorder(list.id, state);
  }

  function show(list: RankedList): void {
    if (open === null) return;
    open.shownItems = list.items;
    publish(list, shownBy(open));
  }

  /**
   * Each list's last order, by list id, so export needs no replay for a list
   * that is not open (docs/ARCHITECTURE.md 6.11). In memory only, one entry a
   * list. It takes none of the storage quota, so pruneCache leaves it alone;
   * forgetLists drops the lists the workspace no longer has.
   */
  const known = new Map<string, KnownOrder>();

  function remember(
    listId: string,
    history: {
      originalItemIds: readonly string[];
      startingOrder: StartingOrder;
      events: readonly RankingEvent[];
    },
    state: ShownState,
  ): void {
    known.set(listId, {
      originalItemIds: [...history.originalItemIds],
      startingOrder: history.startingOrder,
      eventIds: history.events.map((event) => event.id),
      order: [...state.ranked, ...state.unrecognized],
    });
  }

  /** The order last known for exactly this history, if any. */
  function recall(list: RankedList): string[] | null {
    const entry = known.get(list.id);
    if (
      entry === undefined ||
      entry.startingOrder !== list.initialStartingOrder ||
      !sameIds(entry.originalItemIds, list.originalItemIds) ||
      entry.eventIds.length !== list.events.length ||
      !list.events.every((event, i) => event.id === entry.eventIds[i])
    ) {
      return null;
    }
    return entry.order;
  }

  /**
   * The list's state from its cached snapshot, opened as a session would be:
   * no longer than the final fits, and the same result as replay. Null when
   * no snapshot fits the history closely enough.
   */
  function cachedState(list: EngineList, listId: string): EngineState | null {
    const snapshot = openSealed(list, cache.load(listId));
    if (snapshot === null || list.events.length - snapshot.eventIds.length > MAX_CACHED_GAP) return null;
    try {
      // A replay from the snapshot is the canonical result, without a session's undo bookkeeping.
      return replay(list, { snapshot });
    } catch {
      return null;
    }
  }

  /** `alsoKeep` is a list that is about to be read, whose entry making room must not take. */
  function save(alsoKeep?: string): void {
    if (open === null) return;
    open.appendsSinceSave = 0;
    // A session still to start has changed nothing since the entry it opened from was written.
    if (open.session === null) return;
    const snapshot = open.session.exportSnapshot();
    if (snapshot === null) return;
    const { ranked, unrecognized, nextPair } = open.session.state;
    const sealed = sealSnapshot(snapshot, { ranked, unrecognized, nextPair });
    // The open list's entry matters most, so other lists' entries make room for it.
    if (!cache.save(open.listId, sealed)) {
      cache.prune(alsoKeep === undefined ? [open.listId] : [open.listId, alsoKeep]);
      cache.save(open.listId, sealed);
    }
  }

  /** Keeps what the open list had, in memory and in the cache, as it stops being open. */
  function leave(incomingListId: string): void {
    if (open === null) return;
    remember(open.listId, open, shownBy(open));
    save(incomingListId);
  }

  function cancelPending(): void {
    if (pending !== null) {
      builder.cancel(pending.key);
      retryBuilder.cancel(pending.key);
    }
    pending = null;
  }

  /** `engineList` is the list's engine form when the caller has one a snapshot was validated against. */
  function startSession(list: RankedList, snapshot?: EngineSnapshot, engineList?: EngineList): void {
    open = {
      listId: list.id,
      originalItemIds: list.originalItemIds,
      startingOrder: list.initialStartingOrder,
      session: new EngineSession(
        engineList ?? toEngineList(list),
        snapshot === undefined ? {} : { snapshot },
      ),
      deferred: null,
      starting: false,
      events: [...list.events],
      shownItems: list.items,
      appendsSinceSave: 0,
    };
    show(list);
  }

  /**
   * The open list's session, started now if the open put it off. Null when it
   * cannot start, after the list has gone to a cold build instead.
   */
  function sessionOf(current: OpenList, list: RankedList): EngineSession | null {
    if (current.session !== null) return current.session;
    const { engineList, snapshot } = current.deferred as NonNullable<OpenList['deferred']>;
    try {
      current.session = new EngineSession(engineList, { snapshot });
    } catch (error) {
      console.error('The ranking could not be opened from its saved snapshot; restoring it instead.', error);
      coldBuild(list);
      return null;
    }
    current.deferred = null;
    return current.session;
  }

  /**
   * Opens a list from a cached snapshot that covers its whole history and
   * carries the view it showed: the list shows that view now, and its session
   * starts once a screen has shown it and the page is idle (viewShown), or
   * sooner, when something needs it.
   */
  function startDeferred(
    list: RankedList,
    snapshot: EngineSnapshot,
    shown: SealedView,
    engineList: EngineList,
  ): void {
    const started: OpenList = {
      listId: list.id,
      originalItemIds: list.originalItemIds,
      startingOrder: list.initialStartingOrder,
      session: null,
      deferred: { engineList, snapshot, shown },
      starting: false,
      events: [...list.events],
      shownItems: list.items,
      appendsSinceSave: 0,
    };
    open = started;
    show(list);
  }

  /** Path 4: show "restoring" and replay off the main thread. Nothing half-built is shown meanwhile. */
  function coldBuild(list: RankedList): void {
    cancelPending();
    open = null;
    const build: Build = {
      key: buildKey(list),
      listId: list.id,
      originalItemIds: list.originalItemIds,
      startingOrder: list.initialStartingOrder,
      eventIds: list.events.map((event) => event.id),
    };
    pending = build;
    store.setState({ view: { status: 'restoring', listId: list.id } });
    runBuild(build, toEngineList(list)).catch((error: unknown) => {
      // Not reached in practice: runBuild handles its own failures. Kept so nothing is ever unhandled.
      console.error('The ranking could not be restored.', error);
    });
  }

  /**
   * Runs a cold build to the end, never leaving the view on "restoring": a
   * failed build is retried once in slices; if that fails too, a sliced replay
   * shows the ranking with no session behind it; if even that fails, the list
   * shows in arrival order. Each step stops as soon as the build is stale.
   */
  async function runBuild(build: Build, list: EngineList): Promise<void> {
    const current = (): boolean => pending === build;
    const request = { key: build.key, list };
    let snapshot = await builder.build(request).catch(() => null);
    if (!current()) return;
    let failure: unknown;
    snapshot ??= await retryBuilder.build(request).catch((error: unknown) => {
      failure = error;
      return null;
    });
    if (!current() || latest === null) return;
    if (snapshot !== null) {
      try {
        startSession(latest, snapshot);
        pending = null;
        save();
        return;
      } catch (error) {
        failure = error;
      }
    }
    console.error('The ranking could not be restored from a cold build; replaying it instead.', failure);
    const state = await slicedReplay(list, current).catch(() => null);
    if (!current() || latest === null) return;
    pending = null;
    open = null;
    if (state === null) store.setState({ view: arrivalView(latest) });
    else publish(latest, state);
  }

  /** Paths 3 and 4, for a new list or a history that changed other than at its end. */
  function reopen(list: RankedList): void {
    if (pending !== null && isFor(pending, list)) return;
    if (list.events.length === 0) {
      cancelPending();
      startSession(list);
      return;
    }
    const engineList = toEngineList(list);
    const cached = openSealedEntry(engineList, cache.load(list.id));
    if (cached !== null && list.events.length - cached.snapshot.eventIds.length <= MAX_CACHED_GAP) {
      cancelPending();
      try {
        const shown =
          cached.snapshot.eventIds.length === list.events.length ? viewFitting(list, cached.shown) : null;
        if (shown === null) startSession(list, cached.snapshot, engineList);
        else startDeferred(list, cached.snapshot, shown, engineList);
        return;
      } catch (error) {
        console.error(
          'The ranking could not be opened from its saved snapshot; restoring it instead.',
          error,
        );
      }
    }
    coldBuild(list);
  }

  /**
   * Paths 1 and 2, and a sync that left the history as it was. False when the
   * history changed some other way.
   */
  function syncWarm(current: OpenList, list: RankedList): boolean {
    const had = current.events.length;
    const has = list.events.length;
    if (has === had && samePrefix(current.events, list.events, has)) {
      if (list.items !== current.shownItems) show(list);
      return true;
    }
    const appending =
      has > had && has - had <= MAX_WARM_APPENDS && samePrefix(current.events, list.events, had);
    const undoing = has === had - 1 && samePrefix(current.events, list.events, has);
    // Any other change opens the list again, so a session put off is not started for it.
    if (!appending && !undoing) return false;
    const session = sessionOf(current, list);
    if (session === null) return true;
    const misses = session.nonConverged;
    if (appending) {
      for (const event of list.events.slice(had)) {
        try {
          session.append(event);
        } catch (error) {
          // The session may be half-stepped, so it is dropped and a cold build replays from the history.
          console.error('The answer could not be added to the open ranking; restoring it instead.', error);
          coldBuild(list);
          return true;
        }
        current.events.push(event);
        current.appendsSinceSave++;
      }
    } else {
      // An undo with no snapshot or nearby checkpoint would replay on the main thread.
      if (!session.canUndoWarm()) {
        coldBuild(list);
        return true;
      }
      try {
        session.undo();
      } catch (error) {
        // As with an append, the session may be half-stepped.
        console.error('The last step could not be taken back warm; restoring the ranking instead.', error);
        coldBuild(list);
        return true;
      }
      current.events.pop();
    }
    // A solver miss (docs/ARCHITECTURE.md 6.5) leaves the warm state unproven, so the step finishes as a cold build.
    if (session.nonConverged > misses) {
      coldBuild(list);
      return true;
    }
    show(list);
    if (current.appendsSinceSave >= SAVE_EVERY_APPENDS) save();
    return true;
  }

  /** What the open list shows when it covers exactly this list's history. */
  function stateFor(list: RankedList): ShownState | null {
    if (
      open === null ||
      open.listId !== list.id ||
      open.startingOrder !== list.initialStartingOrder ||
      !sameIds(open.originalItemIds, list.originalItemIds) ||
      open.events.length !== list.events.length ||
      !samePrefix(open.events, list.events, list.events.length)
    ) {
      return null;
    }
    return shownBy(open);
  }

  return {
    store,

    sync(list) {
      latest = list;
      if (open !== null && open.listId !== list.id) leave(list.id);
      const current = open;
      const sameList =
        current !== null &&
        current.listId === list.id &&
        current.startingOrder === list.initialStartingOrder &&
        sameIds(current.originalItemIds, list.originalItemIds);
      if (sameList && syncWarm(current, list)) return;
      open = null;
      reopen(list);
    },

    restore(list) {
      latest = list;
      coldBuild(list);
    },

    view() {
      return store.getState().view;
    },

    rankingNow(list) {
      const state = stateFor(list);
      if (state !== null) return itemsOf(list, [...state.ranked, ...state.unrecognized]);
      const order = recall(list);
      if (order !== null) return itemsOf(list, order);
      try {
        const engineList = toEngineList(list);
        // The open list while it restores had no cached snapshot close enough to open from.
        const isOpen = latest?.id === list.id;
        const fresh = (isOpen ? null : cachedState(engineList, list.id)) ?? replay(engineList);
        remember(list.id, engineList, fresh);
        return itemsOf(list, [...fresh.ranked, ...fresh.unrecognized]);
      } catch (error) {
        // Working out a ranking for the list's items must never fail: the items in
        // arrival order, as the screen shows them when no replay works.
        console.error('The ranking could not be worked out; using the order the items arrived in.', error);
        return arrivalOrder(list);
      }
    },

    flushCache() {
      save();
    },

    pruneCache(keepListIds) {
      cache.prune(keepListIds);
    },

    forgetLists(keepListIds) {
      const keep = new Set(keepListIds);
      for (const listId of known.keys()) if (!keep.has(listId)) known.delete(listId);
      for (const listId of disorders.keys()) if (!keep.has(listId)) disorders.delete(listId);
    },

    viewShown() {
      const current = open;
      if (current === null || current.deferred === null || current.starting) return;
      current.starting = true;
      whenIdle(() => {
        if (open !== current || latest === null) return;
        const session = sessionOf(current, latest);
        if (session === null) return;
        // The session's state is the view's, apart from the disorder a snapshot's view lacks (the
        // progress line reads it, docs/ARCHITECTURE.md 6.12): worked out next, and shown once it is.
        refreshDisorder(latest.id, session.state, FIRST_DISORDER_DELAY_MS);
      });
    },

    reset() {
      cancelPending();
      open = null;
      latest = null;
      disorders.clear();
      store.setState({ view: null });
    },
  };
}

/** The app's host: cold builds in a worker where there is one, snapshots in localStorage. */
export const engineHost: EngineHost = createEngineHost();

/** The open list's engine view, re-rendering when it changes. */
export function useEngineView(host: EngineHost = engineHost): EngineView | null {
  const view = useStore(host.store, (state) => state.view);
  // A ready view that has been rendered is the question on the page; see EngineHost.viewShown.
  useEffect(() => {
    if (view?.status === 'ready') host.viewShown();
  }, [view, host]);
  return view;
}
