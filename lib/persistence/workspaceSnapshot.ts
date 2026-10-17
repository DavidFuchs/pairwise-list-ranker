import { z } from 'zod';

import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { deepEqual } from '@/lib/import/deepEqual';
import { pathKey } from '@/lib/import/paths';
import type { ListItem } from '@/types/list';
import { FIELD_RENDERERS } from '@/types/source';
import type { PreviewTab, RankedList, Workspace } from '@/types/source';

/** Bump when the persisted shape changes so stale snapshots are dropped. */
export const WORKSPACE_VERSION = 5;

export interface WorkspaceUiState {
  previewTab: PreviewTab;
}

export interface WorkspaceSnapshot {
  version: number;
  workspace: Workspace;
  ui: WorkspaceUiState;
}

/**
 * The source document is the user's, so it is stored and restored as-is. Only
 * the app's own annotations around it are validated.
 */
const dataSourceSchema = z.object({
  format: z.enum(['list', 'yaml', 'json']),
  document: z.unknown(),
  arrayPath: z.array(z.string()),
});

const rolesSchema = z.object({
  labelField: z.string().optional(),
  positionField: z.string().optional(),
  summaryFields: z.array(z.string()).optional(),
  fieldRenderers: z.record(z.string(), z.enum(FIELD_RENDERERS)).optional(),
});

/**
 * An item names its value by `entry`, an index into its list's entries in the
 * document, whenever the document holds it; only an item the document no
 * longer has, like one an edit removed, carries its `value`. Exactly one of the
 * two. The value is the user's, like the document, so it is not validated.
 */
const storedItemSchema = z
  .object({
    id: z.string().min(1),
    listId: z.string().min(1),
    entry: z.number().int().nonnegative().optional(),
    value: z.unknown().optional(),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine((item) => (item.entry === undefined) !== (item.value === undefined));

const comparisonEventSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  leftItemId: z.string().min(1),
  rightItemId: z.string().min(1),
  outcome: z.enum(['left', 'right', 'left_strong', 'right_strong', 'skip', 'place_below', 'place_above']),
  createdAt: z.string(),
});

const rankedListSchema = z.object({
  id: z.string().min(1),
  arrayPath: z.array(z.string()),
  roles: rolesSchema,
  alreadyRanked: z.boolean(),
  configuredExplicitly: z.boolean(),
  items: z.array(storedItemSchema),
  comparisonEvents: z.array(comparisonEventSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const workspaceSchema = z
  .object({
    source: dataSourceSchema,
    listDefaults: z.object({ roles: rolesSchema, alreadyRanked: z.boolean() }),
    lists: z.record(z.string(), rankedListSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  // Each list is filed under its own path, and the open one is among them.
  .refine(
    (workspace) =>
      Object.entries(workspace.lists).every(([key, list]) => key === pathKey(list.arrayPath)) &&
      workspace.lists[pathKey(workspace.source.arrayPath)] !== undefined,
  );

export const workspaceSnapshotSchema = z.object({
  version: z.number().int().positive(),
  workspace: workspaceSchema,
  ui: z.object({ previewTab: z.enum(['ranked', 'list', 'yaml', 'json']) }),
});

/** An item as written to storage or a session file; see storedItemSchema. */
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
    Object.entries(snapshot.workspace.lists).map(([key, list]) => {
      const entries = entriesAtPath(document, list.arrayPath);
      const indexOf = entryIndexer(entries);
      const items = list.items.map((item, position): StoredItem => {
        const { value, ...rest } = item;
        const entry = indexOf(value, position);
        return entry === undefined ? { ...rest, value } : { ...rest, entry };
      });
      return [key, { ...list, items }];
    }),
  );
  return { ...snapshot, workspace: { ...snapshot.workspace, lists } };
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
function expandWorkspace(stored: z.infer<typeof workspaceSchema>): Workspace | null {
  const lists: Record<string, RankedList> = {};
  for (const [key, list] of Object.entries(stored.lists)) {
    const entries = entriesAtPath(stored.source.document, list.arrayPath);
    const items: ListItem[] = [];
    for (const { entry, value, ...rest } of list.items) {
      if (entry !== undefined && entry >= entries.length) return null;
      items.push({ ...rest, value: (entry === undefined ? value : entries[entry]) as ListItem['value'] });
    }
    lists[key] = { ...list, items };
  }
  return { ...stored, lists };
}

/**
 * Reads a snapshot written by compactSnapshot, or one with every value inline.
 * Returns null for anything we cannot safely restore, older versions included.
 * Persisted state is a convenience, so failing to read it must never break the
 * app.
 */
export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null {
  const result = workspaceSnapshotSchema.safeParse(input);
  if (!result.success) return null;
  if (result.data.version !== WORKSPACE_VERSION) return null;
  const workspace = expandWorkspace(result.data.workspace);
  return workspace === null ? null : { ...result.data, workspace };
}
