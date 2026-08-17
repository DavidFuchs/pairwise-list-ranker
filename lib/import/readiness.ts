import { MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import type { FieldRoles } from '@/types/source';

export interface ReadinessInput {
  candidates: ArrayCandidate[];
  selectedPath: string[] | null;
  entries: unknown[];
  roles: FieldRoles;
  hasIssues: boolean;
}

export interface Readiness {
  ready: boolean;
  /** Why the primary action is disabled, phrased as the next thing to do. */
  reason?: string;
}

/**
 * The one place that decides whether ranking can start, so the call to action
 * and its explanation can never disagree.
 */
export function describeReadiness(input: ReadinessInput): Readiness {
  const { candidates, selectedPath, entries, roles, hasIssues } = input;

  if (hasIssues) {
    return { ready: false, reason: 'Fix the errors above to continue.' };
  }

  if (candidates.length === 0) {
    return {
      ready: false,
      reason: 'No list to rank was found. Try another format, or paste one item per line.',
    };
  }

  if (selectedPath === null) {
    return { ready: false, reason: 'Choose which list to rank.' };
  }

  if (entries.length < MIN_RANKABLE) {
    return { ready: false, reason: 'A ranking needs at least two items.' };
  }

  const hasObjectEntries = entries.some(
    (entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
  if (hasObjectEntries && roles.labelField === undefined) {
    return { ready: false, reason: 'Choose which field should title each card.' };
  }

  return { ready: true };
}
