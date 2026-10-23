import {
  collectLabelFieldCandidates,
  isUsableLabelField,
  preferredLabelField,
} from '@/lib/import/labelField';
import { detectPositionFields, preferredPositionField } from '@/lib/import/positionField';
import { isPlainObject } from '@/lib/import/shape';
import { cleanRenderers } from '@/lib/renderers';
import type { FieldRoles } from '@/types/source';

/**
 * The roles the app would choose on its own. A previous choice (the
 * document's defaults, or what the setup screen last showed) wins whenever
 * the data can still honour it, so a list does not silently relabel every
 * card.
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
  // and never duplicates the title. Nothing is chosen for the user: a card
  // shows only its title until fields are ticked.
  const present = new Set(objects.flatMap((object) => Object.keys(object)));
  const summaryFields = [...new Set(previous.summaryFields ?? [])].filter(
    (field) => present.has(field) && field !== labelField,
  );

  const fieldRenderers = cleanRenderers(previous.fieldRenderers, summaryFields);

  return {
    ...(labelField === undefined ? {} : { labelField }),
    ...(summaryFields.length === 0 && previous.summaryFields === undefined ? {} : { summaryFields }),
    ...(fieldRenderers === undefined ? {} : { fieldRenderers }),
    ...(positionField === undefined ? {} : { positionField }),
  };
}
