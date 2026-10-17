import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { diffImport } from '@/lib/import/diff';
import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { SaveOutcome, WorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { activeList, listAt, withList } from '@/lib/state/lists';
import type { ActivePair } from '@/lib/state/selectors';
import { selectCurrentPair, selectRanking } from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome, RankedItem } from '@/types/ranking';
import type { DataSource, FieldRoles, ListConfig, PreviewTab, RankedList, Workspace } from '@/types/source';

export interface ListStoreOptions {
  storage?: WorkspaceStorage;
  now?: () => string;
  createId?: () => string;
  /**
   * Writing the snapshot serializes the whole document, which is too much to
   * do on every click of a large list. A positive delay batches writes to at
   * most one per interval; zero (the default) saves on every change.
   */
  saveDelayMs?: number;
}

/** One step the user can take back. */
export type UndoEntry = { kind: 'comparison'; eventIds: string[] } | { kind: 'remove'; itemId: string };

const MAX_UNDO = 200;

/** What the data screen hands over when the user commits their choices. */
export interface StartInput {
  source: DataSource;
  roles: FieldRoles;
  /** True when the imported order is a trusted best-to-worst ranking. */
  alreadyRanked?: boolean;
  /**
   * False when this setup was derived from the document defaults rather than
   * chosen - the switcher's one-press path. Anything arriving from the data
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
  /** True once the app has bounced a restored workspace to /rank. */
  resumed: boolean;
  /**
   * A list picked from the toolbar's list switcher that has never been
   * configured before - the data screen preselects it so the user can choose
   * its fields and order before switching, rather than that being guessed.
   * Cleared once the data screen has read it.
   */
  pendingSwitchPath: string[] | null;
  /** The open list's steps back. In memory only: undo does not survive a reload. */
  undoStack: UndoEntry[];

  ranking(): RankedItem<ListItem>[];
  currentPair(): ActivePair | null;

  hydrate(): void;
  startRanking(input: StartInput): void;
  applyEdits(input: StartInput): void;
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
  /** Manual ordering adds comparisons against the item's new neighbours. */
  reorderItem(itemId: string, nextOrder: string[]): void;
  setPreviewTab(tab: PreviewTab): void;
  recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome): void;
  removeItem(itemId: string): void;
  /** Takes back the last comparison, reorder or removal. */
  undo(): void;
  /** The whole session as it stands, for a session file; null with nothing loaded. */
  snapshot(): WorkspaceSnapshot | null;
  /** Replaces everything with a saved session, ready to carry on ranking. */
  loadSession(session: WorkspaceSnapshot): void;
  /** Writes any save still waiting on the delay. */
  flush(): void;
  markResumed(): void;
  reset(): void;
  requestListSwitch(path: string[]): void;
  clearPendingSwitch(): void;
}

