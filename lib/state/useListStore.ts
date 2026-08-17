import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { buildExport, buildExportDocument } from '@/lib/export/buildExport';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { diffImport } from '@/lib/import/diff';
import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { SaveOutcome, WorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { ActivePair } from '@/lib/state/selectors';
import { selectCurrentPair, selectRanking } from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome, RankedItem } from '@/types/ranking';
import type { DataSource, FieldRoles, PreviewTab, Workspace } from '@/types/source';

export interface ListStoreOptions {
  storage?: WorkspaceStorage;
  now?: () => string;
  createId?: () => string;
}

/** What the data screen hands over when the user commits their choices. */
export interface StartInput {
  source: DataSource;
  roles: FieldRoles;
  /** True when the imported order is a trusted best-to-worst ranking. */
  alreadyRanked?: boolean;
}

export interface ListState {
  workspace: Workspace | null;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  previewTab: PreviewTab;
  persistenceAvailable: boolean;
  /** Why the last save did or did not happen, for the status line. */
  saveOutcome: SaveOutcome | null;
  lastSavedAt?: string;
  hydrated: boolean;
  /** True once the app has bounced a restored workspace to /rank. */
  resumed: boolean;

  ranking(): RankedItem<ListItem>[];
  currentPair(): ActivePair | null;

  hydrate(): void;
  startRanking(input: StartInput): void;
  applyEdits(input: StartInput): void;
  /** Manual ordering restarts ranking from that order. See the spec, section 3. */
  reorderAndRestart(itemIds: string[]): void;
  setPreviewTab(tab: PreviewTab): void;
  recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome): void;
  removeItem(itemId: string): void;
  markResumed(): void;
  reset(): void;
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

  return createStore<ListState>()((set, get) => {
    /** Browser persistence is a convenience, never the system of record. */
    function persist(): void {
      const { workspace, items, comparisonEvents, previewTab } = get();
      if (workspace === null) {
        storage.clear();
        return;
      }

      const snapshot: WorkspaceSnapshot = {
        version: WORKSPACE_VERSION,
        workspace,
        items,
        comparisonEvents,
        ui: { previewTab },
      };

      const outcome = storage.save(snapshot);
      set({ saveOutcome: outcome, ...(outcome === 'saved' ? { lastSavedAt: now() } : {}) });
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

    return {
      workspace: null,
      items: [],
      comparisonEvents: [],
      previewTab: 'ranked',
      persistenceAvailable: storage.available,
      saveOutcome: null,
      hydrated: false,
      resumed: false,

      ranking() {
        const { items, comparisonEvents, workspace } = get();
        return selectRanking(items, comparisonEvents, workspace?.alreadyRanked ?? false);
      },

      currentPair() {
        const { items, comparisonEvents, workspace } = get();
        return selectCurrentPair(items, comparisonEvents, workspace?.alreadyRanked ?? false);
      },

      hydrate() {
        const snapshot = storage.load();
        if (snapshot === null) {
          set({ hydrated: true });
          return;
        }
        set({
          workspace: snapshot.workspace,
          items: snapshot.items,
          comparisonEvents: snapshot.comparisonEvents,
          previewTab: snapshot.ui.previewTab,
          hydrated: true,
        });
      },

      /** A fresh list: new workspace, new items, no history to carry over. */
      startRanking({ source, roles, alreadyRanked = false }: StartInput) {
        const timestamp = now();
        const workspace: Workspace = {
          id: createId(),
          source,
          roles,
          alreadyRanked,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const entries = entriesAtPath(source.document, source.arrayPath);

        set({
          workspace,
          items: entries.map((entry) => makeItem(workspace.id, entry)),
          comparisonEvents: [],
          previewTab: 'ranked',
        });
        persist();
      },

      /**
       * Edited data on the same workspace. Entries the user did not touch keep
       * their item id, and therefore their rating and their history.
       */
      applyEdits({ source, roles, alreadyRanked }: StartInput) {
        const workspace = get().workspace;
        if (workspace === null) return;

        const entries = entriesAtPath(source.document, source.arrayPath);
        const diff = diffImport(get().items, entries, get().comparisonEvents);
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
          ...diff.ordered.map(({ item, entry }) =>
            item === null ? makeItem(workspace.id, entry) : item,
          ),
          ...get().items
            .filter((item) => !kept.has(item.id))
            .map((item) =>
              item.active ? { ...item, active: false, updatedAt: timestamp } : item,
            ),
        ];

        set({
          workspace: {
            ...workspace,
            source,
            roles,
            alreadyRanked: alreadyRanked ?? workspace.alreadyRanked,
            updatedAt: timestamp,
          },
          items,
        });
        persist();
      },

      /**
       * A hand-arranged order becomes the new starting point. Rather than
       * layering manual positions over the derived ranking, the reordered array
       * is written back into the user's document and re-imported, so the
       * ranking stays a pure derivation of comparison history.
       */
      reorderAndRestart(itemIds: string[]) {
        const { workspace, items } = get();
        if (workspace === null) return;

        const byId = new Map(items.map((item) => [item.id, item]));
        const ordered = itemIds
          .map((id) => byId.get(id))
          .filter((item): item is ListItem => item !== undefined && item.active);
        if (ordered.length === 0) return;

        const entries = ordered.map((item) => item.value);
        const document = buildExportDocument(workspace.source, workspace.roles, entries);
        const rawText = buildExport(
          workspace.source,
          workspace.roles,
          ordered,
          workspace.source.format,
        );

        get().startRanking({
          source: { ...workspace.source, document, rawText },
          roles: workspace.roles,
          // A hand-arranged order is the user asserting a correct ranking,
          // so it seeds ratings from that order rather than resetting flat.
          alreadyRanked: true,
        });
      },

      setPreviewTab(tab: PreviewTab) {
        set({ previewTab: tab });
        persist();
      },

      recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome) {
        const { workspace, items, comparisonEvents } = get();
        if (workspace === null || leftItemId === rightItemId) return;

        const isRankable = (id: string) => items.some((item) => item.id === id && item.active);
        if (!isRankable(leftItemId) || !isRankable(rightItemId)) return;

        const event: ComparisonEvent = {
          id: createId(),
          listId: workspace.id,
          leftItemId,
          rightItemId,
          outcome,
          createdAt: now(),
        };
        set({ comparisonEvents: [...comparisonEvents, event] });
        persist();
      },

      /** Deleting never records a comparison: the pair simply goes away. */
      removeItem(itemId: string) {
        const timestamp = now();
        set({
          items: get().items.map((item) =>
            item.id === itemId ? { ...item, active: false, updatedAt: timestamp } : item,
          ),
        });
        persist();
      },

      markResumed() {
        set({ resumed: true });
      },

      reset() {
        set({
          workspace: null,
          items: [],
          comparisonEvents: [],
          previewTab: 'ranked',
          saveOutcome: null,
          lastSavedAt: undefined,
          resumed: true,
        });
        storage.clear();
      },
    };
  });
}

/** The app-wide workspace. Tests build their own with `createListStore`. */
export const listStore = createListStore();

export function useListStore<T>(selector: (state: ListState) => T): T {
  return useStore(listStore, selector);
}
