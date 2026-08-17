export interface ArrayCandidate {
  path: string[];
  count: number;
  entryKind: 'object' | 'scalar';
  /** A few entries rendered as text, for the picker's preview. */
  samples: string[];
}

export interface CandidateScan {
  candidates: ArrayCandidate[];
  /** Arrays that were skipped, and why, so the user is not left guessing. */
  warnings: string[];
}

/**
 * Ranking one item is not ranking, but that rule belongs to describeReadiness,
 * not here: a one-item array is still the list the user meant, and saying "no
 * list found" about it would be a lie. Discovery offers it; readiness blocks it.
 */
export const MIN_RANKABLE = 2;

const MAX_DEPTH = 5;
const MAX_SAMPLES = 3;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Walks object properties only, never descending into array elements. That is
 * what keeps per-item fields like `movies[].tags` out of the candidate list:
 * they are a field of an item, not a list the user means to rank.
 */
export function findArrayCandidates(document: unknown): CandidateScan {
  const candidates: ArrayCandidate[] = [];
  const warnings: string[] = [];

  function visit(value: unknown, path: string[], depth: number): void {
    if (depth > MAX_DEPTH) return;

    if (Array.isArray(value)) {
      const candidate = describeArray(value, path);
      if (candidate !== null) {
        candidates.push(candidate);
      } else if (value.length >= MIN_RANKABLE) {
        warnings.push(
          `Skipped "${formatPath(path)}" - it mixes text and objects, so it cannot be ranked as one list.`,
        );
      }
      return;
    }

    if (!isPlainObject(value)) return;

    for (const key of Object.keys(value)) {
      visit(value[key], [...path, key], depth + 1);
    }
  }

  visit(document, [], 0);
  return { candidates, warnings };
}

function describeArray(entries: unknown[], path: string[]): ArrayCandidate | null {
  if (entries.length === 0) return null;

  const allObjects = entries.every(isPlainObject);
  const allScalars = entries.every(isScalar);
  if (!allObjects && !allScalars) return null;

  return {
    path,
    count: entries.length,
    entryKind: allObjects ? 'object' : 'scalar',
    samples: entries.slice(0, MAX_SAMPLES).map(describeEntry),
  };
}

function describeEntry(entry: unknown): string {
  if (isScalar(entry)) return String(entry);
  if (isPlainObject(entry)) {
    const firstText = Object.values(entry).find((value) => typeof value === 'string');
    return typeof firstText === 'string' ? firstText : Object.keys(entry).join(', ');
  }
  return '';
}

export function entriesAtPath(document: unknown, path: string[]): unknown[] {
  let current: unknown = document;
  for (const key of path) {
    if (!isPlainObject(current)) return [];
    current = current[key];
  }
  return Array.isArray(current) ? current : [];
}

export function formatPath(path: string[]): string {
  return path.length === 0 ? 'the list' : path.join('.');
}
