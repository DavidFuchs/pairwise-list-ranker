/**
 * What the setup screen derives from the store: the text it opens with, each
 * list's answer count, and each list's setup line. Kept here rather than in the
 * screen so it can be tested without rendering one.
 */

import type { SourceDraftSeed } from '@/lib/hooks/useSourceDraft';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { serializeDocument } from '@/lib/import/serialize';
import { pathKey, samePath } from '@/lib/import/paths';
import { allLists, listAt } from '@/lib/state/lists';
import {
  describeListSort,
  describeRoles,
  describeSortOver,
  listAnswers,
  selectListConfig,
} from '@/lib/state/selectors';
import type { PasteDraftState } from '@/lib/state/pasteDraft';
import type { ListState } from '@/lib/state/useListStore';
import type { StartingOrder } from '@/types/rankingEvents';
import type { FieldRoles, SortSpec, Workspace } from '@/types/source';

/**
 * What list setup opens with for a list already being ranked: the document as
 * it is stored, not rewritten with the ranking order, and the setup of the list
 * to show. That is the open list, or the one `path` names (the list switcher's
 * Configure), which starts from the setup it has, or would be ranked with.
 */
export function buildSetupSeed(
  state: Pick<ListState, 'workspace'>,
  path?: string[],
): SourceDraftSeed | undefined {
  const { workspace } = state;
  if (workspace === null) return undefined;
  const { source } = workspace;

  const shown = path ?? source.arrayPath;
  const config = selectListConfig(workspace, shown);
  const sort = listAt(workspace, shown)?.initialSort;
  const knownLists: Record<string, StartingOrder> = {};
  const knownRoles: Record<string, FieldRoles> = {};
  const knownSorts: Record<string, SortSpec> = {};
  for (const list of allLists(workspace)) {
    const key = pathKey(list.arrayPath);
    knownLists[key] = list.initialStartingOrder;
    // What the switcher row and Configure show: the list's own, or the defaults' reading of it.
    knownRoles[key] = selectListConfig(workspace, list.arrayPath).roles;
    if (list.initialSort !== undefined) knownSorts[key] = list.initialSort;
  }

  return {
    rawText:
      source.format === 'list'
        ? `${(Array.isArray(source.document) ? source.document : []).map(String).join('\n')}\n`
        : serializeDocument(source.document, source.format),
    override: source.format,
    arrayPath: shown,
    roles: config.roles,
    startingOrder: config.startingOrder,
    knownLists,
    knownRoles,
    knownSorts,
    ...(sort === undefined ? {} : { sort }),
  };
}

/** Whether two sets of roles draw the same cards, an absent field and an empty one alike. */
export function sameRoles(a: FieldRoles, b: FieldRoles): boolean {
  return (
    a.labelField === b.labelField &&
    a.positionField === b.positionField &&
    (a.summaryFields ?? []).join('\u0000') === (b.summaryFields ?? []).join('\u0000') &&
    JSON.stringify(a.fieldRenderers ?? {}) === JSON.stringify(b.fieldRenderers ?? {})
  );
}

/**
 * The answers given on every list that has any, open or not, for the data
 * screen's list rows. Keyed by pathKey; a list with none is absent.
 */
export function selectAnswerCounts(workspace: Workspace | null): Record<string, number> {
  const counts: Record<string, number> = {};
  if (workspace === null) return counts;

  for (const list of allLists(workspace)) {
    const answers = listAnswers(list);
    if (answers > 0) counts[pathKey(list.arrayPath)] = answers;
  }
  return counts;
}

/** The list being set up on screen, and the answers its controls show now. */
export interface SelectedSetup {
  path: string[];
  roles: FieldRoles;
  startingOrder: StartingOrder;
  /** The sort chosen for it, when the starting order is taken from a field. */
  sort?: SortSpec;
}

/**
 * What each list would be ranked with, shown on its row the same way the
 * toolbar's switcher shows it. The list being edited follows the controls
 * instead of what is saved, so its row never contradicts the answers visible
 * on the same screen. Keyed by pathKey.
 */
export function selectConfigLines(
  workspace: Workspace | null,
  document: unknown,
  candidates: ArrayCandidate[],
  selected: SelectedSetup | null,
): Record<string, string> {
  // Read against the text on screen, which may have been edited since it was saved.
  const scope = workspace === null ? null : { ...workspace, source: { ...workspace.source, document } };

  const lines: Record<string, string> = {};
  for (const candidate of candidates) {
    const config =
      selected !== null && samePath(candidate.path, selected.path)
        ? selected
        : selectListConfig(scope, candidate.path);
    // A list that was started sorted says so, whether or not it is open.
    const list = scope === null ? undefined : listAt(scope, candidate.path);
    const sort = list === undefined ? undefined : describeListSort(list);
    lines[pathKey(candidate.path)] = describeRoles(config.roles, config.startingOrder, sort);
  }
  if (selected !== null) {
    const sort =
      selected.sort === undefined
        ? undefined
        : describeSortOver(selected.sort, entriesAtPath(document, selected.path));
    lines[pathKey(selected.path)] = describeRoles(selected.roles, selected.startingOrder, sort);
  }
  return lines;
}

/**
 * What the list setup screen opens with for a new list: the pasted text read
 * as the paste page left it, and a sample's own list and fields when one was
 * loaded, its other lists set up the same way. Everything else starts fresh.
 */
export function pasteSeed(paste: Pick<PasteDraftState, 'rawText' | 'override' | 'preset'>): SourceDraftSeed {
  const roles = paste.preset?.roles ?? {};
  return {
    rawText: paste.rawText,
    override: paste.override,
    arrayPath: paste.preset?.path ?? [],
    roles,
    startingOrder: 'unordered',
    initialSelectedPath: paste.preset?.path,
    knownRoles: Object.fromEntries((paste.preset?.siblingPaths ?? []).map((path) => [pathKey(path), roles])),
  };
}
