import { engineHost } from '@/lib/engine/engineHost';
import { countAnswers } from '@/lib/state/counts';
import { buildExport, buildExportDocument } from '@/lib/export/buildExport';
import { entriesAtPath, findArrayCandidates, formatPath } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { pathKey, samePath } from '@/lib/import/paths';
import { isPlainObject } from '@/lib/import/shape';
import { describeSort, detectSortFields } from '@/lib/import/sortField';
import type { SortKind } from '@/lib/import/sortField';
import { activeList, allLists, listAt } from '@/lib/state/lists';
import { resolveRoles } from '@/lib/import/roles';
import { rendererNote } from '@/lib/renderers';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { StartingOrder } from '@/types/rankingEvents';
import type {
  FieldRoles,
  ListConfig,
  PreviewTab,
  RankedList,
  SortSpec,
  SourceFormat,
  Workspace,
} from '@/types/source';

/**
 * The user's document as it stands (docs/ARCHITECTURE.md 7.4): every list opened
 * so far written back at its own path in its current ranked order, except the
 * open one, which buildExport writes in. A list never opened keeps the order
 * the document gives it. Export starts from this.
 */
export function selectDocumentNow(workspace: Workspace): unknown {
  const open = activeList(workspace);
  let document = workspace.source.document;
  for (const list of allLists(workspace)) {
    if (list === open) continue;
    document = buildExportDocument(
      { format: workspace.source.format, document, arrayPath: list.arrayPath },
      list.roles,
      engineHost.rankingNow(list).map((item) => item.value),
    );
  }
  return document;
}

/** The exportable text for one tab: the document as it stands, every ranked list in its order. */
export function selectExportText(workspace: Workspace | null, format: SourceFormat): string {
  if (workspace === null) return '';
  const list = activeList(workspace);
  return buildExport(
    { ...workspace.source, document: selectDocumentNow(workspace) },
    list.roles,
    engineHost.rankingNow(list),
    format,
  );
}

/**
 * How one list is set up, without naming it: `shown by title · already ranked`.
 * Empty for a plain list in no particular order, which has nothing to say.
 * Both list pickers show this per row, so what a row promises before you pick
 * it and what the toolbar says afterwards are the same words.
 */
export function describeRoles(roles: FieldRoles, startingOrder: StartingOrder, sort?: string): string {
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
  if (startingOrder === 'rough')
    parts.push(sort === undefined ? 'roughly in order' : `roughly in order · ${sort}`);
  else if (startingOrder === 'ranked') parts.push('already ranked');

  return parts.join(' · ');
}

/**
 * "sorted by plays, high to low" for a sort over these entries. The kind comes
 * from the entries as they are now; a field no longer found reads as a number.
 */
export function describeSortOver(spec: SortSpec, entries: unknown[]): string {
  const kind = detectSortFields(entries).find((candidate) => candidate.field === spec.field)?.kind;
  return describeSort(spec, kind ?? 'number');
}

/** The kind each sort field read as, by the items array it was worked out from. */
const sortKindCache = new WeakMap<ListItem[], Map<string, SortKind | undefined>>();

/** What a list says about its sort, or undefined when it has none. */
export function describeListSort(list: RankedList): string | undefined {
  const spec = list.initialSort;
  if (spec === undefined) return undefined;

  // Reading every entry of a long list is too much to repeat per render.
  let byField = sortKindCache.get(list.items);
  if (byField === undefined) {
    byField = new Map();
    sortKindCache.set(list.items, byField);
  }
  if (!byField.has(spec.field)) {
    byField.set(
      spec.field,
      detectSortFields(list.items.map((item) => item.value)).find(
        (candidate) => candidate.field === spec.field,
      )?.kind,
    );
  }
  return describeSort(spec, byField.get(spec.field) ?? 'number');
}

/** e.g. `movies · shown by title · order written back` */
export function selectContextLine(workspace: Workspace | null): string {
  if (workspace === null) return '';

  const list = activeList(workspace);
  const name = formatPath(list.arrayPath);
  const roles = describeRoles(list.roles, list.initialStartingOrder, describeListSort(list));

  return roles === '' ? name : `${name} · ${roles}`;
}

