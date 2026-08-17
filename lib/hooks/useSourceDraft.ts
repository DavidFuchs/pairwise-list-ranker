import { useCallback, useMemo, useState } from 'react';

import type { FormatOverride } from '@/components/data/SourceInput';
import { analyzeSource } from '@/lib/import/analyze';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { resolveRoles } from '@/lib/import/roles';
import type { DataSource, FieldRoles } from '@/types/source';

export interface SourceDraftSeed {
  rawText: string;
  arrayPath: string[];
  roles: FieldRoles;
}

export interface SourceDraft {
  rawText: string;
  override: FormatOverride;
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  entries: unknown[];
  setRawText: (text: string) => void;
  setOverride: (override: FormatOverride) => void;
  selectPath: (path: string[]) => void;
  setRoles: (roles: FieldRoles) => void;
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
  const [override, setOverride] = useState<FormatOverride>('auto');
  const [chosenPath, setChosenPath] = useState<string[] | null>(seed?.arrayPath ?? null);
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
    entries,
    setRawText,
    setOverride,
    selectPath: setChosenPath,
    setRoles,
    toSource,
  };
}
