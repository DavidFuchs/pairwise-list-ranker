import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { engineHost } from '@/lib/engine/engineHost';
import type { EngineHost } from '@/lib/engine/engineHost';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { orderBySortField } from '@/lib/import/sortField';
import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { SaveOutcome, WorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { activeList, allLists, listAt, withList } from '@/lib/state/lists';
import { placementBetween, unrecognizedIds } from '@/lib/state/placement';
import { isItemActive } from '@/lib/state/membership';
import type { ListItem } from '@/types/list';
import type { PairOutcome, RankingEvent, RecordedEvent, StartingOrder } from '@/types/rankingEvents';
import type {
  DataSource,
  FieldRoles,
  ListConfig,
  PreviewTab,
  RankedList,
  SortSpec,
  UndoStep,
  Workspace,
} from '@/types/source';

export interface ListStoreOptions {
  storage?: WorkspaceStorage;
  now?: () => string;
  createId?: () => string;
  /**
   * A save writes only the parts of the workspace that changed, but a burst of
   * clicks on a large list still has no need of one each. A positive delay
   * batches writes to at most one per interval; zero (the default) saves on
   * every change.
   */
  saveDelayMs?: number;
  /** Keeps the open list's ranking; the app-wide engineHost by default. */
  host?: EngineHost;
}

/** One step the user can take back (docs/ARCHITECTURE.md 10.3). */
export type UndoEntry = UndoStep;

const MAX_UNDO = 200;

/**
 * A saved workspace, split into the workspace the store holds and the steps
 * back it offers: the last action, whatever its kind (docs/ARCHITECTURE.md 10.3). Steps further
 * back lived in memory and are gone.
 */
function opened(saved: Workspace): { workspace: Workspace; undoStack: UndoEntry[] } {
  const { lastAction, ...workspace } = saved;
  return { workspace, undoStack: lastAction === undefined ? [] : [lastAction] };
}

/**
 * Where the step Undo would take back belongs: the open list, another list
 * (named by its path), or nowhere. Undo acts only on a step that changed the
 * open list, so pressing it never changes a list the user cannot see.
 */
export function undoOffer(state: Pick<ListState, 'workspace' | 'undoStack'>): 'here' | string[] | null {
  const { workspace, undoStack } = state;
  const step = undoStack.at(-1);
  if (workspace === null || step === undefined) return null;
  if (step.listIds.includes(activeList(workspace).id)) return 'here';
  const other = allLists(workspace).find((list) => step.listIds.includes(list.id));
  return other === undefined ? null : other.arrayPath;
}

/** What the list setup screen hands over when the user commits their choices. */
export interface StartInput {
  source: DataSource;
  roles: FieldRoles;
  /** How well ordered the imported list already was; defaults to unordered. */
  startingOrder?: StartingOrder;
  /**
   * Orders the starting prior by a field. A list given one always starts as
   * roughly in order, whatever startingOrder says.
   */
  sort?: SortSpec;
  /**
   * False when this setup was derived from the document defaults rather than
   * chosen - the switcher's one-press path. Anything arriving from the setup
   * screen is the user's own answer, so it defaults to true.
   */
  configuredExplicitly?: boolean;
}

export interface ListState {
  /** The document and every list opened in it; see activeList for the open one. */
  workspace: Workspace | null;
  previewTab: PreviewTab;
  persistenceAvailable: boolean;
  /** Why the last save did or did not happen, for the status line. */
  saveOutcome: SaveOutcome | null;
  lastSavedAt?: string;
  hydrated: boolean;
  /**
   * Another tab saved the workspace. 'refreshed': this tab was hidden and has
   * taken the new copy before being seen. 'waiting': this tab is in front, so
   * it asks before swapping the screen, and until answered a save of its own
   * would overwrite the other tab's.
   */
  externalChange: 'none' | 'refreshed' | 'waiting';
  /** The workspace's steps back, newest last. Only the newest is saved, so only it survives a reload. */
  undoStack: UndoEntry[];

  hydrate(): void;
  /** Takes the copy another tab saved, dropping any save still waiting on its delay. */
  reloadFromStorage(): void;
  /** Keeps this tab's copy and writes it now, over the other tab's. */
  keepThisTab(): void;
  /** Clears the notice that a hidden tab refreshed itself. */
  dismissExternalChange(): void;
  startRanking(input: StartInput): void;
  /**
   * Moves to a different list in the same document. Every list opened stays in
   * the workspace, so moving back and forth between lists never loses
   * anything, and a list visited before comes back exactly as it was.
   */
  switchList(input: StartInput): void;
  /**
   * Rewrites the answer every list not set up by hand follows. It takes effect
   * at once and on its own: those lists read their setup from here rather than
   * storing a copy, so nothing has to be rewritten list by list. The list being
   * edited is untouched - setting a default is not applying it.
   */
  setListDefaults(config: ListConfig): void;
  /**
   * Changes how the open list's cards are drawn. Fields are a view of the data,
   * not an answer, so this records no event and no step back, and the ranking
   * is untouched.
   */
  setListRoles(roles: FieldRoles): void;
  /** A hand-arranged position is recorded as one placement between the item's new neighbours. */
  reorderItem(itemId: string, nextOrder: string[]): void;
  /** "Don't recognize" (docs/ARCHITECTURE.md 6.9): one action, one `unrecognized` event for every item named. */
  markUnrecognized(itemIds: string[]): void;
  setPreviewTab(tab: PreviewTab): void;
  recordComparison(leftItemId: string, rightItemId: string, outcome: PairOutcome): void;
  removeItem(itemId: string): void;
  /** Takes back the last comparison, reorder or removal. */
  undo(): void;
  /** The whole session as it stands, for a session file; null with nothing loaded. */
  snapshot(): WorkspaceSnapshot | null;
  /** Replaces everything with a saved session, ready to carry on ranking. */
  loadSession(session: WorkspaceSnapshot): void;
  /** Writes any save still waiting on the delay. */
  flush(): void;
  reset(): void;
}

export type ListStore = StoreApi<ListState>;

type PairEvent = Extract<RankingEvent, { kind: 'pair' }>;
type UnrecognizedEvent = Extract<RankingEvent, { kind: 'unrecognized' }>;
type PlacementEvent = Extract<RankingEvent, { kind: 'placement' }>;
type RemovalEvent = Extract<RankingEvent, { kind: 'removal' }>;
type EventStamp = 'id' | 'listId' | 'createdAt';
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function defaultCreateId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createListStore(options: ListStoreOptions = {}): ListStore {
  const storage = options.storage ?? createWorkspaceStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? defaultCreateId;
  const saveDelayMs = options.saveDelayMs ?? 0;
  const host = options.host ?? engineHost;

  const store = createStore<ListState>()((set, get) => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    /** Another tab saved while this one was hidden. */
    let refreshWhenShown = false;

    function cancelPendingSave(): void {
      if (saveTimer === null) return;
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    /** Browser persistence is a convenience, never the system of record. */
    function persist(): void {
      if (saveDelayMs <= 0) {
        writeSnapshot();
        return;
      }
      // The write reads the latest state when it fires, so one pending timer
      // covers every change made while it waits.
      if (saveTimer === null) {
        saveTimer = setTimeout(() => {
          saveTimer = null;
          writeSnapshot();
        }, saveDelayMs);
      }
    }

    /** Everything worth keeping, as the browser save and a session file both hold it. */
    function buildSnapshot(): WorkspaceSnapshot | null {
      const { workspace, previewTab } = get();
      if (workspace === null) return null;
      const lastAction = get().undoStack.at(-1);
      return {
        version: WORKSPACE_VERSION,
        workspace: lastAction === undefined ? workspace : { ...workspace, lastAction },
        ui: { previewTab },
      };
    }

    function writeSnapshot(): void {
      const snapshot = buildSnapshot();
      if (snapshot === null) {
        storage.clear();
        return;
      }

      let outcome = storage.save(snapshot);
      // The workspace save is the system of record and the engine cache only a
      // speed-up, so when space runs out the cache gives way: first the entries
      // of lists that are not open, then the open list's too, trying the save
      // again after each.
      if (outcome === 'too-large') {
        host.pruneCache([activeList(snapshot.workspace).id]);
        outcome = storage.save(snapshot);
      }
      if (outcome === 'too-large') {
        host.pruneCache([]);
        outcome = storage.save(snapshot);
      }
      set({ saveOutcome: outcome, ...(outcome === 'saved' ? { lastSavedAt: now() } : {}) });
    }

    function pushUndo(entry: UndoEntry): UndoEntry[] {
      return [...get().undoStack, entry].slice(-MAX_UNDO);
    }

    if (typeof window !== 'undefined') {
      // A save still waiting when the page goes away would be lost, and so
      // would the engine's warm work since its last snapshot, which makes the
      // next open a cold build. The workspace goes first: it is the record.
      const leaving = () => {
        if (saveTimer !== null) {
          cancelPendingSave();
          writeSnapshot();
        }
        host.flushCache();
      };
      window.addEventListener('pagehide', leaving);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          leaving();
          return;
        }
        // Switching back to a tab another one has saved over: take the new copy before any click lands on the old.
        if (refreshWhenShown) {
          refreshWhenShown = false;
          if (applyStored()) set({ externalChange: 'refreshed' });
        }
      });
    }

    /**
     * The saved copy replaces this tab's, if there is a readable one: an
     * unreadable save (another tab mid-commit) leaves what is in memory alone.
     */
    function applyStored(): boolean {
      const snapshot = storage.load();
      if (snapshot === null) return false;
      cancelPendingSave();
      set({ ...opened(snapshot.workspace), previewTab: snapshot.ui.previewTab });
      return true;
    }

    // Before hydrate there is nothing stale, and hydrate reads what is saved.
    storage.watch(() => {
      if (!get().hydrated) return;
      // A hidden tab flushed its own save on the way out, so nothing is lost by waiting to refresh it.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        refreshWhenShown = true;
        return;
      }
      set({ externalChange: 'waiting' });
    });

    /** The open list, with nothing loaded meaning nothing to change. */
    function current(): { workspace: Workspace; list: RankedList } | null {
      const { workspace } = get();
      return workspace === null ? null : { workspace, list: activeList(workspace) };
    }

    /** Puts the open list back changed, and saves. */
    function commitList(workspace: Workspace, list: RankedList, extra: Partial<ListState> = {}): void {
      set({ workspace: withList(workspace, list), ...extra });
      persist();
    }

    /** A new history entry, stamped with its id, the action that recorded it, and the time. */
    function makeEvent<E extends RankingEvent>(
      listId: string,
      actionId: string,
      body: DistributiveOmit<E, EventStamp>,
    ): E & RecordedEvent {
      return { id: createId(), actionId, listId, createdAt: now(), ...body } as unknown as E & RecordedEvent;
    }

    /** Appends one action's events to the open list, as one step back. */
    function record(workspace: Workspace, list: RankedList, actionId: string, events: RecordedEvent[]): void {
      commitList(
        workspace,
        { ...list, events: [...list.events, ...events] },
        { undoStack: pushUndo({ actionId, listIds: [list.id] }) },
      );
    }

    function makeItem(listId: string, value: unknown): ListItem {
      const timestamp = now();
      return {
        id: createId(),
        listId,
        value: value as ListItem['value'],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    /** The items' ids in the sort's order, or in item order without one. */
    function inOrder(items: ListItem[], entries: unknown[], sort: SortSpec | undefined): string[] {
      if (sort === undefined) return items.map((item) => item.id);
      return orderBySortField(entries, sort).map((index) => items[index]!.id);
    }

    /**
     * A visited list with no answers takes the order and sort it is set up
     * with now; its ids are put back in the new order from the values it holds.
     */
    function withNewOrder(
      visited: RankedList,
      startingOrder: StartingOrder,
      sort: SortSpec | undefined,
    ): RankedList {
      const { initialSort: _old, ...rest } = visited;
      const entries = visited.items.map((item) => item.value);
      return {
        ...rest,
        initialStartingOrder: sort === undefined ? startingOrder : 'rough',
        ...(sort === undefined ? {} : { initialSort: sort }),
        originalItemIds: inOrder(visited.items, entries, sort),
      };
    }

    /** A list seen for the first time: its entries become fresh items, with no history. */
    function makeList(
      source: DataSource,
      roles: FieldRoles,
      startingOrder: StartingOrder,
      configuredExplicitly: boolean,
      sort?: SortSpec,
    ): RankedList {
      const id = createId();
      const timestamp = now();
      const entries = entriesAtPath(source.document, source.arrayPath);
      const items = entries.map((entry) => makeItem(id, entry));
      return {
        id,
        arrayPath: source.arrayPath,
        roles,
        initialStartingOrder: sort === undefined ? startingOrder : 'rough',
        ...(sort === undefined ? {} : { initialSort: sort }),
        configuredExplicitly,
        // An item's index here is its arrivalIndex for good, so it is fixed now.
        // A sorted list takes it in field order; items stay in document order.
        originalItemIds: inOrder(items, entries, sort),
        items,
        events: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    return {
      workspace: null,
      previewTab: 'ranked',
      persistenceAvailable: storage.available,
      saveOutcome: null,
      hydrated: false,
      externalChange: 'none',
      undoStack: [],

      reloadFromStorage() {
        applyStored();
        set({ externalChange: 'none' });
      },

      keepThisTab() {
        set({ externalChange: 'none' });
        persist();
      },

      dismissExternalChange() {
        set({ externalChange: 'none' });
      },

      hydrate() {
        // Memory is ahead of storage whenever a save is waiting on its delay,
        // so reading storage back after the first load would throw away the
        // user's latest change - every screen calls this as it mounts.
        if (get().hydrated) return;

        const snapshot = storage.load();
        if (snapshot === null) {
          set({ hydrated: true });
          return;
        }
        set({ ...opened(snapshot.workspace), previewTab: snapshot.ui.previewTab, hydrated: true });
      },

      /** A fresh document: one new list, no history to carry over. */
      startRanking({ source, roles, startingOrder = 'unordered', sort }: StartInput) {
        const timestamp = now();
        const list = makeList(source, roles, startingOrder, true, sort);
        const workspace: Workspace = {
          source,
          // The first list the user sets up defines what the rest of the
          // document inherits, so there is never a document without an answer.
          // A sort belongs to the list it was chosen for, not to the document.
          listDefaults: { roles, startingOrder: sort === undefined ? startingOrder : 'unordered' },
          lists: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        // The old list is gone, so the host must not save it on the way out.
        host.reset();
        set({ workspace: withList(workspace, list), previewTab: 'ranked', undoStack: [] });
        persist();
      },

      switchList({
        source,
        roles,
        startingOrder = 'unordered',
        sort,
        configuredExplicitly = true,
      }: StartInput) {
        const { workspace } = get();
        if (workspace === null) {
          get().startRanking({ source, roles, startingOrder, sort });
          return;
        }

        const timestamp = now();
        const visited = listAt(workspace, source.arrayPath);
        // Coming back from the rank screen's switcher names no sort, and a
        // starting order is fixed once a list is created: a sorted list with
        // no answers yet keeps the one it began with. Only a deliberate
        // choice (setup's Save) re-applies an order to a list with no history.
        const passive = configuredExplicitly === false && sort === undefined;
        const keepsOwnSort = visited !== undefined && passive && visited.initialSort !== undefined;
        const list: RankedList =
          visited === undefined
            ? makeList(source, roles, startingOrder, configuredExplicitly, sort)
            : {
                ...(visited.events.length === 0 && !keepsOwnSort
                  ? withNewOrder(visited, startingOrder, sort)
                  : visited),
                // The caller resolved these against the defaults already, so a
                // list never set up by hand picks up any card change made since
                // it was last open - see selectListConfig. Its starting order
                // is its own once it has history.
                roles,
                // Once a list is the user's own answer, coming back to it from
                // the switcher must not quietly hand it back to the defaults.
                configuredExplicitly: visited.configuredExplicitly || configuredExplicitly,
                updatedAt: timestamp,
              };

        set({
          workspace: withList({ ...workspace, source, updatedAt: timestamp }, list),
          previewTab: 'ranked',
          // Switching is not an action: the steps back stay, each with the list it belongs to.
        });
        persist();
      },

      setListDefaults(listDefaults: ListConfig) {
        const workspace = get().workspace;
        if (workspace === null) return;

        set({ workspace: { ...workspace, listDefaults, updatedAt: now() } });
        persist();
      },

      setListRoles(roles: FieldRoles) {
        const open = current();
        if (open === null) return;

        // Chosen by hand now, so the document defaults no longer stand in for it.
        commitList(open.workspace, { ...open.list, roles, configuredExplicitly: true, updatedAt: now() });
      },

      /**
       * A hand-arranged position becomes one placement that records both
       * neighbours it now sits between, so it is the same kind of evidence a
       * side-by-side pick is, rather than discarding what has been answered.
       * A neighbour that is not active is dropped: a position against a
       * removed item means nothing. So is one marked "don't recognize": a
       * placement measures positions among the items shown ranked (docs/ARCHITECTURE.md 6.9).
       */
      reorderItem(itemId: string, nextOrder: string[]) {
        const open = current();
        if (open === null) return;
        const { workspace, list } = open;

        const index = nextOrder.indexOf(itemId);
        if (index < 0 || !isItemActive(list, itemId)) return;

        const above = nextOrder[index - 1];
        const below = nextOrder[index + 1];
        const marked = unrecognizedIds(list.events);
        const visible = (id: string | undefined) =>
          id !== undefined && isItemActive(list, id) && !marked.has(id) ? id : undefined;
        const aboveItemId = visible(above);
        const belowItemId = visible(below);

        const placement = placementBetween(itemId, aboveItemId, belowItemId);
        if (placement === null) return;
        const actionId = createId();
        record(workspace, list, actionId, [
          makeEvent<PlacementEvent>(list.id, actionId, { kind: 'placement', ...placement }),
        ]);
      },

      markUnrecognized(itemIds: string[]) {
        const open = current();
        if (open === null) return;
        const { workspace, list } = open;
        const marked = unrecognizedIds(list.events);
        const fresh = [...new Set(itemIds)].filter((id) => isItemActive(list, id) && !marked.has(id));
        if (fresh.length === 0) return;

        const actionId = createId();
        record(workspace, list, actionId, [
          makeEvent<UnrecognizedEvent>(list.id, actionId, { kind: 'unrecognized', itemIds: fresh }),
        ]);
      },

      setPreviewTab(tab: PreviewTab) {
        set({ previewTab: tab });
        persist();
      },

      recordComparison(leftItemId: string, rightItemId: string, outcome: PairOutcome) {
        const open = current();
        if (open === null || leftItemId === rightItemId) return;
        const { workspace, list } = open;
        if (!isItemActive(list, leftItemId) || !isItemActive(list, rightItemId)) return;

        const actionId = createId();
        record(workspace, list, actionId, [
          makeEvent<PairEvent>(list.id, actionId, { kind: 'pair', leftItemId, rightItemId, outcome }),
        ]);
      },

      /** Deleting never records an answer: the item leaves, and keeps its evidence. */
      removeItem(itemId: string) {
        const open = current();
        if (open === null) return;
        const { workspace, list } = open;
        if (!isItemActive(list, itemId)) return;

        const actionId = createId();
        record(workspace, list, actionId, [
          makeEvent<RemovalEvent>(list.id, actionId, { kind: 'removal', itemIds: [itemId] }),
        ]);
      },

      undo() {
        const { workspace, undoStack } = get();
        const entry = undoStack.at(-1);
        if (workspace === null || entry === undefined || undoOffer(get()) !== 'here') return;

        // Every event the action recorded goes, from every list that holds one.
        let next: Workspace = workspace;
        for (const list of allLists(workspace)) {
          if (!entry.listIds.includes(list.id)) continue;
          next = withList(next, {
            ...list,
            events: list.events.filter((event) => event.actionId !== entry.actionId),
          });
        }
        set({ workspace: next, undoStack: undoStack.slice(0, -1) });
        persist();
      },

      snapshot() {
        return buildSnapshot();
      },

      loadSession(session: WorkspaceSnapshot) {
        cancelPendingSave();
        // Nothing of the list open before carries over.
        host.reset();
        set({
          // Steps from before belong to the workspace being replaced; the
          // loaded one offers its own last step.
          ...opened(session.workspace),
          previewTab: session.ui.previewTab,
          // Loaded on purpose, so a later hydrate should not second-guess it.
          hydrated: true,
        });
        // Synced here as well as by the subscription, which sees no change
        // when the session is the very workspace already loaded.
        syncHost(host, activeList(session.workspace));
        persist();
      },

      flush() {
        if (saveTimer === null) return;
        cancelPendingSave();
        writeSnapshot();
      },

      reset() {
        set({
          workspace: null,
          previewTab: 'ranked',
          saveOutcome: null,
          lastSavedAt: undefined,
          externalChange: 'none',
          undoStack: [],
        });
        cancelPendingSave();
        storage.clear();
        // Starting over leaves no list for a snapshot to speed up.
        host.reset();
        host.pruneCache([]);
      },
    };
  });

  followOpenList(store, host);
  return store;
}

/**
 * Keeps the engine host on the open list (docs/ARCHITECTURE.md 6.5): every change to it is
 * synced, so an answer or an undo is a warm step. The cache keeps a snapshot
 * for every list in the workspace, so export needs no replay for
 * the lists that are not open; the workspace save prunes them when it needs
 * the room.
 */
function followOpenList(store: ListStore, host: EngineHost): void {
  let openListId: string | null = null;
  store.subscribe((state, previous) => {
    if (state.workspace === previous.workspace) return;
    if (state.workspace === null) {
      openListId = null;
      return;
    }
    const list = activeList(state.workspace);
    if (list.id !== openListId) {
      openListId = list.id;
      const listIds = allLists(state.workspace).map((each) => each.id);
      host.pruneCache(listIds);
      host.forgetLists(listIds);
    }
    syncHost(host, list);
  });
}

/**
 * Syncs the host from inside a store's set, where a throw would also skip the
 * save that follows. The ranking is a view of the history: it can always be
 * rebuilt, and the history must always be kept.
 */
function syncHost(host: EngineHost, list: RankedList): void {
  try {
    host.sync(list);
  } catch (error) {
    console.error('The ranking could not follow the change; restoring it instead.', error);
    try {
      host.restore(list);
    } catch (restoreError) {
      console.error('The ranking could not be restored.', restoreError);
    }
  }
}

/** The app-wide workspace. Tests build their own with `createListStore`. */
export const listStore = createListStore({ saveDelayMs: 400 });

export function useListStore<T>(selector: (state: ListState) => T): T {
  return useStore(listStore, selector);
}
