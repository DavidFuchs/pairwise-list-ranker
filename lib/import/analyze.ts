import { findArrayCandidates } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { parseSource, sniffFormat } from '@/lib/import/sniff';
import type { ParseIssue } from '@/lib/import/types';
import type { SourceFormat } from '@/types/source';

export interface SourceAnalysis {
  format: SourceFormat;
  document: unknown;
  candidates: ArrayCandidate[];
  warnings: string[];
  issues: ParseIssue[];
}

/**
 * Everything the data screen knows about a blob of text, in one pure call, so
 * the screen itself holds no parsing logic.
 */
export function analyzeSource(rawText: string, override: SourceFormat | 'auto'): SourceAnalysis {
  const format = override === 'auto' ? sniffFormat(rawText) : override;
  const parsed = parseSource(rawText, format);

  if (!parsed.ok) {
    return { format, document: null, candidates: [], warnings: [], issues: parsed.issues };
  }

  const { candidates, warnings } = findArrayCandidates(parsed.data);
  return { format, document: parsed.data, candidates, warnings, issues: [] };
}
