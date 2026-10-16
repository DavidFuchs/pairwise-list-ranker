import { z } from 'zod';

import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome } from '@/types/ranking';

/**
 * Ranking progress, kept apart from the user's document. Items carry no ids of
 * their own, so each is named by a hash of its value; the file therefore
 * survives a re-import of the same data, and an item edited since simply
 * starts over.
 */
export const PROGRESS_FILE_KIND = 'pairwise-list-ranker-progress';
export const PROGRESS_FILE_VERSION = 1;

const outcomeSchema = z.enum(['left', 'right', 'left_strong', 'right_strong', 'skip', 'place_below', 'place_above']);

const progressFileSchema = z.object({
  kind: z.literal(PROGRESS_FILE_KIND),
  version: z.literal(PROGRESS_FILE_VERSION),
  savedAt: z.string(),
  /** Informational: which list of the document this progress belongs to. */
  arrayPath: z.array(z.string()),
  events: z.array(
    z.object({
      left: z.string().min(1),
      right: z.string().min(1),
      outcome: outcomeSchema,
      at: z.string(),
    }),
  ),
  removed: z.array(z.string().min(1)),
});

export type ProgressFile = z.infer<typeof progressFileSchema>;

/** Stable across key order, so a re-serialized document hashes the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** cyrb53: small, fast, and plenty for telling one list entry from another. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * One key per item. Entries with identical values are interchangeable, so they
 * are told apart only by order of appearance (`key`, `key#2`, ...).
 */
export function itemKeys(items: ListItem[]): Map<string, string> {
  const seen = new Map<string, number>();
  const keys = new Map<string, string>();
  for (const item of items) {
    const base = hash(canonical(item.value));
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    keys.set(item.id, count === 1 ? base : `${base}#${count}`);
  }
  return keys;
}

export function buildProgressFile(
  items: ListItem[],
  events: ComparisonEvent[],
  arrayPath: string[],
  savedAt: string,
): ProgressFile {
  const keys = itemKeys(items);

  const progressEvents: ProgressFile['events'] = [];
  for (const event of events) {
    const left = keys.get(event.leftItemId);
    const right = keys.get(event.rightItemId);
    if (left === undefined || right === undefined) continue;
    progressEvents.push({ left, right, outcome: event.outcome, at: event.createdAt });
  }

  return {
    kind: PROGRESS_FILE_KIND,
    version: PROGRESS_FILE_VERSION,
    savedAt,
    arrayPath,
    events: progressEvents,
    removed: items.filter((item) => !item.active).map((item) => keys.get(item.id) as string),
  };
}

export type ParsedProgress =
  | { ok: true; file: ProgressFile }
  | { ok: false; reason: string };

export function parseProgressFile(text: string): ParsedProgress {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' };
  }
  const result = progressFileSchema.safeParse(json);
  if (!result.success) return { ok: false, reason: 'That is not a progress file from this app.' };
  return { ok: true, file: result.data };
}

export interface AppliedProgress {
  events: ComparisonEvent[];
  /** Ids of items the file marks as removed. */
  removedIds: string[];
  matchedEvents: number;
  /** Events naming an item that is not in this list (edited or deleted since). */
  unmatchedEvents: number;
  unmatchedRemoved: number;
}

/** Maps a progress file onto the items currently loaded. Pure. */
export function applyProgressFile(
  file: ProgressFile,
  items: ListItem[],
  listId: string,
  createId: () => string,
): AppliedProgress {
  const byKey = new Map<string, string>();
  for (const [id, key] of itemKeys(items)) byKey.set(key, id);

  const events: ComparisonEvent[] = [];
  let unmatchedEvents = 0;
  for (const entry of file.events) {
    const leftItemId = byKey.get(entry.left);
    const rightItemId = byKey.get(entry.right);
    if (leftItemId === undefined || rightItemId === undefined || leftItemId === rightItemId) {
      unmatchedEvents += 1;
      continue;
    }
    events.push({
      id: createId(),
      listId,
      leftItemId,
      rightItemId,
      outcome: entry.outcome as ComparisonOutcome,
      createdAt: entry.at,
    });
  }

  const removedIds: string[] = [];
  let unmatchedRemoved = 0;
  for (const key of file.removed) {
    const id = byKey.get(key);
    if (id === undefined) unmatchedRemoved += 1;
    else removedIds.push(id);
  }

  return {
    events,
    removedIds,
    matchedEvents: events.length,
    unmatchedEvents,
    unmatchedRemoved,
  };
}
