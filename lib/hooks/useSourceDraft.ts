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
}

export interface SourceDraft {
  rawText: string;
  override: FormatOverride;
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  /** True when the imported order is a trusted best-to-worst ranking. */
  alreadyRanked: boolean;
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

interface RolesOverride {
  labelField?: string;
  positionField?: string;
  /** Distinguishes "not chosen yet" from "deliberately set to none". */
  positionCleared: boolean;
}

/**
 * The data screen's whole form state. Parsing, candidate discovery, and role
 * resolution are recomputed from the text on every change, so the panel can
 * never show a choice the current text no longer supports.
 */
export function useSourceDraft(seed?: SourceDraftSeed): SourceDraft {
  const [rawText, setRawText] = useState(seed?.rawText ?? '');
  const [override, setOverrideState] = useState<FormatOverride>('auto');
  const [chosenPath, setChosenPath] = useState<string[] | null>(seed?.arrayPath ?? null);
  const [alreadyRanked, setAlreadyRanked] = useState(seed?.alreadyRanked ?? false);
  const [rolesOverride, setRolesOverride] = useState<RolesOverride>({
    labelField: seed?.roles.labelField,
    positionField: seed?.roles.positionField,
    positionCleared: false,
  });

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

  const roles = useMemo(() => {
    const resolved = resolveRoles(entries, {
      labelField: rolesOverride.labelField,
      positionField: rolesOverride.positionField,
    });
    if (!rolesOverride.positionCleared) return resolved;
    return { ...resolved, positionField: undefined };
  }, [entries, rolesOverride]);

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

  const setRoles = useCallback((next: FieldRoles) => {
    setRolesOverride({
      labelField: next.labelField,
      positionField: next.positionField,
      positionCleared: next.positionField === undefined,
    });
  }, []);

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
