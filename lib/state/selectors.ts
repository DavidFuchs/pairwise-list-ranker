import { documentFromWorkspace } from '@/lib/formats/documentMapping';
import { serializeDocument } from '@/lib/formats';
import { selectNextPair } from '@/lib/ranking/pairSelection';
import { rankItems, replayComparisons } from '@/lib/ranking/rebuildRanking';
import type { RankingStates } from '@/lib/ranking/rebuildRanking';
import { collectLabelFieldCandidates, describeObjectSchema } from '@/lib/import/labelField';
import type { ObjectSchemaHint, LabelFieldCandidate } from '@/lib/import/labelField';
import { isComplexItemValue } from '@/types/list';
import type { ListItem, TextFormat, WorkspaceList } from '@/types/list';
import type { ComparisonEvent, RankedItem } from '@/types/ranking';
import type { ListDocument } from '@/types/workspace';

export interface ActivePair {
  left: ListItem;
  right: ListItem;
}

export interface WorkspaceView {
  states: RankingStates;
  ranking: RankedItem<ListItem>[];
  pair: ActivePair | null;
}

interface ViewCache {
  items: ListItem[];
  events: ComparisonEvent[];
  view: WorkspaceView;
}

let cache: ViewCache | null = null;

/**
 * Replay, rank, and pick the next pair in one pass, memoized on the identity of
 * the items and event arrays. The store replaces those arrays on every change,
 * so re-renders that change nothing reuse the previous result.
 */
export function selectWorkspaceView(items: ListItem[], events: ComparisonEvent[]): WorkspaceView {
  if (cache !== null && cache.items === items && cache.events === events) {
    return cache.view;
  }

  const states = replayComparisons(items, events);
  const ranking = rankItems(items, states, events);
  const candidate = selectNextPair(items, states, events);

  const byId = new Map(items.map((item) => [item.id, item]));
  const left = candidate === null ? undefined : byId.get(candidate.leftItemId);
  const right = candidate === null ? undefined : byId.get(candidate.rightItemId);

  const view: WorkspaceView = {
    states,
    ranking,
    pair: left && right ? { left, right } : null,
  };

  cache = { items, events, view };
  return view;
}

export function selectRanking(items: ListItem[], events: ComparisonEvent[]): RankedItem<ListItem>[] {
  return selectWorkspaceView(items, events).ranking;
}

export function selectCurrentPair(items: ListItem[], events: ComparisonEvent[]): ActivePair | null {
  return selectWorkspaceView(items, events).pair;
}

/** The exportable document, ordered best-first so exports carry the ranking. */
export function selectDocument(
  list: WorkspaceList,
  items: ListItem[],
  events: ComparisonEvent[],
): ListDocument {
  const ranked = selectRanking(items, events).map((entry) => entry.item);
  return documentFromWorkspace(list, ranked);
}

export function selectPreviewText(
  list: WorkspaceList | null,
  items: ListItem[],
  events: ComparisonEvent[],
  format: TextFormat,
): string {
  if (list === null || items.length === 0) return '';
  return serializeDocument(selectDocument(list, items, events), format);
}

/** The object values of the active items, for the sort-field rules. */
export function selectObjectValues(items: ListItem[]) {
  return items
    .filter((item) => item.active)
    .map((item) => item.value)
    .filter(isComplexItemValue);
}

/** Every scalar field the user could pick as the label, with coverage details. */
export function selectSortFieldOptions(items: ListItem[]): LabelFieldCandidate[] {
  return collectLabelFieldCandidates(selectObjectValues(items));
}

/**
 * The shape of the imported objects, derived from the live items rather than
 * stored, so it can never go stale after an edit or import.
 */
export function selectObjectSchema(items: ListItem[]): ObjectSchemaHint {
  return describeObjectSchema(selectObjectValues(items));
}

/** Scalar fields shared by every object item — the safest sort-field choices. */
export function selectLabelFieldCandidates(items: ListItem[]): string[] {
  return selectSortFieldOptions(items)
    .filter((candidate) => candidate.coverage === 1)
    .map((candidate) => candidate.field);
}

/** Object lists cannot be ranked until the user picks the label field. */
export function selectNeedsSortField(list: WorkspaceList | null): boolean {
  return list !== null && list.kind === 'object' && list.sortField === undefined;
}

/** The label shown on a comparison card or a ranked row. */
export function selectItemLabel(item: ListItem, sortField: string | undefined): string {
  const value = item.value;
  if (!isComplexItemValue(value)) return String(value);

  const preferred = sortField === undefined ? undefined : value[sortField];
  if (typeof preferred === 'string' || typeof preferred === 'number') return String(preferred);

  const firstString = Object.values(value).find((entry) => typeof entry === 'string');
  return typeof firstString === 'string' ? firstString : 'Untitled item';
}

/** Progress summary for the status strip. */
export function selectProgress(
  items: ListItem[],
  events: ComparisonEvent[],
): { activeItems: number; comparisons: number; skips: number; coverage: number } {
  const activeItems = items.filter((item) => item.active).length;
  const rated = events.filter((event) => event.outcome !== 'skip').length;
  const skips = events.length - rated;

  // A rough "how far along am I" signal: comparisons made against the number
  // needed for a stable ordering, roughly n*log2(n).
  const target = activeItems < 2 ? 0 : Math.ceil(activeItems * Math.log2(activeItems));
  const coverage = target === 0 ? 0 : Math.min(1, rated / target);

  return { activeItems, comparisons: rated, skips, coverage };
}