/**
 * The setup one list in the document would be ranked with. A list the user set
 * up by hand answers for itself, whether it is open or not. Every other list
 * takes the document's defaults - resolveRoles keeps the default field only
 * where that list can honour it, and falls back to the list's own best field
 * otherwise. Deriving is what lets the switcher move to a new list in one press
 * instead of sending the user through list setup first; every picker row
 * shows the answer, so a wrong guess is visible and one Configure away from
 * being fixed.
 *
 * The open list always answers for itself, set up by hand or not: the
 * comparison deck and the export read those same fields, so a row claiming
 * anything else would be describing a list that is not on screen.
 */
export function selectListConfig(workspace: Workspace | null, path: string[]): ListConfig {
  if (workspace === null) return { roles: {}, startingOrder: 'unordered' };

  const list = listAt(workspace, path);
  if (list !== undefined && (list.configuredExplicitly || samePath(path, workspace.source.arrayPath))) {
    return { roles: list.roles, startingOrder: list.initialStartingOrder };
  }
  // A list with history keeps its own starting order: defaults reach a list only when it is new (docs/ARCHITECTURE.md 6.4).
  const derived = derivedConfig(workspace.source.document, workspace.listDefaults, path);
  return list !== undefined && list.events.length > 0
    ? { roles: derived.roles, startingOrder: list.initialStartingOrder }
    : derived;
}

/**
 * Whether a list the user has not opened yet carries the title field the
 * document's defaults name. The other default fields are optional and simply
 * left off a list that lacks them (see resolveRoles), but without the title the
 * derived setup would be a guess about a different kind of list, so the
 * switcher sends the user to setup instead.
 */
export function selectTitleFits(workspace: Workspace, path: string[]): boolean {
  const { labelField } = workspace.listDefaults.roles;
  if (labelField === undefined) return true;

  return entriesAtPath(workspace.source.document, path).some(
    (entry) => isPlainObject(entry) && labelField in entry,
  );
}

/** By document, then defaults, then path: a pass over every entry of the list. */
const derivedConfigCache = new WeakMap<object, WeakMap<ListConfig, Map<string, ListConfig>>>();

function derivedConfig(document: unknown, defaults: ListConfig, path: string[]): ListConfig {
  const derive = (): ListConfig => ({
    roles: resolveRoles(entriesAtPath(document, path), defaults.roles),
    startingOrder: defaults.startingOrder,
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

/** One list in the document, as the list switcher offers it. */
export interface ListOption extends ArrayCandidate {
  /** The setup it would be ranked with; see describeRoles. */
  configLine: string;
  /** Answers given on it so far; absent for a list never opened. */
  answers?: number;
}

const answersCache = new WeakMap<RankedList, number>();

/** countAnswers for a list, kept while the list is unchanged. */
export function listAnswers(list: RankedList): number {
  let answers = answersCache.get(list);
  if (answers === undefined) {
    answers = countAnswers(list.events);
    answersCache.set(list, answers);
  }
  return answers;
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
 * answer count. The expensive parts - walking the document, resolving roles
 * for a list never opened, counting a list's answers - are each kept until
 * what they read changes, so a click recounts only the open list.
 */
export function selectListOptions(workspace: Workspace): ListOption[] {
  return candidatesOf(workspace.source.document).map((candidate): ListOption => {
    const config = selectListConfig(workspace, candidate.path);
    const list = listAt(workspace, candidate.path);
    return {
      ...candidate,
      configLine: describeRoles(
        config.roles,
        config.startingOrder,
        list === undefined ? undefined : describeListSort(list),
      ),
      answers: list === undefined ? undefined : listAnswers(list),
    };
  });
}

const countFormat = new Intl.NumberFormat('en-US');

export function formatCount(n: number): string {
  return countFormat.format(n);
}

/** The status strip's count (docs/ARCHITECTURE.md 6.12): "312 answers so far", or "1 answer so far". */
export function describeAnswers(answers: number): string {
  return `${formatCount(answers)} ${answers === 1 ? 'answer' : 'answers'} so far`;
}

/**
 * The status strip in full: the size of the list being ranked, then the answers,
 * as "120 items · 312 answers so far". Without a size, only the answers.
 */
export function describeCounts(items: number | undefined, answers: number): string {
  if (items === undefined) return describeAnswers(answers);
  return `${formatCount(items)} ${items === 1 ? 'item' : 'items'} · ${describeAnswers(answers)}`;
}
