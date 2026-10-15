import { useCallback, useMemo, useState } from 'react';

import type { FormatOverride } from '@/components/data/SourceInput';
import { analyzeSource } from '@/lib/import/analyze';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { resolveRoles } from '@/lib/import/roles';
import { serializeDocument } from '@/lib/import/serialize';
import type { DataSource, FieldRoles } from '@/types/source';

const ALL_FORMATS: FormatOverride[] = ['auto', 'list', 'yaml', 'json'];

function isComplexEntry(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

export interface SourceDraftSeed {
  rawText: string;
  arrayPath: string[];
  roles: FieldRoles;
  alreadyRanked: boolean;
  /** Path key ("a.b") to alreadyRanked, for every list already known this
   *  session (the active one and anything parked in savedLists) - so
   *  revisiting one of them defaults to its own real answer, not "no
   *  particular order" just because it isn't the list this screen opened on. */
  knownLists?: Record<string, boolean>;
  /**
   * Preselects a different candidate than arrayPath - used when the screen is
   * opened specifically to choose this list (e.g. the toolbar's list switcher,
   * for a list never configured before). Deliberately separate from arrayPath:
   * that field still names the list actually being edited, so roles and
   * alreadyRanked keep defaulting fresh for a list that has no answer yet,
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
  /** True when the imported order is a trusted best-to-worst ranking. */
  alreadyRanked: boolean;
  /** True once the user has explicitly chosen an order for the selected list
   *  this session - lets the screen show a coverage-derived default without
   *  that cosmetic guess ever leaking into what gets submitted. */
  alreadyRankedIsExplicit: boolean;
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
  setAlreadyRanked: (alreadyRanked: boolean) => void;
  /** The committed source, or null while a choice is still outstanding. */
  toSource: () => DataSource | null;
}

interface RolesChoice {
  labelField?: string;
  positionField?: string;
  summaryFields?: string[];
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

interface AlreadyRankedOverride {
  /** The candidate path this choice was made for, so switching lists does not
   *  carry one list's answer onto another. */
  pathKey: string;
  value: boolean;
}

/**
 * The data screen's whole form state. Parsing, candidate discovery, and role
 * resolution are recomputed from the text on every change, so the panel can
 * never show a choice the current text no longer supports.
 */
export function useSourceDraft(seed?: SourceDraftSeed): SourceDraft {
  const [rawText, setRawText] = useState(seed?.rawText ?? '');
  const [override, setOverrideState] = useState<FormatOverride>('auto');
  const [chosenPath, setChosenPath] = useState<string[] | null>(
    seed?.initialSelectedPath ?? seed?.arrayPath ?? null,
  );
  const [alreadyRankedOverride, setAlreadyRankedOverride] =
    useState<AlreadyRankedOverride | null>(null);
  const [rolesOverride, setRolesOverride] = useState<RolesOverride>({});

  const analysis = useMemo(() => analyzeSource(rawText, override), [rawText, override]);

  const selectedPath = useMemo(() => {
    const stillOffered =
      chosenPath !== null &&
      analysis.candidates.some((candidate) => candidate.path.join('.') === chosenPath.join('.'));
    if (stillOffered) return chosenPath;
    return analysis.candidates.length === 1 ? (analysis.candidates[0]?.path ?? null) : null;
  }, [analysis, chosenPath]);

  const entries = useMemo(
    () => (selectedPath === null ? [] : entriesAtPath(analysis.document, selectedPath)),
    [analysis, selectedPath],
  );

  // Per-path, not a single flag: switching to a list the user has not
  // answered this for must not inherit another list's "already ranked"
  // choice. A list already known this session (knownLists, or the list this
  // screen opened on) falls back to its own real answer; a candidate never
  // visited before starts at "no particular order" until told otherwise.
  const alreadyRanked = useMemo(() => {
    const pathKey = selectedPath === null ? '' : selectedPath.join('.');
    if (alreadyRankedOverride?.pathKey === pathKey) {
      return alreadyRankedOverride.value;
    }
    if (selectedPath === null || seed === undefined) return false;

    const known = seed.knownLists?.[pathKey];
    if (known !== undefined) return known;
    if (pathKey === seed.arrayPath.join('.')) return seed.alreadyRanked;
    return false;
  }, [selectedPath, alreadyRankedOverride, seed]);

  const alreadyRankedIsExplicit = useMemo(() => {
    const pathKey = selectedPath === null ? '' : selectedPath.join('.');
    return alreadyRankedOverride?.pathKey === pathKey;
  }, [selectedPath, alreadyRankedOverride]);

  const setAlreadyRanked = useCallback(
    (value: boolean) => {
      const pathKey = selectedPath === null ? '' : selectedPath.join('.');
      setAlreadyRankedOverride({ pathKey, value });
    },
    [selectedPath],
  );

  // Per-path, like alreadyRanked above: a field choice made for one list must
  // never be offered to a different one, even when that list happens to have
  // a field of the same name - only the list the choice was actually made
  // for gets to keep it.
  const roles = useMemo(() => {
    const pathKey = selectedPath === null ? '' : selectedPath.join('.');
    const choice = rolesOverride[pathKey];

    const previous =
      choice !== undefined
        ? {
            labelField: choice.labelField,
            positionField: choice.positionField,
            summaryFields: choice.summaryFields,
          }
        : selectedPath !== null && seed !== undefined && pathKey === seed.arrayPath.join('.')
          ? {
              labelField: seed.roles.labelField,
              positionField: seed.roles.positionField,
              summaryFields: seed.roles.summaryFields,
            }
          : {};

    const resolved = resolveRoles(entries, previous);
    if (choice === undefined || !choice.positionCleared) return resolved;
    return { ...resolved, positionField: undefined };
  }, [entries, rolesOverride, selectedPath, seed]);

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
      const pathKey = selectedPath === null ? '' : selectedPath.join('.');
      setRolesOverride((current) => ({
        ...current,
        [pathKey]: {
          labelField: next.labelField,
          positionField: next.positionField,
          summaryFields: next.summaryFields,
          positionCleared: next.positionField === undefined,
        },
      }));
    },
    [selectedPath],
  );

  const toSource = useCallback((): DataSource | null => {
    if (selectedPath === null || analysis.issues.length > 0) return null;
    return {
      format: analysis.format,
      rawText,
      document: analysis.document,
      arrayPath: selectedPath,
    };
  }, [analysis, rawText, selectedPath]);

  return {
    rawText,
    override,
    analysis,
    selectedPath,
    roles,
    alreadyRanked,
    alreadyRankedIsExplicit,
    entries,
    availableOverrides,
    setRawText,
    setOverride,
    selectPath: setChosenPath,
    setRoles,
    setAlreadyRanked,
    toSource,
  };
}
