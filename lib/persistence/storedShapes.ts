import { FIELD_RENDERERS } from '@/types/source';
import type {
  FieldRenderer,
  FieldRoles,
  ListConfig,
  PreviewTab,
  SortSpec,
  SourceFormat,
  UndoStep,
} from '@/types/source';
import type { PairOutcome, RankingEvent, RecordedEvent, StartingOrder } from '@/types/rankingEvents';

/*
 * Readers for the shapes the app stores: a snapshot or session file, and the
 * pieces a browser save is made of. Each takes anything and returns the value
 * with nothing but its own fields, or null if it is not one. They are written
 * by hand rather than as schemas: a long history is tens of thousands of small
 * objects, and a schema library's evaluation and first use are a large share of
 * the time spent opening the app on one. What each checks is exactly what the
 * types it returns say, so a stored workspace either restores as written or is
 * refused whole.
 */

export type Json = Record<string, unknown>;

export function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-empty string, as an id is. */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** An array of strings, of which every one is an id. */
export function isIds(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (!isId(value[i])) return false;
  return true;
}

export function isStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (typeof value[i] !== 'string') return false;
  return true;
}

/** A whole number, zero or more. */
export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const FORMATS: ReadonlySet<unknown> = new Set<SourceFormat>(['list', 'yaml', 'json']);
const STARTING_ORDERS: ReadonlySet<unknown> = new Set<StartingOrder>(['unordered', 'rough', 'ranked']);
const PREVIEW_TABS: ReadonlySet<unknown> = new Set<PreviewTab>(['ranked', 'list', 'yaml', 'json']);
const RENDERERS: ReadonlySet<unknown> = new Set<string>(FIELD_RENDERERS);
const PAIR_OUTCOMES: ReadonlySet<unknown> = new Set<PairOutcome>([
  'left',
  'right',
  'left_strong',
  'right_strong',
  'draw',
]);

export function readStartingOrder(value: unknown): StartingOrder | null {
  return STARTING_ORDERS.has(value) ? (value as StartingOrder) : null;
}

export function readPreviewTab(value: unknown): PreviewTab | null {
  return PREVIEW_TABS.has(value) ? (value as PreviewTab) : null;
}

export function readRoles(value: unknown): FieldRoles | null {
  if (!isRecord(value)) return null;
  const { labelField, positionField, summaryFields, fieldRenderers } = value;
  const roles: FieldRoles = {};
  if (labelField !== undefined) {
    if (typeof labelField !== 'string') return null;
    roles.labelField = labelField;
  }
  if (positionField !== undefined) {
    if (typeof positionField !== 'string') return null;
    roles.positionField = positionField;
  }
  if (summaryFields !== undefined) {
    if (!isStrings(summaryFields)) return null;
    roles.summaryFields = summaryFields;
  }
  if (fieldRenderers !== undefined) {
    if (!isRecord(fieldRenderers)) return null;
    const entries = Object.entries(fieldRenderers);
    if (!entries.every(([, renderer]) => RENDERERS.has(renderer))) return null;
    roles.fieldRenderers = Object.fromEntries(entries) as Record<string, FieldRenderer>;
  }
  return roles;
}

/** How one list is ranked: the setup the document defaults and each list hold. */
export function readListConfig(value: unknown): ListConfig | null {
  if (!isRecord(value)) return null;
  const roles = readRoles(value.roles);
  const startingOrder = readStartingOrder(value.startingOrder);
  return roles === null || startingOrder === null ? null : { roles, startingOrder };
}

/** Where a document's open list sits, and in what format the document came. */
export function readSourceHead(value: unknown): { format: SourceFormat; arrayPath: string[] } | null {
  if (!isRecord(value)) return null;
  const { format, arrayPath } = value;
  if (!FORMATS.has(format) || !isStrings(arrayPath)) return null;
  return { format: format as SourceFormat, arrayPath };
}

