/**
 * What the data screen derives from the store: the text it opens with, each
 * list's meter, and each list's setup line. Kept here rather than in the
 * screen so it can be tested without rendering one.
 */
import { buildExport, buildExportDocument } from '@/lib/export/buildExport';
import type { SourceDraftSeed } from '@/lib/hooks/useSourceDraft';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { pathKey, samePath } from '@/lib/import/paths';
import { activeList, allLists } from '@/lib/state/lists';
import { describeRoles, selectCoverage, selectListConfig, selectRanking } from '@/lib/state/selectors';
import type { CoverageReading } from '@/lib/state/selectors';
import type { ListState } from '@/lib/state/useListStore';
import type { FieldRoles, Workspace } from '@/types/source';

/**
 * Every list already known this session, for the "already ranked" default, and
 * the document rewritten so each list's array holds its *current* ranked
 * order, not the order it was imported in. Editing your data should show what
 * ranking made of it, the same way the export tabs already do.
 */
export function buildDraftSeed(state: Pick<ListState, 'workspace' | 'pendingSwitchPath'>): SourceDraftSeed | undefined {
  const { workspace } = state;
  if (workspace === null) return undefined;
  const open = activeList(workspace);

  const knownLists: Record<string, boolean> = {};
  let document = workspace.source.document;
  for (const list of allLists(workspace)) {
    knownLists[pathKey(list.arrayPath)] = list.alreadyRanked;
    if (list === open) continue;
    const ranking = selectRanking(list.items, list.comparisonEvents, list.alreadyRanked);
    document = buildExportDocument(
      { format: workspace.source.format, document, arrayPath: list.arrayPath },
      list.roles,
      ranking.map((entry) => entry.item.value),
    );
  }

  // The open list last, written into the text the screen opens with.
  const ranking = selectRanking(open.items, open.comparisonEvents, open.alreadyRanked);
  const rawText = buildExport(
    { ...workspace.source, document },
    open.roles,
    ranking.map((entry) => entry.item),
    workspace.source.format,
  );

  return {
    rawText,
    arrayPath: open.arrayPath,
    roles: open.roles,
    alreadyRanked: open.alreadyRanked,
    knownLists,
    initialSelectedPath: state.pendingSwitchPath ?? undefined,
  };
}

/**
 * Every list that already has a ranking percent earns a meter, whether that
 * came from real comparisons, from being declared already ranked, or both, and
 * whether it is open or not. Keyed by pathKey; a list with no reading is absent.
 */
export function selectRankedCoverages(workspace: Workspace | null): Record<string, CoverageReading> {
  const coverages: Record<string, CoverageReading> = {};
  if (workspace === null) return coverages;

  for (const list of allLists(workspace)) {
    const coverage = selectCoverage(list.items, list.comparisonEvents, list.alreadyRanked);
    if (coverage !== undefined) coverages[pathKey(list.arrayPath)] = coverage;
  }
  return coverages;
}

/** The list being set up on screen, and the answers its controls show now. */
export interface SelectedSetup {
  path: string[];
  roles: FieldRoles;
  alreadyRanked: boolean;
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
    lines[pathKey(candidate.path)] = describeRoles(config.roles, config.alreadyRanked);
  }
  if (selected !== null) {
    lines[pathKey(selected.path)] = describeRoles(selected.roles, selected.alreadyRanked);
  }
  return lines;
}
