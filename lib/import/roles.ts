import {
  collectLabelFieldCandidates,
  isUsableLabelField,
  preferredLabelField,
} from '@/lib/import/labelField';
import { detectPositionFields, preferredPositionField } from '@/lib/import/positionField';
import type { ComplexItemValue } from '@/types/list';
import { MAX_SUMMARY_FIELDS } from '@/types/source';
import type { FieldRoles } from '@/types/source';

function isPlainObject(value: unknown): value is ComplexItemValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The roles the app would choose on its own. A previous choice wins whenever
 * the new data can still honour it, so re-importing edited text does not
 * silently relabel every card.
 */
export function resolveRoles(entries: unknown[], previous: FieldRoles = {}): FieldRoles {
  const objects = entries.filter(isPlainObject);
  if (objects.length === 0) return {};

  const labelCandidates = collectLabelFieldCandidates(objects);
  const labelField = isUsableLabelField(previous.labelField, labelCandidates)
    ? previous.labelField
    : preferredLabelField(labelCandidates);

  const keepsPosition = detectPositionFields(entries).some(
    (candidate) => candidate.field === previous.positionField,
  );
  const positionField = keepsPosition ? previous.positionField : preferredPositionField(entries);

  // A choice made earlier is kept while some item still carries the field,
  // and never duplicates the title. With no choice at all, offer fields that
  // every item has, so the cards start out consistent.
  const present = new Set(objects.flatMap((object) => Object.keys(object)));
  const summaryFields =
    previous.summaryFields === undefined
      ? suggestSummaryFields(objects, [labelField, positionField])
      : [...new Set(previous.summaryFields)]
          .filter((field) => present.has(field) && field !== labelField)
          .slice(0, MAX_SUMMARY_FIELDS);

  return {
    ...(labelField === undefined ? {} : { labelField }),
    ...(summaryFields.length === 0 && previous.summaryFields === undefined ? {} : { summaryFields }),
    ...(positionField === undefined ? {} : { positionField }),
  };
}

/** Longer than this and a value stops fitting on a chip. */
const SUGGESTED_MAX_LENGTH = 24;

/**
 * Fields worth showing on every card: short scalars that all items carry, in
 * the order the document lists them. The title and the position field are
 * already shown, or rewritten, elsewhere.
 */
export function suggestSummaryFields(
  objects: ComplexItemValue[],
  excluded: (string | undefined)[],
): string[] {
  const fields: string[] = [];
  for (const object of objects) {
    for (const key of Object.keys(object)) {
      if (!fields.includes(key)) fields.push(key);
    }
  }

  return fields
    .filter((field) => !excluded.includes(field))
    .filter((field) =>
      objects.every((object) => {
        const value = object[field];
        if (typeof value === 'number' || typeof value === 'boolean') return true;
        return typeof value === 'string' && value.trim() !== '' && value.length <= SUGGESTED_MAX_LENGTH;
      }),
    )
    .slice(0, MAX_SUMMARY_FIELDS);
}
