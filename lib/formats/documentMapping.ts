import type { ListItem, WorkspaceList } from '@/types/list';
import type { ListDocument } from '@/types/workspace';
import { LIST_DOCUMENT_VERSION } from '@/types/workspace';

export interface MappingOptions {
  now?: () => string;
  createId?: () => string;
}

export interface WorkspaceParts {
  list: WorkspaceList;
  items: ListItem[];
}

function defaultCreateId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

const defaultNow = () => new Date().toISOString();

/**
 * Build the portable document from live workspace state. Deleted items are left
 * out; item order is preserved so callers can export the current ranking order.
 */
export function documentFromWorkspace(list: WorkspaceList, items: ListItem[]): ListDocument {
  return {
    version: LIST_DOCUMENT_VERSION,
    title: list.title,
    ...(list.description === undefined ? {} : { description: list.description }),
    kind: list.kind,
    ...(list.sortField === undefined ? {} : { sortField: list.sortField }),
    items: items
      .filter((item) => item.active)
      .map((item) => ({ id: item.id, value: item.value })),
  };
}

/** Build fresh workspace state from an imported document. */
export function workspaceFromDocument(
  doc: ListDocument,
  options: MappingOptions = {},
): WorkspaceParts {
  const now = options.now ?? defaultNow;
  const createId = options.createId ?? defaultCreateId;

  const timestamp = now();
  const listId = createId();

  const list: WorkspaceList = {
    id: listId,
    title: doc.title,
    ...(doc.description === undefined ? {} : { description: doc.description }),
    kind: doc.kind,
    ...(doc.sortField === undefined ? {} : { sortField: doc.sortField }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const items: ListItem[] = doc.items.map((entry) => ({
    id: entry.id ?? createId(),
    listId,
    value: entry.value,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  return { list, items };
}
