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
  alreadyRanked = false,
): { activeItems: number; comparisons: number; skips: number; coverage: number } {
  const activeItems = items.filter((item) => item.active).length;
  const rated = events.filter((event) => event.outcome !== 'skip').length;
  const skips = events.length - rated;

  // A rough "how far along am I" signal: comparisons made against the number
  // needed for a stable ordering, roughly n*log2(n).
  //
  // Deliberately not clamped at 1. The target is an estimate, not a finish
  // line, and comparisons past it still sharpen the order - so capping here
  // would freeze the meter and tell the user their work had stopped counting.
  const target = activeItems < 2 ? 0 : Math.ceil(activeItems * Math.log2(activeItems));
  const fromComparisons = target === 0 ? 0 : rated / target;
  // A list declared already ranked starts fully credited - the order is
  // trusted from the outset - and further comparisons still sharpen it past
  // that point, the same as surplus work on any other list.
  const coverage = target === 0 ? 0 : alreadyRanked ? 1 + fromComparisons : fromComparisons;

  return { activeItems, comparisons: rated, skips, coverage };
}

/**
 * The plating is complete at twice the estimate, so the number stops there
 * too: past that point it no longer describes anything the user can see, and
 * a figure climbing to 500% reads as a malfunction rather than as credit.
 */
const SURPLUS_CAP = 200;

/**
 * Said once the estimate is met. The target is n*log2(n), the comparisons a
 * list this size usually takes to settle, so reaching it means the broad order
 * is trustworthy - not that every pair has been resolved. The items still
 * unsettled are the near-neighbours, which is exactly what further rounds go
 * after, so the line has to invite more work without implying the ranking is
 * unusable until then.
 */
const ESTIMATE_MET_NOTE =
  'The list is sorted well enough to use. Keep going and each comparison sharpens the pairs that are still close.';

/**
 * Everything the meter needs to draw itself and say what it means: the green
 * run, the gold coat over it, one number that agrees with both, and the note
 * that appears once the estimate is behind the user.
 */
export function describeCoverage(coverage: number): {
  label: string;
  valueText: string;
  filled: number;
  surplus: number;
  note: string | null;
} {
  const percent = Math.round(coverage * 100);
  const capped = percent > SURPLUS_CAP;
  const label = capped ? `${SURPLUS_CAP}%+` : `${percent}%`;
  // "200%+" is a glyph, not a sentence; spoken aloud it wants words.
  const spoken = capped ? `over ${SURPLUS_CAP}%` : label;

  return {
    label,
    valueText: percent > 100 ? `${spoken}, past the estimate` : spoken,
    filled: Math.min(100, percent),
    surplus: Math.min(100, Math.max(0, percent - 100)),
    // Tied to the number on screen rather than to raw coverage, so the note
    // arrives with the 100% the user can actually read.
    note: percent >= 100 ? ESTIMATE_MET_NOTE : null,
  };
}
