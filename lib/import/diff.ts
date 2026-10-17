import { deepEqual } from '@/lib/import/deepEqual';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { ListConfig } from '@/types/source';

export interface ImportDiff {
  /** Entries matched to a live item, which therefore keeps its ranking. */
  kept: { item: ListItem; entry: unknown }[];
  added: unknown[];
  removed: ListItem[];
  /** Rated comparisons with both endpoints still in the list. */
  keptComparisons: number;
  /**
   * Every entry in the order the edited document lists them, matched to its
   * live item where there is one. Applying in this order is what keeps an
   * edited entry where the user put it rather than moving it to the end.
   */
  ordered: { item: ListItem | null; entry: unknown }[];
  /** True when the same items came back in a different order. */
  reordered: boolean;
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
  const ordered: ImportDiff['ordered'] = [];

  for (const entry of nextEntries) {
    const match = pool.find((item) => !claimed.has(item.id) && deepEqual(item.value, entry));
    if (match === undefined) {
      added.push(entry);
      ordered.push({ item: null, entry });
      continue;
    }
    claimed.add(match.id);
    kept.push({ item: match, entry });
    ordered.push({ item: match, entry });
  }

  const removed = pool.filter((item) => !claimed.has(item.id));
  const keptComparisons = events.filter(
    (event) => event.outcome !== 'skip' && claimed.has(event.leftItemId) && claimed.has(event.rightItemId),
  ).length;

  // Same items, different sequence: a real change, and one the user cannot see
  // in a count of added and removed entries.
  const keptIds = kept.map((entry) => entry.item.id);
  const previousIds = pool.filter((item) => claimed.has(item.id)).map((item) => item.id);
  const reordered = keptIds.join('\u0000') !== previousIds.join('\u0000');

  return { kept, added, removed, keptComparisons, ordered, reordered };
}

/** A field role moving between fields, or being chosen or cleared. */
export interface FieldChange {
  from: string | undefined;
  to: string | undefined;
}

/**
 * What changed about how a list is set up, as opposed to what changed about
 * its data. The two are edited on the same screen and applied by the same
 * press, but they have nothing in common: entries decide what is ranked,
 * settings decide how.
 */
export interface SettingsDiff {
  /**
   * `seeded` when the list was just declared already ranked, `flattened` when
   * that claim was withdrawn. Either way every starting rating is derived
   * again, so a summary must not promise the ranking survives untouched.
   */
  order: 'unchanged' | 'seeded' | 'flattened';
  /** Which field shows on the cards. Display only. */
  label: FieldChange | null;
  /** The fields every card is set to show; absent when they are unchanged. */
  summary?: { to: string[] };
  /** Which field export stamps with 1..N. Touches the exported data only. */
  writeBack: FieldChange | null;
  changed: boolean;
}

function fieldChange(from: string | undefined, to: string | undefined): FieldChange | null {
  return from === to ? null : { from, to };
}

export function diffSettings(previous: ListConfig, next: ListConfig): SettingsDiff {
  const order =
    previous.alreadyRanked === next.alreadyRanked ? 'unchanged' : next.alreadyRanked ? 'seeded' : 'flattened';
  const label = fieldChange(previous.roles.labelField, next.roles.labelField);
  const before = previous.roles.summaryFields ?? [];
  const after = next.roles.summaryFields ?? [];
  const sameRenderers =
    JSON.stringify(previous.roles.fieldRenderers ?? {}) === JSON.stringify(next.roles.fieldRenderers ?? {});
  const summary = before.join('\u0000') === after.join('\u0000') && sameRenderers ? null : { to: after };
  const writeBack = fieldChange(previous.roles.positionField, next.roles.positionField);

  return {
    order,
    label,
    ...(summary === null ? {} : { summary }),
    writeBack,
    changed: order !== 'unchanged' || label !== null || summary !== null || writeBack !== null,
  };
}
