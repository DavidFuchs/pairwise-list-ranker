import { buildExport } from '@/lib/export/buildExport';
import { entriesAtPath, findArrayCandidates, formatPath } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { pathKey, samePath } from '@/lib/import/paths';
import { activeList, listAt } from '@/lib/state/lists';
import { resolveRoles } from '@/lib/import/roles';
import { rendererNote } from '@/lib/renderers';
import { selectNextPair } from '@/lib/ranking/pairSelection';
import { rankItems, replayComparisons } from '@/lib/ranking/rebuildRanking';
import type { RankingStates } from '@/lib/ranking/rebuildRanking';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, RankedItem } from '@/types/ranking';
import type { FieldRoles, ListConfig, PreviewTab, RankedList, SourceFormat, Workspace } from '@/types/source';

export interface ActivePair {
  left: ListItem;
  right: ListItem;
}

export interface WorkspaceView {
  states: RankingStates;
  ranking: RankedItem<ListItem>[];
  pair: ActivePair | null;
}

/**
 * Results by events array, then items array, then the alreadyRanked flag. The
 * store replaces those arrays on every change, so a hit means nothing has
 * changed, and a WeakMap lets old arrays go once nothing holds them. Keyed
 * rather than one slot so that ranking a list that is not open, or a second
 * store, does not evict the open list's result.
 */
const viewCache = new WeakMap<ComparisonEvent[], WeakMap<ListItem[], Map<boolean, WorkspaceView>>>();

function cachedView(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked: boolean,
  build: () => WorkspaceView,
): WorkspaceView {
  let byItems = viewCache.get(events);
  if (byItems === undefined) {
    byItems = new WeakMap();
    viewCache.set(events, byItems);
  }
  let byFlag = byItems.get(items);
  if (byFlag === undefined) {
    byFlag = new Map();
    byItems.set(items, byFlag);
  }
  let view = byFlag.get(alreadyRanked);
  if (view === undefined) {
    view = build();
    byFlag.set(alreadyRanked, view);
  }
  return view;
}

/**
 * Replay, rank, and pick the next pair in one pass, memoized on the identity of
 * the items and event arrays, so re-renders that change nothing reuse the
 * previous result.
 */
