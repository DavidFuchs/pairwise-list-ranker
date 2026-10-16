import type { FieldRenderer, FieldRoles } from '@/types/source';

export interface RendererOption {
  /** Absent for the plain default. */
  id: FieldRenderer | undefined;
  label: string;
}

/** What a field may be drawn as, by the types its values take. */
const SPECIAL_RENDERERS: { id: FieldRenderer; label: string; accepts: string[] }[] = [
  { id: 'apple-music-preview', label: 'Apple Music preview', accepts: ['string', 'number'] },
];

/** The plain default is always offered; special renderers only for types they can read. */
export function rendererOptionsFor(types: string[]): RendererOption[] {
  return [
    { id: undefined, label: types.length === 1 ? types[0]! : 'text' },
    ...SPECIAL_RENDERERS.filter((renderer) =>
      types.length > 0 && types.every((type) => renderer.accepts.includes(type)),
    ).map(({ id, label }) => ({ id, label })),
  ];
}

export function rendererLabel(id: FieldRenderer): string {
  return SPECIAL_RENDERERS.find((renderer) => renderer.id === id)?.label ?? id;
}

/** Only renderers still known, on fields still shown. Anything else is dropped. */
export function cleanRenderers(
  renderers: FieldRoles['fieldRenderers'],
  summaryFields: string[],
): FieldRoles['fieldRenderers'] {
  if (renderers === undefined) return undefined;
  const known = new Set<string>(SPECIAL_RENDERERS.map((renderer) => renderer.id));
  const kept = Object.entries(renderers).filter(
    ([field, id]) => summaryFields.includes(field) && known.has(id),
  );
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

export interface SummaryLayout {
  /** Fields shown as ordinary lines of text. */
  plainFields: string[];
  /** The field whose value is an Apple Music id, drawn as a play button. */
  previewField: string | undefined;
}

/**
 * Splits the chosen fields into the lines that read as text and the field that
 * gets its own control. A preview field never also shows as a line of text.
 */
export function layoutSummary(roles: FieldRoles): SummaryLayout {
  const fields = roles.summaryFields ?? [];
  const previewField = fields.find((field) => roles.fieldRenderers?.[field] === 'apple-music-preview');
  return { plainFields: fields.filter((field) => field !== previewField), previewField };
}