/** What a list is apart from the items and history it holds. */
export interface ListSetup {
  id: string;
  arrayPath: string[];
  roles: FieldRoles;
  initialStartingOrder: StartingOrder;
  initialSort?: SortSpec;
  configuredExplicitly: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A stored sort: a non-empty field name and a direction; anything else is not one. */
function readSort(value: unknown): SortSpec | null {
  if (!isRecord(value)) return null;
  const { field, direction } = value;
  if (typeof field !== 'string' || field === '') return null;
  if (direction !== 'desc' && direction !== 'asc') return null;
  return { field, direction };
}

export function readListSetup(value: unknown): ListSetup | null {
  if (!isRecord(value)) return null;
  const { id, arrayPath, configuredExplicitly, createdAt, updatedAt } = value;
  const config = readListConfig({ roles: value.roles, startingOrder: value.initialStartingOrder });
  if (!isId(id) || !isStrings(arrayPath) || config === null) return null;
  if (typeof configuredExplicitly !== 'boolean') return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  const { roles, startingOrder: initialStartingOrder } = config;
  const initialSort = value.initialSort === undefined ? undefined : readSort(value.initialSort);
  if (initialSort === null) return null;
  return {
    id,
    arrayPath,
    roles,
    initialStartingOrder,
    ...(initialSort === undefined ? {} : { initialSort }),
    configuredExplicitly,
    createdAt,
    updatedAt,
  };
}

/**
 * An item as stored. It names its value by `entry`, an index into its list's
 * entries in the document, whenever the document holds it; only an item the
 * document no longer has, like one an edit removed, carries its `value`.
 * Exactly one of the two. The value is the user's, like the document, so it is
 * not checked.
 */
export interface StoredItemRecord {
  id: string;
  listId: string;
  entry?: number;
  value?: unknown;
  createdAt: string;
  updatedAt: string;
}

export function readStoredItems(value: unknown): StoredItemRecord[] | null {
  if (!Array.isArray(value)) return null;
  const items: StoredItemRecord[] = [];
  for (let i = 0; i < value.length; i++) {
    const raw: unknown = value[i];
    if (!isRecord(raw)) return null;
    const { id, listId, entry, createdAt, updatedAt } = raw;
    if (!isId(id) || !isId(listId)) return null;
    if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
    if (entry !== undefined && !isCount(entry)) return null;
    if ((entry === undefined) === (raw.value === undefined)) return null;
    const rest = { id, listId, createdAt, updatedAt };
    items.push(entry === undefined ? { ...rest, value: raw.value } : { ...rest, entry });
  }
  return items;
}

/** The event `value` describes, with nothing but its own fields, or null if it is not one. */
export function readEvent(value: unknown): RankingEvent | null {
  if (!isRecord(value)) return null;
  const { id, listId, createdAt, kind } = value;
  if (!isId(id) || !isId(listId) || typeof createdAt !== 'string') return null;
  const base = { id, listId, createdAt };
  switch (kind) {
    case 'pair': {
      const { leftItemId, rightItemId, outcome } = value;
      if (!isId(leftItemId) || !isId(rightItemId) || !PAIR_OUTCOMES.has(outcome)) return null;
      return { ...base, kind, leftItemId, rightItemId, outcome: outcome as PairOutcome };
    }
    case 'placement': {
      // An item with the rows it was put between, at least one of which is there.
      const { itemId, aboveItemId, belowItemId } = value;
      if (!isId(itemId)) return null;
      if (aboveItemId !== undefined && !isId(aboveItemId)) return null;
      if (belowItemId !== undefined && !isId(belowItemId)) return null;
      if (aboveItemId === undefined && belowItemId === undefined) return null;
      return {
        ...base,
        kind,
        itemId,
        ...(aboveItemId === undefined ? {} : { aboveItemId }),
        ...(belowItemId === undefined ? {} : { belowItemId }),
      };
    }
    case 'unrecognized': {
      const { itemIds } = value;
      return isIds(itemIds) ? { ...base, kind, itemIds } : null;
    }
    case 'removal': {
      const { itemIds } = value;
      return isIds(itemIds) ? { ...base, kind, itemIds } : null;
    }
    default:
      return null;
  }
}

/**
 * A list's history as stored: each event with the id of the action that
 * recorded it, or null if any one is not an event.
 */
export function readEvents(value: unknown): RecordedEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: RecordedEvent[] = [];
  for (let i = 0; i < value.length; i++) {
    const raw: unknown = value[i];
    const event = readEvent(raw);
    const actionId = isRecord(raw) ? raw.actionId : undefined;
    if (event === null || !isId(actionId)) return null;
    events.push({ ...event, actionId });
  }
  return events;
}

/** The step Undo offers as saved, undefined when there is none, or null when it is not one. */
export function readUndoStep(value: unknown): UndoStep | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const { actionId, listIds } = value;
  if (!isId(actionId) || !isIds(listIds)) return null;
  return { actionId, listIds };
}