export function selectWorkspaceView(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked = false,
): WorkspaceView {
  return cachedView(items, events, alreadyRanked, () => {
    const states = replayComparisons(items, events, alreadyRanked);
    const ranking = rankItems(items, states, events);
    const candidate = selectNextPair(items, states, events);

    const byId = new Map(items.map((item) => [item.id, item]));
    const left = candidate === null ? undefined : byId.get(candidate.leftItemId);
    const right = candidate === null ? undefined : byId.get(candidate.rightItemId);

    return { states, ranking, pair: left && right ? { left, right } : null };
  });
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
export function selectExportText(workspace: Workspace | null, format: SourceFormat): string {
  if (workspace === null) return '';
  const list = activeList(workspace);
  const ranked = selectRanking(list.items, list.comparisonEvents, list.alreadyRanked).map(
    (entry) => entry.item,
  );
  return buildExport(workspace.source, list.roles, ranked, format);
}

/** Items deleted during comparison, which the export leaves out. */
export function selectRemovedCount(items: ListItem[]): number {
  return items.filter((item) => !item.active).length;
}

/**
 * How one list is set up, without naming it: `shown by title · already ranked`.
 * Empty for a plain list in no particular order, which has nothing to say.
 * Both list pickers show this per row, so what a row promises before you pick
 * it and what the toolbar says afterwards are the same words.
 */
export function describeRoles(roles: FieldRoles, alreadyRanked: boolean): string {
  const parts: string[] = [];
  if (roles.labelField !== undefined) parts.push(`shown by ${roles.labelField}`);
  if (roles.summaryFields !== undefined && roles.summaryFields.length > 0)
    parts.push(
      `showing ${roles.summaryFields
        .map((field) => {
          const renderer = roles.fieldRenderers?.[field];
          return renderer === undefined ? field : `${field} (${rendererNote(renderer)})`;
        })
        .join(', ')}`,
    );
  if (roles.positionField !== undefined) parts.push(`${roles.positionField} written back`);
  if (alreadyRanked) parts.push('already ranked');

  return parts.join(' · ');
}

/** e.g. `movies · shown by title · order written back` */
export function selectContextLine(workspace: Workspace | null): string {
  if (workspace === null) return '';

  const list = activeList(workspace);
  const name = formatPath(list.arrayPath);
  const roles = describeRoles(list.roles, list.alreadyRanked);

  return roles === '' ? name : `${name} · ${roles}`;
}

/**
 * The setup one list in the document would be ranked with. A list the user set
 * up by hand answers for itself, whether it is open or not. Every other list
 * takes the document's defaults - resolveRoles keeps the default field only
 * where that list can honour it, and falls back to the list's own best field
 * otherwise. Deriving is what lets the switcher move to a new list in one press
 * instead of sending the user through the data screen first; every picker row
 * shows the answer, so a wrong guess is visible and one Configure away from
 * being fixed.
 *
 * The open list always answers for itself, set up by hand or not: the
 * comparison deck and the export read those same fields, so a row claiming
 * anything else would be describing a list that is not on screen.
 */
export function selectListConfig(workspace: Workspace | null, path: string[]): ListConfig {
  if (workspace === null) return { roles: {}, alreadyRanked: false };

  const list = listAt(workspace, path);
  if (list !== undefined && (list.configuredExplicitly || samePath(path, workspace.source.arrayPath))) {
    return { roles: list.roles, alreadyRanked: list.alreadyRanked };
  }
  return derivedConfig(workspace.source.document, workspace.listDefaults, path);
}

/** By document, then defaults, then path: a pass over every entry of the list. */
const derivedConfigCache = new WeakMap<object, WeakMap<ListConfig, Map<string, ListConfig>>>();

function derivedConfig(document: unknown, defaults: ListConfig, path: string[]): ListConfig {
  const derive = (): ListConfig => ({
    roles: resolveRoles(entriesAtPath(document, path), defaults.roles),
    alreadyRanked: defaults.alreadyRanked,
  });
  if (typeof document !== 'object' || document === null) return derive();

  let byDefaults = derivedConfigCache.get(document);
  if (byDefaults === undefined) {
    byDefaults = new WeakMap();
    derivedConfigCache.set(document, byDefaults);
  }
  let byPath = byDefaults.get(defaults);
  if (byPath === undefined) {
    byPath = new Map();
    byDefaults.set(defaults, byPath);
  }
  const key = pathKey(path);
  let config = byPath.get(key);
  if (config === undefined) {
    config = derive();
    byPath.set(key, config);
  }
  return config;
}

/** Only the tabs this source can honestly produce. */
export function selectAvailableTabs(workspace: Workspace | null): PreviewTab[] {
  if (workspace === null) return ['ranked'];
  return workspace.source.format === 'list' ? ['ranked', 'list', 'yaml', 'json'] : ['ranked', 'yaml', 'json'];
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
): {
  activeItems: number;
  comparisons: number;
  skips: number;
  coverage: number;
  earnedCoverage: number;
} {
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

  // The same figure without the import's credit: what the comparisons alone
  // have paid for. The meter needs both to show which part of its run the user
  // has earned and which part is still the import's word.
  return {
    activeItems,
    comparisons: rated,
    skips,
    coverage,
    earnedCoverage: fromComparisons,
  };
}

/**
 * A meter's two readings: the coverage it shows, and the part of that coverage
 * comparisons alone earned. Carried together wherever a list's progress travels
 * to a meter, since the bar cannot hatch the difference without both.
 */
export interface CoverageReading {
  coverage: number;
  earned: number;
}

/** A list's meter reading, or undefined while it has no progress to show. */
export function selectCoverage(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked: boolean,
): CoverageReading | undefined {
  const progress = selectProgress(items, events, alreadyRanked);
  return progress.coverage > 0 ? { coverage: progress.coverage, earned: progress.earnedCoverage } : undefined;
}

/** One list in the document, as the list switcher offers it. */
export interface ListOption extends ArrayCandidate {
  /** The setup it would be ranked with; see describeRoles. */
  configLine: string;
  /** Its ranking progress, if it has any yet. */
  coverage?: CoverageReading;
}

const coverageCache = new WeakMap<RankedList, CoverageReading | null>();

/** selectCoverage for a list, kept while the list is unchanged. */
function listCoverage(list: RankedList): CoverageReading | undefined {
  let coverage = coverageCache.get(list);
  if (coverage === undefined) {
    coverage = selectCoverage(list.items, list.comparisonEvents, list.alreadyRanked) ?? null;
    coverageCache.set(list, coverage);
  }
  return coverage ?? undefined;
}

const candidatesCache = new WeakMap<object, ArrayCandidate[]>();

/** The lists a document holds. A walk of the whole document, so kept with it. */
function candidatesOf(document: unknown): ArrayCandidate[] {
  if (typeof document !== 'object' || document === null) return findArrayCandidates(document).candidates;
  let candidates = candidatesCache.get(document);
  if (candidates === undefined) {
    candidates = findArrayCandidates(document).candidates;
    candidatesCache.set(document, candidates);
  }
  return candidates;
}

/**
 * Every list in the document, with the setup it would be ranked with and its
 * progress. The expensive parts - walking the document, resolving roles for a
 * list never opened, reading a list's progress - are each kept until what they
 * read changes, so a click recomputes only the open list's meter.
 */
export function selectListOptions(workspace: Workspace): ListOption[] {
  return candidatesOf(workspace.source.document).map((candidate): ListOption => {
    const config = selectListConfig(workspace, candidate.path);
    const list = listAt(workspace, candidate.path);
    return {
      ...candidate,
      configLine: describeRoles(config.roles, config.alreadyRanked),
      coverage: list === undefined ? undefined : listCoverage(list),
    };
  });
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
 * Everything the meter needs to draw itself and say what it means: the accent
 * run, the part of that run nobody has earned yet, the gold coat over it, one
 * number that agrees with all three, and the note that appears once the
 * estimate is behind the user.
 *
 * `earnedCoverage` is the same reading with the import's credit stripped out.
 * A list marked already ranked is handed the whole estimate on its word, which
 * would otherwise draw the same full accent run as an afternoon of comparisons.
 * Passing what the comparisons alone paid for lets the bar hatch the
 * difference, and the claim converts to solid as the work lands. It defaults to
 * the coverage itself, which claims nothing: a list with no credit to strip has
 * earned everything it shows.
 */
export function describeCoverage(
  coverage: number,
  earnedCoverage: number = coverage,
): {
  label: string;
  valueText: string;
  filled: number;
  claimed: number;
  surplus: number;
  note: string | null;
} {
  const percent = Math.round(coverage * 100);
  const capped = percent > SURPLUS_CAP;
  const label = capped ? `${SURPLUS_CAP}%+` : `${percent}%`;
  // "200%+" is a glyph, not a sentence; spoken aloud it wants words.
  const spoken = capped ? `over ${SURPLUS_CAP}%` : label;

  const filled = Math.min(100, percent);
  // Never negative: comparisons past the estimate overshoot the accent run, and
  // overshooting it is not owing anything to the import.
  const claimed = Math.max(0, filled - Math.round(earnedCoverage * 100));

  // Colour is the whole signal for the claimed run, so the readout has to carry
  // it too. Once every point has been earned the clause goes away rather than
  // reporting a credit of nothing.
  const credit =
    claimed === 0
      ? null
      : claimed === filled
        ? 'credited to the order you imported'
        : `${claimed}% of it still credited to the order you imported`;

  const parts = [spoken, percent > 100 ? 'past the estimate' : null, credit].filter(
    (part): part is string => part !== null,
  );

  return {
    label,
    valueText: parts.join(', '),
    filled,
    claimed,
    surplus: Math.min(100, Math.max(0, percent - 100)),
    // Tied to the number on screen rather than to raw coverage, so the note
    // arrives with the 100% the user can actually read.
    note: percent >= 100 ? ESTIMATE_MET_NOTE : null,
  };
}

/** Adjacent ratings further apart than this are settled without a head-to-head. */
export const STABLE_GAP = 60;

export interface StabilityReading {
  /** Neighbouring pairs in the current order. */
  pairs: number;
  /** Neighbours nobody has compared and whose ratings are still close. */
  unresolved: number;
}

/**
 * How settled the order is, measured where it can still move: between
 * neighbours. A pair is resolved once the two have been compared directly (a
 * skip does not count) or their ratings sit far enough apart that one more
 * click is unlikely to swap them. Far-apart items are not asked about at all,
 * which is why this settles well before every pair has been seen.
 */
export function selectStability(
  ranking: RankedItem<ListItem>[],
  events: ComparisonEvent[],
): StabilityReading {
  const met = new Set<string>();
  for (const event of events) {
    if (event.outcome === 'skip') continue;
    met.add(`${event.leftItemId} ${event.rightItemId}`);
    met.add(`${event.rightItemId} ${event.leftItemId}`);
  }

  let unresolved = 0;
  for (let i = 0; i + 1 < ranking.length; i += 1) {
    const upper = ranking[i]!;
    const lower = ranking[i + 1]!;
    const compared = met.has(`${upper.item.id} ${lower.item.id}`);
    const apart = upper.state.rating - lower.state.rating >= STABLE_GAP;
    if (!compared && !apart) unresolved += 1;
  }

  return { pairs: Math.max(0, ranking.length - 1), unresolved };
}

/** One line for the status strip; nothing until there is an order to judge. */
export function describeStability(reading: StabilityReading): string {
  if (reading.pairs === 0) return '';
  if (reading.unresolved === 0) {
    return 'Every item is settled against its neighbours. The order is ready to export.';
  }
  return reading.unresolved === 1
    ? '1 place in the order is still a close call.'
    : `${reading.unresolved} places in the order are still close calls.`;
}
