import type { ComplexItemValue } from '@/types/list';

/**
 * Rules for choosing which field of an object list titles each card. A field is
 * only auto-selected when the choice is safe; otherwise the UI must ask.
 */

/** Field names that are safe to preselect, best first. */
export const PREFERRED_SORT_FIELDS = ['title', 'name', 'label'] as const;

const MAX_SAMPLES = 3;

export type ScalarType = 'string' | 'number' | 'boolean';

export interface SortFieldCandidate {
  field: string;
  /** Share of items carrying a scalar value for this field, 0..1. */
  coverage: number;
  /** Distinct values over item count: low means many repeated labels. */
  uniqueness: number;
  types: ScalarType[];
  /** A few example values, for previewing what the labels will look like. */
  samples: string[];
}

export interface ObjectSchemaField {
  field: string;
  types: string[];
  coverage: number;
  /** False for arrays and nested objects, which cannot title a card. */
  labelCandidate: boolean;
}

export interface ObjectSchemaHint {
  itemCount: number;
  fields: ObjectSchemaField[];
}

function scalarType(value: unknown): ScalarType | null {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return null;
}

/** Field names in first-seen order across all items. */
function fieldOrder(values: ComplexItemValue[]): string[] {
  const fields: string[] = [];
  for (const value of values) {
    for (const field of Object.keys(value)) {
      if (!fields.includes(field)) fields.push(field);
    }
  }
  return fields;
}

export function collectSortFieldCandidates(values: ComplexItemValue[]): SortFieldCandidate[] {
  if (values.length === 0) return [];

  const candidates: SortFieldCandidate[] = [];

  for (const field of fieldOrder(values)) {
    const present = values
      .map((value) => value[field])
      .filter((entry) => scalarType(entry) !== null);

    if (present.length === 0) continue;

    const types = [...new Set(present.map((entry) => scalarType(entry) as ScalarType))];
    const distinct = new Set(present.map((entry) => String(entry)));

    candidates.push({
      field,
      coverage: present.length / values.length,
      uniqueness: distinct.size / values.length,
      types,
      samples: [...distinct].slice(0, MAX_SAMPLES),
    });
  }

  return candidates;
}

/**
 * The safe default, or undefined when the user must decide. Only text fields
 * that every item carries are ever chosen automatically.
 */
export function preferredSortField(candidates: SortFieldCandidate[]): string | undefined {
  const fullTextFields = candidates.filter(
    (candidate) => candidate.coverage === 1 && candidate.types.every((type) => type === 'string'),
  );

  for (const preferred of PREFERRED_SORT_FIELDS) {
    if (fullTextFields.some((candidate) => candidate.field === preferred)) return preferred;
  }

  return fullTextFields.length === 1 ? fullTextFields[0]?.field : undefined;
}

/** Whether a chosen field still labels at least one item. */
export function isUsableSortField(
  field: string | undefined,
  candidates: SortFieldCandidate[],
): boolean {
  if (field === undefined) return false;
  return candidates.some((candidate) => candidate.field === field && candidate.coverage > 0);
}

/** Every field of the imported objects, including ones that cannot be labels. */
export function describeObjectSchema(values: ComplexItemValue[]): ObjectSchemaHint {
  const fields: ObjectSchemaField[] = fieldOrder(values).map((field) => {
    const present = values.map((value) => value[field]).filter((entry) => entry !== undefined);
    const types = [...new Set(present.map(describeType))];

    return {
      field,
      types,
      coverage: present.length / values.length,
      labelCandidate: present.some((entry) => scalarType(entry) !== null),
    };
  });

  return { itemCount: values.length, fields };
}

function describeType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  const scalar = scalarType(value);
  return scalar ?? 'object';
}
