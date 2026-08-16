import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { parseDocument } from '@/lib/formats';
import { workspaceFromDocument } from '@/lib/formats/documentMapping';
import { createWorkspaceStorage } from '@/lib/persistence/browserStorage';
import type { WorkspaceStorage } from '@/lib/persistence/browserStorage';
import type { ActivePair } from '@/lib/state/selectors';
import { selectCurrentPair, selectRanking } from '@/lib/state/selectors';
import type { ParseResult } from '@/lib/validation/listSchemas';
import type { ExportFormat, ItemValue, ListItem, TextFormat, WorkspaceList } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome, RankedItem } from '@/types/ranking';
import type { ListDocument, WorkspaceSnapshot } from '@/types/workspace';
import { WORKSPACE_VERSION } from '@/types/workspace';

export interface ListStoreOptions {
  storage?: WorkspaceStorage;
  now?: () => string;
  createId?: () => string;
}

export interface ListState {
  list: WorkspaceList | null;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  previewMode: ExportFormat;
  editorDrafts: Partial<Record<TextFormat, string>>;
  persistenceAvailable: boolean;
  hydrated: boolean;

  ranking(): RankedItem<ListItem>[];
  currentPair(): ActivePair | null;

  hydrate(): void;
  importDocument(doc: ListDocument): void;
  importText(text: string, format: TextFormat): ParseResult<ListDocument>;
  addItem(value: ItemValue): void;
  removeItem(itemId: string): void;
  recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome): void;
  setSortField(field: string | undefined): void;
  setListMeta(patch: { title?: string; description?: string }): void;
  setPreviewMode(mode: ExportFormat): void;
  setEditorDraft(format: TextFormat, text: string): void;
  clearEditorDraft(format: TextFormat): void;
  applyEditorDraft(format: TextFormat): ParseResult<ListDocument>;
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
      const { list, items, comparisonEvents, previewMode, editorDrafts } = get();
      if (list === null) {
        storage.clear();
        return;
      }
      const snapshot: WorkspaceSnapshot = {
        version: WORKSPACE_VERSION,
        list,
        items,
        comparisonEvents,
        ui: { previewMode, editorDrafts },
      };
      storage.save(snapshot);
    }

    function touchList(patch: Partial<WorkspaceList>): void {
      const list = get().list;
      if (list === null) return;
      set({ list: { ...list, ...patch, updatedAt: now() } });
      persist();
    }

    return {
      list: null,
      items: [],
      comparisonEvents: [],
      previewMode: 'gui',
      editorDrafts: {},
      persistenceAvailable: storage.available,
      hydrated: false,

      ranking() {
        const { items, comparisonEvents } = get();
        return selectRanking(items, comparisonEvents);
      },

      currentPair() {
        const { items, comparisonEvents } = get();
        return selectCurrentPair(items, comparisonEvents);
      },

      hydrate() {
        const snapshot = storage.load();
        if (snapshot === null) {
          set({ hydrated: true });
          return;
        }
        set({
          list: snapshot.list,
          items: snapshot.items,
          comparisonEvents: snapshot.comparisonEvents,
          previewMode: snapshot.ui.previewMode,
          editorDrafts: snapshot.ui.editorDrafts,
          hydrated: true,
        });
      },

      importDocument(doc: ListDocument) {
        const { list, items } = workspaceFromDocument(doc, { now, createId });
        // A new list means a new ranking: history from the old list no longer
        // refers to anything, and stale drafts would misrepresent the import.
        set({ list, items, comparisonEvents: [], editorDrafts: {} });
        persist();
      },

      importText(text: string, format: TextFormat) {
        const result = parseDocument(text, format, { title: get().list?.title });
        if (result.ok) get().importDocument(result.data);
        return result;
      },

      addItem(value: ItemValue) {
        const list = get().list;
        if (list === null) return;
        const timestamp = now();
        const item: ListItem = {
          id: createId(),
          listId: list.id,
          value,
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set({ items: [...get().items, item] });
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

      recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome) {
        const { list, items, comparisonEvents } = get();
        if (list === null || leftItemId === rightItemId) return;

        const isRankable = (id: string) =>
          items.some((item) => item.id === id && item.active);
        if (!isRankable(leftItemId) || !isRankable(rightItemId)) return;

        const event: ComparisonEvent = {
          id: createId(),
          listId: list.id,
          leftItemId,
          rightItemId,
          outcome,
          createdAt: now(),
        };
        set({ comparisonEvents: [...comparisonEvents, event] });
        persist();
      },

      setSortField(field: string | undefined) {
        touchList({ sortField: field });
      },

      setListMeta(patch: { title?: string; description?: string }) {
        touchList(patch);
      },

      setPreviewMode(mode: ExportFormat) {
        set({ previewMode: mode });
        persist();
      },

      setEditorDraft(format: TextFormat, text: string) {
        set({ editorDrafts: { ...get().editorDrafts, [format]: text } });
        persist();
      },

      clearEditorDraft(format: TextFormat) {
        const drafts = { ...get().editorDrafts };
        delete drafts[format];
        set({ editorDrafts: drafts });
        persist();
      },

      /** Typing never mutates the list; only applying a valid draft does. */
      applyEditorDraft(format: TextFormat) {
        const draft = get().editorDrafts[format] ?? '';
        return get().importText(draft, format);
      },

      reset() {
        set({
          list: null,
          items: [],
          comparisonEvents: [],
          previewMode: 'gui',
          editorDrafts: {},
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
