import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { deepEqual } from '@/lib/import/deepEqual';
import { pathKey } from '@/lib/import/paths';
import type { ListItem } from '@/types/list';
import {
  isIds,
  isRecord,
  readEvents,
  readUndoStep,
  readListConfig,
  readListSetup,
  readPreviewTab,
  readSourceHead,
  readStoredItems,
} from '@/lib/persistence/storedShapes';
import type { StoredItemRecord } from '@/lib/persistence/storedShapes';
import type { PreviewTab, RankedList, Workspace } from '@/types/source';

/** Bump when the persisted shape changes so stale snapshots are dropped. */
export const WORKSPACE_VERSION = 8;

export interface WorkspaceUiState {
  previewTab: PreviewTab;
}

export interface WorkspaceSnapshot {
  version: number;
  workspace: Workspace;
  ui: WorkspaceUiState;
}

/** An item as written to storage or a session file; see StoredItemRecord. */
export type StoredItem = Omit<ListItem, 'value'> &
  ({ entry: number; value?: never } | { value: ListItem['value']; entry?: never });

/** A snapshot as written: the same, but with items named by entry where they can be. */
export interface StoredSnapshot extends Omit<WorkspaceSnapshot, 'workspace'> {
  workspace: Omit<Workspace, 'lists'> & {
    lists: Record<string, Omit<RankedList, 'items'> & { items: StoredItem[] }>;
  };
}

/**
 * The snapshot ready to write. Each item's value is already in the document,
 * so writing it again would hold every entry twice; an item names its entry
 * instead. Matching is by value, not by position, since an item's place in its
 * list and its entry's place in the document part ways once a list is edited.
 */
export function compactSnapshot(snapshot: WorkspaceSnapshot): StoredSnapshot {
  const { document } = snapshot.workspace.source;
  const lists = Object.fromEntries(
    Object.entries(snapshot.workspace.lists).map(([key, list]) => [
      key,
      { ...list, items: compactItems(list, document) },
    ]),
  );
  return { ...snapshot, workspace: { ...snapshot.workspace, lists } };
}

/** One list's items as written, each naming its entry in `document` where it can. */
export function compactItems(list: RankedList, document: unknown): StoredItem[] {
  const indexOf = entryIndexer(entriesAtPath(document, list.arrayPath));
  return list.items.map((item, position): StoredItem => {
    const { value, ...rest } = item;
    const entry = indexOf(value, position);
    return entry === undefined ? { ...rest, value } : { ...rest, entry };
  });
}

/**
 * Finds an entry equal to a value. The entry at the item's own position is
 * tried first, which is where it sits until a list is edited; the rest are
 * indexed by their text only when that misses.
 */
function entryIndexer(entries: unknown[]): (value: unknown, position: number) => number | undefined {
  let byText: Map<string, number> | null = null;
  return (value, position) => {
    if (position < entries.length && deepEqual(value, entries[position])) return position;
    if (byText === null) {
      byText = new Map();
      entries.forEach((entry, index) => {
        const text = JSON.stringify(entry);
        if (!byText!.has(text)) byText!.set(text, index);
      });
    }
    const index = byText.get(JSON.stringify(value));
    return index !== undefined && deepEqual(value, entries[index]) ? index : undefined;
  };
}

/** Fills each item's value back in from the document; null if an entry is missing. */
export function expandItems(stored: readonly StoredItemRecord[], entries: unknown[]): ListItem[] | null {
  const items: ListItem[] = [];
  for (const { entry, value, ...rest } of stored) {
    if (entry !== undefined && entry >= entries.length) return null;
    items.push({ ...rest, value: (entry === undefined ? value : entries[entry]) as ListItem['value'] });
  }
  return items;
}

/**
 * Reads a snapshot written by compactSnapshot, or one with every value inline.
 * Returns null for anything we cannot safely restore, older versions included.
 * Persisted state is a convenience, so failing to read it must never break the
 * app.
 */
export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null {
  if (!isRecord(input) || input.version !== WORKSPACE_VERSION) return null;
  const previewTab = isRecord(input.ui) ? readPreviewTab(input.ui.previewTab) : null;
  const raw = input.workspace;
  if (previewTab === null || !isRecord(raw)) return null;

  const head = readSourceHead(raw.source);
  const listDefaults = readListConfig(raw.listDefaults);
  const { createdAt, updatedAt } = raw;
  if (head === null || listDefaults === null || !isRecord(raw.lists)) return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  const document: unknown = (raw.source as Record<string, unknown>).document;

  const lists: [string, RankedList][] = [];
  for (const [key, rawList] of Object.entries(raw.lists)) {
    const setup = readListSetup(rawList);
    if (setup === null || !isRecord(rawList)) return null;
    // Each list is filed under its own path.
    if (key !== pathKey(setup.arrayPath)) return null;
    const { originalItemIds } = rawList;
    const stored = readStoredItems(rawList.items);
    const events = readEvents(rawList.events);
    if (!isIds(originalItemIds) || stored === null || events === null) return null;
    const items = expandItems(stored, entriesAtPath(document, setup.arrayPath));
    if (items === null) return null;
    lists.push([key, { ...setup, originalItemIds, items, events }]);
  }
  // ... and the open one is among them.
  if (!lists.some(([key]) => key === pathKey(head.arrayPath))) return null;
  const lastAction = readUndoStep(raw.lastAction);
  if (lastAction === null) return null;

  return {
    version: WORKSPACE_VERSION,
    workspace: {
      source: { format: head.format, document, arrayPath: head.arrayPath },
      listDefaults,
      lists: Object.fromEntries(lists),
      ...(lastAction === undefined ? {} : { lastAction }),
      createdAt,
      updatedAt,
    },
    ui: { previewTab },
  };
}