export type ListStore = StoreApi<ListState>;

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

  return createStore<ListState>()((set, get) => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
      return { version: WORKSPACE_VERSION, workspace, ui: { previewTab } };
    }

    function writeSnapshot(): void {
      const snapshot = buildSnapshot();
      if (snapshot === null) {
        storage.clear();
        return;
      }

      const outcome = storage.save(snapshot);
      set({ saveOutcome: outcome, ...(outcome === 'saved' ? { lastSavedAt: now() } : {}) });
    }

    function pushUndo(entry: UndoEntry): UndoEntry[] {
      return [...get().undoStack, entry].slice(-MAX_UNDO);
    }

    if (saveDelayMs > 0 && typeof window !== 'undefined') {
      // A save still waiting when the page goes away would be lost.
      const flushNow = () => {
        if (saveTimer === null) return;
        cancelPendingSave();
        writeSnapshot();
      };
      window.addEventListener('pagehide', flushNow);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushNow();
      });
    }

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

    function makeComparisonEvent(
      listId: string,
      leftItemId: string,
      rightItemId: string,
      outcome: ComparisonOutcome,
    ): ComparisonEvent {
      return { id: createId(), listId, leftItemId, rightItemId, outcome, createdAt: now() };
    }

    function makeItem(listId: string, value: unknown): ListItem {
      const timestamp = now();
      return {
        id: createId(),
        listId,
        value: value as ListItem['value'],
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    /** A list seen for the first time: its entries become fresh items, with no history. */
    function makeList(
      source: DataSource,
      roles: FieldRoles,
      alreadyRanked: boolean,
      configuredExplicitly: boolean,
    ): RankedList {
      const id = createId();
      const timestamp = now();
      return {
        id,
        arrayPath: source.arrayPath,
        roles,
        alreadyRanked,
        configuredExplicitly,
        items: entriesAtPath(source.document, source.arrayPath).map((entry) => makeItem(id, entry)),
        comparisonEvents: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    function isActiveItem(list: RankedList, id: string): boolean {
      return list.items.some((item) => item.id === id && item.active);
    }

    /** Every item, with the one named switched on or off. */
    function setItemActive(items: ListItem[], itemId: string, active: boolean): ListItem[] {
      const timestamp = now();
      return items.map((item) => (item.id === itemId ? { ...item, active, updatedAt: timestamp } : item));
    }

    return {
      workspace: null,
      previewTab: 'ranked',
      persistenceAvailable: storage.available,
      saveOutcome: null,
      hydrated: false,
      resumed: false,
      pendingSwitchPath: null,
      undoStack: [],

      ranking() {
        const { workspace } = get();
        if (workspace === null) return [];
        const list = activeList(workspace);
        return selectRanking(list.items, list.comparisonEvents, list.alreadyRanked);
      },

      currentPair() {
        const { workspace } = get();
        if (workspace === null) return null;
        const list = activeList(workspace);
        return selectCurrentPair(list.items, list.comparisonEvents, list.alreadyRanked);
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
        set({ workspace: snapshot.workspace, previewTab: snapshot.ui.previewTab, hydrated: true });
      },

      /** A fresh document: one new list, no history to carry over. */
      startRanking({ source, roles, alreadyRanked = false }: StartInput) {
        const timestamp = now();
        const list = makeList(source, roles, alreadyRanked, true);
        const workspace: Workspace = {
          source,
          // The first list the user sets up defines what the rest of the
          // document inherits, so there is never a document without an answer.
          listDefaults: { roles, alreadyRanked },
          lists: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set({ workspace: withList(workspace, list), previewTab: 'ranked', undoStack: [] });
        persist();
      },

      /**
       * Edited data for the open list. Entries the user did not touch keep
       * their item id, and therefore their rating and their history.
       */
      applyEdits({ source, roles, alreadyRanked }: StartInput) {
        const open = current();
        if (open === null) return;
        const { workspace, list } = open;

        const entries = entriesAtPath(source.document, source.arrayPath);
        const diff = diffImport(list.items, entries, list.comparisonEvents);
        const kept = new Set(diff.kept.map((entry) => entry.item.id));
        const timestamp = now();

        /*
         * Rebuilt in the order the edited document lists them, because that is
         * the order the user just wrote. Appending new entries instead would
         * send an edited item to the bottom: changing a title reads as one
         * entry removed and another added.
         *
         * Items that are gone stay on the end, deactivated: comparison events
         * still refer to them, and only active items are ever displayed.
         */
        const items: ListItem[] = [
          ...diff.ordered.map(({ item, entry }) => (item === null ? makeItem(list.id, entry) : item)),
          ...list.items
            .filter((item) => !kept.has(item.id))
            .map((item) => (item.active ? { ...item, active: false, updatedAt: timestamp } : item)),
        ];

        commitList(
          { ...workspace, source, updatedAt: timestamp },
          {
            ...list,
            roles,
            alreadyRanked: alreadyRanked ?? list.alreadyRanked,
            configuredExplicitly: true,
            items,
            updatedAt: timestamp,
          },
          { undoStack: [] },
        );
      },

      switchList({ source, roles, alreadyRanked = false, configuredExplicitly = true }: StartInput) {
        const { workspace } = get();
        if (workspace === null) {
          get().startRanking({ source, roles, alreadyRanked });
          return;
        }

        const timestamp = now();
        const visited = listAt(workspace, source.arrayPath);
        const list: RankedList =
          visited === undefined
            ? makeList(source, roles, alreadyRanked, configuredExplicitly)
            : {
                ...visited,
                // The caller resolved these against the defaults already, so a
                // list never set up by hand picks up any change made since it
                // was last open - see selectListConfig.
                roles,
                alreadyRanked,
                // Once a list is the user's own answer, coming back to it from
                // the switcher must not quietly hand it back to the defaults.
                configuredExplicitly: visited.configuredExplicitly || configuredExplicitly,
                updatedAt: timestamp,
              };

        set({
          workspace: withList({ ...workspace, source, updatedAt: timestamp }, list),
          previewTab: 'ranked',
          undoStack: [],
        });
        persist();
      },

      setListDefaults(listDefaults: ListConfig) {
        const workspace = get().workspace;
        if (workspace === null) return;

        set({ workspace: { ...workspace, listDefaults, updatedAt: now() } });
        persist();
      },

      /**
       * A hand-arranged position becomes one placement against the item's new
       * neighbour - the same progress credit a side-by-side pick would give,
       * rather than discarding every comparison and re-seeding the whole list.
       * The ranking stays a pure derivation of comparison history; a drag just
       * adds to that history instead of replacing it.
       */
      reorderItem(itemId: string, nextOrder: string[]) {
        const open = current();
        if (open === null) return;
        const { workspace, list } = open;

        const index = nextOrder.indexOf(itemId);
        if (index < 0 || !isActiveItem(list, itemId)) return;

        const aboveId = index > 0 ? nextOrder[index - 1] : undefined;
        const belowId = index < nextOrder.length - 1 ? nextOrder[index + 1] : undefined;

        // One placement, anchored to the item now directly above - or, at the
        // top, directly below. Comparisons against the new neighbours would
        // move them too, and a single nudge rarely carries the item all the
        // way to where it was dropped.
        let event: ComparisonEvent | null = null;
        if (aboveId !== undefined && isActiveItem(list, aboveId)) {
          event = makeComparisonEvent(list.id, itemId, aboveId, 'place_below');
        } else if (belowId !== undefined && isActiveItem(list, belowId)) {
          event = makeComparisonEvent(list.id, itemId, belowId, 'place_above');
        }
        if (event === null) return;

        commitList(
          workspace,
          { ...list, comparisonEvents: [...list.comparisonEvents, event] },
          { undoStack: pushUndo({ kind: 'comparison', eventIds: [event.id] }) },
        );
      },

      setPreviewTab(tab: PreviewTab) {
        set({ previewTab: tab });
        persist();
      },

      recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome) {
        const open = current();
        if (open === null || leftItemId === rightItemId) return;
        const { workspace, list } = open;
        if (!isActiveItem(list, leftItemId) || !isActiveItem(list, rightItemId)) return;

        const event = makeComparisonEvent(list.id, leftItemId, rightItemId, outcome);
        commitList(
          workspace,
          { ...list, comparisonEvents: [...list.comparisonEvents, event] },
          { undoStack: pushUndo({ kind: 'comparison', eventIds: [event.id] }) },
        );
      },

      /** Deleting never records a comparison: the pair simply goes away. */
      removeItem(itemId: string) {
        const open = current();
        if (open === null) return;
        const { workspace, list } = open;

        const wasActive = isActiveItem(list, itemId);
        commitList(
          workspace,
          { ...list, items: setItemActive(list.items, itemId, false) },
          { undoStack: wasActive ? pushUndo({ kind: 'remove', itemId }) : get().undoStack },
        );
      },

      undo() {
        const open = current();
        const entry = get().undoStack.at(-1);
        if (open === null || entry === undefined) return;
        const { workspace, list } = open;
        const undoStack = get().undoStack.slice(0, -1);

        if (entry.kind === 'comparison') {
          const gone = new Set(entry.eventIds);
          commitList(
            workspace,
            { ...list, comparisonEvents: list.comparisonEvents.filter((event) => !gone.has(event.id)) },
            { undoStack },
          );
        } else {
          commitList(
            workspace,
            { ...list, items: setItemActive(list.items, entry.itemId, true) },
            { undoStack },
          );
        }
      },

      snapshot() {
        return buildSnapshot();
      },

      loadSession(session: WorkspaceSnapshot) {
        cancelPendingSave();
        set({
          workspace: session.workspace,
          previewTab: session.ui.previewTab,
          // History from before belongs to the list being replaced.
          undoStack: [],
          pendingSwitchPath: null,
          // Loaded on purpose, so neither a later hydrate nor the data
          // screen's resume should second-guess it.
          hydrated: true,
          resumed: true,
        });
        persist();
      },

      flush() {
        if (saveTimer === null) return;
        cancelPendingSave();
        writeSnapshot();
      },

      markResumed() {
        set({ resumed: true });
      },

      requestListSwitch(path: string[]) {
        set({ pendingSwitchPath: path });
      },

      clearPendingSwitch() {
        set({ pendingSwitchPath: null });
      },

      reset() {
        set({
          workspace: null,
          previewTab: 'ranked',
          saveOutcome: null,
          lastSavedAt: undefined,
          resumed: true,
          // The document it named is gone, so preselecting it on the data
          // screen would point at a list that no longer exists.
          pendingSwitchPath: null,
          undoStack: [],
        });
        cancelPendingSave();
        storage.clear();
      },
    };
  });
}

/** The app-wide workspace. Tests build their own with `createListStore`. */
export const listStore = createListStore({ saveDelayMs: 400 });

export function useListStore<T>(selector: (state: ListState) => T): T {
  return useStore(listStore, selector);
}
