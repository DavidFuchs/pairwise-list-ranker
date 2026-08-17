import { deepEqual } from '@/lib/import/deepEqual';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

export interface ImportDiff {
  /** Entries matched to a live item, which therefore keeps its ranking. */
  kept: { item: ListItem; entry: unknown }[];
  added: unknown[];
  removed: ListItem[];
  /** Rated comparisons with both endpoints still in the list. */
  keptComparisons: number;
}

/**
 * Matches re-imported entries to live items by value, greedily and in order,
 * consuming each item at most once so duplicates match by position among
 * equals. Matched entries keep their item id, and that is what preserves the
 * comparison events pointing at them.
 */
export function diffImport(
  existingItems: ListItem[],
  nextEntries: unknown[],
  events: ComparisonEvent[] = [],
): ImportDiff {
  const pool = existingItems.filter((item) => item.active);
  const claimed = new Set<string>();

  const kept: ImportDiff['kept'] = [];
  const added: unknown[] = [];

  for (const entry of nextEntries) {
    const match = pool.find((item) => !claimed.has(item.id) && deepEqual(item.value, entry));
    if (match === undefined) {
      added.push(entry);
      continue;
    }
    claimed.add(match.id);
    kept.push({ item: match, entry });
  }

  const removed = pool.filter((item) => !claimed.has(item.id));
  const keptComparisons = events.filter(
    (event) =>
      event.outcome !== 'skip' && claimed.has(event.leftItemId) && claimed.has(event.rightItemId),
  ).length;

  return { kept, added, removed, keptComparisons };
}
