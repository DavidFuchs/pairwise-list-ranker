import { isPlainObject } from '@/lib/import/shape';

/**
 * The optional second field role: which key receives the new rank on export.
 * Writing into the user's data is opt-in, so only names that plainly mean an
 * ordering are ever preselected.
 */

export interface PositionFieldCandidate {
  field: string;
  /** True when the name plainly means an ordering, so it can be preselected. */
  suggested: boolean;
}

const ORDERING_NAME = /^(order|rank|position|index|sort|priority|seq(uence)?)$/i;

/**
 * A field qualifies when every entry that carries it carries a number. Entries
 * missing the field are fine: export writes the rank into all of them.
 */
export function detectPositionFields(entries: unknown[]): PositionFieldCandidate[] {
  const objects = entries.filter(isPlainObject);
  if (objects.length === 0) return [];

  const fields: string[] = [];
  for (const entry of objects) {
    for (const field of Object.keys(entry)) {
      if (!fields.includes(field)) fields.push(field);
    }
  }

  return fields
    .filter((field) => {
      const present = objects.map((entry) => entry[field]).filter((value) => value !== undefined);
      return (
        present.length > 0 &&
        present.every((value) => typeof value === 'number' && Number.isFinite(value))
      );
    })
    .map((field) => ({ field, suggested: ORDERING_NAME.test(field) }));
}

export function preferredPositionField(entries: unknown[]): string | undefined {
  return detectPositionFields(entries).find((candidate) => candidate.suggested)?.field;
}
