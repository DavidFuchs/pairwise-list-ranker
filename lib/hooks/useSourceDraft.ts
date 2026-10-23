import { useCallback, useMemo, useState } from 'react';

import type { FormatOverride } from '@/components/data/SourceInput';
import { analyzeSource } from '@/lib/import/analyze';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { pathKey, samePath } from '@/lib/import/paths';
import { resolveRoles } from '@/lib/import/roles';
import { detectSortFields } from '@/lib/import/sortField';
import type { SortFieldCandidate } from '@/lib/import/sortField';
import { serializeDocument } from '@/lib/import/serialize';
import type { StartingOrder } from '@/types/rankingEvents';
import type { DataSource, FieldRoles, SortSpec } from '@/types/source';

const ALL_FORMATS: FormatOverride[] = ['auto', 'list', 'yaml', 'json'];

function isComplexEntry(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

export interface SourceDraftSeed {
  rawText: string;
  /** The format the text was last read as; 'auto' when omitted. */
  override?: FormatOverride;
  arrayPath: string[];
  roles: FieldRoles;
  startingOrder: StartingOrder;
  /** Path key (see pathKey) to starting order, for every list already known
   *  this session (every list in the workspace, open or not) - so
   *  revisiting one of them defaults to its own real answer, not "no
   *  particular order" just because it isn't the list this screen opened on. */
  knownLists?: Record<string, StartingOrder>;
  /** Path key to the fields each of those lists is set up with, so picking one
   *  shows its own saved fields rather than ones worked out afresh. */
  knownRoles?: Record<string, FieldRoles>;
  /** The sort of the list the seed opens on, when it was started sorted by a field. */
  sort?: SortSpec;
  /** Path key to the sort each list in the workspace was started with. */
  knownSorts?: Record<string, SortSpec>;
  /**
   * Preselects a different candidate than arrayPath - used when the screen is
   * opened specifically to choose this list (e.g. the toolbar's list switcher,
   * for a list never configured before). Deliberately separate from arrayPath:
   * that field still names the list actually being edited, so roles and
   * starting order keep defaulting fresh for a list that has no answer yet,
   * rather than inheriting the edited list's.
   */
  initialSelectedPath?: string[];
}

export interface SourceDraft {
  rawText: string;
  override: FormatOverride;
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  /** How well ordered the imported list already is; it sets the seed priors.
   *  'rough' whenever a sort is set, since a sorted list starts roughly in order. */
  startingOrder: StartingOrder;
  /** The field the selected list starts sorted by, or null. */
  sort: SortSpec | null;
  /** The selected list's fields that can order it. */
  sortFields: SortFieldCandidate[];
  entries: unknown[];
  /** The format tabs the current data can honestly be shown as. Plain list
   * drops out once an entry is more than a bare scalar, the same rule the
   * ranking screen's export tabs use. */
  availableOverrides: FormatOverride[];
  setRawText: (text: string) => void;
  /** Switching to list/yaml/json re-renders the current data in that syntax,
   * the same transform the ranking screen's preview tabs perform. */
  setOverride: (override: FormatOverride) => void;
  selectPath: (path: string[]) => void;
  setRoles: (roles: FieldRoles) => void;
  /** Replaces the text and picks one of its lists with a setup already chosen - a sample, say. */
  loadPreset: (text: string, path: string[], roles: FieldRoles) => void;
  setStartingOrder: (startingOrder: StartingOrder) => void;
  setSort: (sort: SortSpec | null) => void;
  /** The committed source, or null while a choice is still outstanding. */
  toSource: () => DataSource | null;
}

interface RolesChoice {
  labelField?: string;
  positionField?: string;
  summaryFields?: string[];
  fieldRenderers?: FieldRoles['fieldRenderers'];
  /** Distinguishes "not chosen yet" from "deliberately set to none". */
  positionCleared: boolean;
}

/**
 * Keyed by candidate path, so a field choice made for one list is never
 * offered to another - including one that coincidentally has a field of the
 * same name, which would otherwise slip past resolveRoles' compatibility
 * check undetected. A map, not a single slot: choosing a field for list2
 * must not make the app forget what was chosen for list1.
 */
type RolesOverride = Record<string, RolesChoice>;

interface StartingOrderOverride {
  /** The candidate path this choice was made for, so switching lists does not
   *  carry one list's answer onto another. */
  pathKey: string | null;
  value: StartingOrder;
}

/**
 * The data screen's whole form state. Parsing, candidate discovery, and role
 * resolution are recomputed from the text on every change, so the panel can
 * never show a choice the current text no longer supports.
 */
export function useSourceDraft(seed?: SourceDraftSeed): SourceDraft {
  const [rawText, setRawText] = useState(seed?.rawText ?? '');
  const [override, setOverrideState] = useState<FormatOverride>(seed?.override ?? 'auto');
  const [chosenPath, setChosenPath] = useState<string[] | null>(
    seed?.initialSelectedPath ?? seed?.arrayPath ?? null,
  );
  const [startingOrderOverride, setStartingOrderOverride] = useState<StartingOrderOverride | null>(null);
  const [rolesOverride, setRolesOverride] = useState<RolesOverride>({});
  // Per list, like the starting order; null is a sort deliberately cleared.
  const [sortOverride, setSortOverride] = useState<Record<string, SortSpec | null>>({});

  const analysis = useMemo(() => analyzeSource(rawText, override), [rawText, override]);

  const selectedPath = useMemo(() => {
    const stillOffered =
      chosenPath !== null && analysis.candidates.some((candidate) => samePath(candidate.path, chosenPath));
    if (stillOffered) return chosenPath;
    return analysis.candidates.length === 1 ? (analysis.candidates[0]?.path ?? null) : null;
  }, [analysis, chosenPath]);

  const entries = useMemo(
    () => (selectedPath === null ? [] : entriesAtPath(analysis.document, selectedPath)),
    [analysis, selectedPath],
  );

  // Null with nothing chosen: a document that is itself the list keys as '', so
  // '' here would hand that list whatever was set while nothing was selected.
  const selectedKey = selectedPath === null ? null : pathKey(selectedPath);

  // Per-path, not a single answer: switching to a list the user has not
  // answered this for must not inherit another list's starting order. A list
  // already known this session (knownLists, or the list this screen opened
  // on) falls back to its own real answer; a candidate never visited before
  // starts at "no particular order" until told otherwise.
  const startingOrder = useMemo((): StartingOrder => {
    if (startingOrderOverride?.pathKey === selectedKey) {
      return startingOrderOverride.value;
    }
    if (selectedPath === null || seed === undefined) return 'unordered';

    const known = selectedKey === null ? undefined : seed.knownLists?.[selectedKey];
    if (known !== undefined) return known;
    if (samePath(selectedPath, seed.arrayPath)) return seed.startingOrder;
    return 'unordered';
  }, [selectedPath, selectedKey, startingOrderOverride, seed]);

  const sortFields = useMemo(() => detectSortFields(entries), [entries]);

  // Derived, never stored: a sort whose field the list no longer offers (another
  // list picked, or the text edited) simply stops applying.
  const sort = useMemo((): SortSpec | null => {
    if (selectedKey === null || selectedPath === null) return null;
    const chosen =
      selectedKey in sortOverride
        ? sortOverride[selectedKey]
        : (seed?.knownSorts?.[selectedKey] ??
          (seed !== undefined && samePath(selectedPath, seed.arrayPath) ? seed.sort : undefined));
    if (chosen === null || chosen === undefined) return null;
    return sortFields.some((candidate) => candidate.field === chosen.field) ? chosen : null;
  }, [selectedKey, selectedPath, sortOverride, seed, sortFields]);

  const setSort = useCallback(
    (next: SortSpec | null) => {
      if (selectedKey === null) return;
      setSortOverride((current) => ({ ...current, [selectedKey]: next }));
    },
    [selectedKey],
  );

  const setStartingOrder = useCallback(
    (value: StartingOrder) => {
      setStartingOrderOverride({ pathKey: selectedKey, value });
    },
    [selectedKey],
  );

  // Per-path, like startingOrder above: a field choice made for one list must
  // never be offered to a different one, even when that list happens to have
  // a field of the same name - only the list the choice was actually made
  // for gets to keep it.
  const roles = useMemo(() => {
    const choice = selectedKey === null ? undefined : rolesOverride[selectedKey];

    const known = selectedKey === null ? undefined : seed?.knownRoles?.[selectedKey];

    const previous =
      choice !== undefined
        ? {
            labelField: choice.labelField,
            positionField: choice.positionField,
            summaryFields: choice.summaryFields,
            fieldRenderers: choice.fieldRenderers,
          }
        : selectedPath !== null && seed !== undefined && samePath(selectedPath, seed.arrayPath)
          ? {
              labelField: seed.roles.labelField,
              positionField: seed.roles.positionField,
              summaryFields: seed.roles.summaryFields,
              fieldRenderers: seed.roles.fieldRenderers,
            }
          : (known ?? {});

    const resolved = resolveRoles(entries, previous);
    if (choice === undefined || !choice.positionCleared) return resolved;
    return { ...resolved, positionField: undefined };
  }, [entries, rolesOverride, selectedPath, selectedKey, seed]);

  const availableOverrides = useMemo(() => {
    const complex = entries.some(isComplexEntry);
    return complex ? ALL_FORMATS.filter((format) => format !== 'list') : ALL_FORMATS;
  }, [entries]);

  const setOverride = useCallback(
    (next: FormatOverride) => {
      // 'auto' isn't a syntax to render into, and re-clicking the active tab
      // shouldn't reformat text the user may have hand-edited since.
      const canTransform = next !== 'auto' && next !== override && analysis.issues.length === 0;

      if (canTransform && next === 'list' && entries.length > 0 && !entries.some(isComplexEntry)) {
        setRawText(`${entries.map(String).join('\n')}\n`);
      } else if (canTransform && (next === 'yaml' || next === 'json')) {
        setRawText(serializeDocument(analysis.document, next));
      }

      setOverrideState(next);
    },
    [analysis, entries, override],
  );

  const setRoles = useCallback(
    (next: FieldRoles) => {
      if (selectedKey === null) return;
      setRolesOverride((current) => ({
        ...current,
        [selectedKey]: {
          labelField: next.labelField,
          positionField: next.positionField,
          summaryFields: next.summaryFields,
          fieldRenderers: next.fieldRenderers,
          positionCleared: next.positionField === undefined,
        },
      }));
    },
    [selectedKey],
  );

  // One step, so the setup is recorded against the list it belongs to before
  // any render resolves roles from the new text on its own.
  const loadPreset = useCallback((text: string, path: string[], preset: FieldRoles) => {
    setRawText(text);
    setChosenPath(path);
    setRolesOverride((current) => ({
      ...current,
      [pathKey(path)]: {
        labelField: preset.labelField,
        positionField: preset.positionField,
        summaryFields: preset.summaryFields,
        fieldRenderers: preset.fieldRenderers,
        positionCleared: preset.positionField === undefined,
      },
    }));
  }, []);

  const toSource = useCallback((): DataSource | null => {
    if (selectedPath === null || analysis.issues.length > 0) return null;
    return {
      format: analysis.format,
      document: analysis.document,
      arrayPath: selectedPath,
    };
  }, [analysis, selectedPath]);

  return {
    rawText,
    override,
    analysis,
    selectedPath,
    roles,
    startingOrder: sort === null ? startingOrder : 'rough',
    sort,
    sortFields,
    entries,
    availableOverrides,
    setRawText,
    setOverride,
    selectPath: setChosenPath,
    setRoles,
    loadPreset,
    setStartingOrder,
    setSort,
    toSource,
  };
}
