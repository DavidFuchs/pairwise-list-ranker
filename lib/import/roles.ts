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

  // A summary field is kept only while some item still carries it, and never
  // duplicates the title.
  const present = new Set(objects.flatMap((object) => Object.keys(object)));
  const summaryFields = [...new Set(previous.summaryFields ?? [])]
    .filter((field) => present.has(field) && field !== labelField)
    .slice(0, MAX_SUMMARY_FIELDS);

  return {
    ...(labelField === undefined ? {} : { labelField }),
    ...(summaryFields.length === 0 ? {} : { summaryFields }),
    ...(positionField === undefined ? {} : { positionField }),
  };
}
