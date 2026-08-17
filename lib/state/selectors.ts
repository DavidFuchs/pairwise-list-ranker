import { buildExport } from '@/lib/export/buildExport';
import { formatPath } from '@/lib/import/arrayCandidates';
import { selectNextPair } from '@/lib/ranking/pairSelection';
import { rankItems, replayComparisons } from '@/lib/ranking/rebuildRanking';
import type { RankingStates } from '@/lib/ranking/rebuildRanking';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, RankedItem } from '@/types/ranking';
import type { PreviewTab, SourceFormat, Workspace } from '@/types/source';

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
  alreadyRanked: boolean;
  view: WorkspaceView;
}

let cache: ViewCache | null = null;

/**
 * Replay, rank, and pick the next pair in one pass, memoized on the identity of
 * the items and event arrays. The store replaces those arrays on every change,
 * so re-renders that change nothing reuse the previous result.
 */
export function selectWorkspaceView(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked = false,
): WorkspaceView {
  if (
    cache !== null &&
    cache.items === items &&
    cache.events === events &&
    cache.alreadyRanked === alreadyRanked
  ) {
    return cache.view;
  }

  const states = replayComparisons(items, events, alreadyRanked);
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

  cache = { items, events, alreadyRanked, view };
  return view;
}

export function selectRanking(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked = false,
): RankedItem<ListItem>[] {
  return selectWorkspaceView(items, events, alreadyRanked).ranking;
}

export function selectCurrentPair(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked = false,
): ActivePair | null {
  return selectWorkspaceView(items, events, alreadyRanked).pair;
}

/** The exportable text for one tab, built from the user's own document. */
export function selectExportText(
  workspace: Workspace | null,
  items: ListItem[],
  events: ComparisonEvent[],
  format: SourceFormat,
): string {
  if (workspace === null) return '';
  const ranked = selectRanking(items, events, workspace.alreadyRanked).map((entry) => entry.item);
  return buildExport(workspace.source, workspace.roles, ranked, format);
}

/** Items deleted during comparison, which the export leaves out. */
export function selectRemovedCount(items: ListItem[]): number {
  return items.filter((item) => !item.active).length;
}

/** e.g. `movies · shown by title · order written back` */
export function selectContextLine(workspace: Workspace | null): string {
  if (workspace === null) return '';

  const parts = [formatPath(workspace.source.arrayPath)];
  if (workspace.roles.labelField !== undefined) {
    parts.push(`shown by ${workspace.roles.labelField}`);
  }
  if (workspace.roles.positionField !== undefined) {
    parts.push(`${workspace.roles.positionField} written back`);
  }
  if (workspace.alreadyRanked) {
    parts.push('already ranked');
  }

  return parts.join(' · ');
}

/** Only the tabs this source can honestly produce. */
export function selectAvailableTabs(workspace: Workspace | null): PreviewTab[] {
  if (workspace === null) return ['ranked'];
  return workspace.source.format === 'list'
    ? ['ranked', 'list', 'yaml', 'json']
    : ['ranked', 'yaml', 'json'];
}

/** The label shown on a comparison card or a ranked row. */
export function selectItemLabel(item: ListItem, labelField: string | undefined): string {
  const value = item.value;
  if (!isComplexItemValue(value)) return String(value);

  const preferred = labelField === undefined ? undefined : value[labelField];
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
