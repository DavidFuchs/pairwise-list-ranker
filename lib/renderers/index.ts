/**
 * How fields are drawn: which renderers a field can be offered, how a value
 * reads under one, and how a list's chosen fields lay out on a card. The
 * renderers themselves are defined in ./registry, one entry each.
 */
import { definitionOf, familyOf, FAMILIES, RENDERERS } from '@/lib/renderers/registry';
import { fieldLabel } from '@/lib/renderers/fieldLabel';
import type {
  CaveatContext,
  CardField,
  FixedRenderer,
  Picture,
  PreviewSource,
  RendererCaveat,
  RendererSlot,
} from '@/lib/renderers/registry';
import { summaryText } from '@/lib/state/summary';
import { FIELD_RENDERERS } from '@/types/source';
import type { FieldRenderer, FieldRoles } from '@/types/source';

export type {
  CardField,
  CaveatContext,
  Picture,
  PreviewProvider,
  PreviewSource,
  RendererCaveat,
  RendererSlot,
} from '@/lib/renderers/registry';
export {
  coordinates,
  currencyOf,
  deezerTrackId,
  flagEmoji,
  flagText,
  isColor,
  isImageLink,
  isLink,
  isRating,
  linkText,
  locationText,
  mapUrl,
  PILL_TONES,
  pillTone,
  ratingFraction,
  ratingScale,
  ratingText,
  regionCode,
  steamAppId,
  youtubeId,
} from '@/lib/renderers/values';
export type { PillTone } from '@/lib/renderers/values';
export { fieldLabel } from '@/lib/renderers/fieldLabel';

/** fieldLabel for a field drawn by this renderer, without a unit the drawn value already shows. */
export function fieldLabelFor(field: string, renderer: FieldRenderer | undefined): string {
  const unitWords =
    renderer === undefined
      ? undefined
      : (familyOf(renderer)?.unitWords?.(renderer) ?? definitionOf(renderer)?.unitWords);
  return fieldLabel(field, unitWords);
}

export interface RendererOption {
  /** Absent for the plain default. For one with variants, the first that fits. */
  id: FieldRenderer | undefined;
  label: string;
  /** What the renderer does, for the choice that offers it. */
  hint?: string;
  /**
   * The forms the renderer comes in, each its own renderer: a rating's scales
   * that fit every value, or the currencies money can be read in.
   */
  variants?: { id: FieldRenderer; label: string }[];
  /** Read before the variants: "out of" 10, "in" CAD. */
  variantPrompt?: string;
}

export function slotOf(renderer: FieldRenderer | undefined): RendererSlot {
  return definitionOf(renderer)?.slot ?? 'line';
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * The plain default is always offered, named after the values' type. A special
 * renderer is offered only when every value the field holds is one it can draw.
 * The field's name only ever widens what is offered: a field called address
 * can be put on a map, where any other text cannot.
 */
export function rendererOptionsFor(values: unknown[], field?: string): RendererOption[] {
  // An empty cell is a missing value, not one the renderer must draw: every
  // renderer shows it as a dash, the same as an item without the field.
  const present = values.filter(
    (value) => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === ''),
  );
  const types = [...new Set(present.map(typeOf))];
  const plain: RendererOption = { id: undefined, label: types.length === 1 ? types[0]! : 'text' };
  if (present.length === 0) return [plain];

  const fixed = (Object.entries(RENDERERS) as [FixedRenderer, (typeof RENDERERS)[FixedRenderer]][])
    .filter(([, definition]) => definition.accepts(present, field))
    .map(([id, { label, hint }]): RendererOption => ({ id, label, hint }));
  const families = FAMILIES.flatMap(({ label, hint, variantPrompt, variantsFor }): RendererOption[] => {
    const variants = variantsFor(present);
    return variants.length === 0 ? [] : [{ id: variants[0]!.id, label, hint, variantPrompt, variants }];
  });
  return [plain, ...fixed, ...families];
}

/**
 * The one thing worth saying about a renderer for these values, said only
 * when it applies: a Steam field of app ids, not of the banner addresses
 * that always work, or flags in a browser that cannot draw them.
 */
export function rendererCaveat(
  renderer: FieldRenderer | undefined,
  values: unknown[],
  context: CaveatContext,
): RendererCaveat | undefined {
  // Fields sharing one place on the card - the play button, or the picture
  // beside the title - each list all of them, in the order they are used.
  const slot = slotOf(renderer);
  const sharing = (others: CardField[]) => others.filter((other) => slotOf(other.renderer) === slot);
  if (slot !== 'line' && sharing(context.earlier).length + sharing(context.later).length > 0) {
    const before = sharing(context.earlier);
    const total = before.length + 1 + sharing(context.later).length;
    // The full explanation once, under the first of them; each later one says
    // only where it falls, rather than repeating the same paragraph.
    if (before.length > 0) {
      const position = `${ordinal(before.length + 1)} of ${total}`;
      const after = before[before.length - 1]!.field;
      return {
        tone: 'tip',
        text:
          slot === 'media'
            ? `${position} sources for the play button, tried after ${after}.`
            : `${position} pictures beside the title, after ${after}.`,
      };
    }
    const order = [
      { field: context.field, current: true },
      ...sharing(context.later).map(({ field }) => ({ field, current: false })),
    ];
    return slot === 'media'
      ? {
          tone: 'tip',
          text: 'These share the play button. It plays the first one in this order that has a clip for the item:',
          order,
        }
      : {
          tone: 'tip',
          text: 'These share the spot beside the title. Each card starts on the first, and its arrows step through the rest in this order:',
          order,
        };
  }
  const present = values.filter((value) => value !== undefined && value !== null && value !== '');
  return definitionOf(renderer)?.caveat?.(present, context);
}

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** The renderer's own name, for a configuration summary. */
export function rendererNote(renderer: FieldRenderer): string {
  const family = familyOf(renderer);
  if (family !== undefined) return family.note(renderer);
  const definition = definitionOf(renderer);
  return definition?.note ?? definition?.label.toLowerCase() ?? renderer;
}

/**
 * A value as one line of text, drawn the way its renderer reads: for the
 * ranked list, where a row is a single line, and for the plain parts of a
 * card. Null when the renderer draws nothing for this value (a false badge).
 * A value the renderer cannot read falls back to its plain text.
 */
export function formatValue(
  value: unknown,
  renderer: FieldRenderer | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null || value === '' || renderer === undefined)
    return summaryText(value);
  const family = familyOf(renderer);
  const text =
    family !== undefined ? family.format(value, renderer) : definitionOf(renderer)?.format?.(value, field);
  return text === undefined ? summaryText(value) : text;
}

/** Every picture one field's value gives, in order. A value that gives none is an empty list. */
export function picturesOf(value: unknown, renderer: FieldRenderer | undefined): Picture[] {
  return definitionOf(renderer)?.pictures?.(value) ?? [];
}

/** The clip a value names, for a play-button renderer. */
export function previewSourceOf(
  value: unknown,
  renderer: FieldRenderer | undefined,
): PreviewSource | undefined {
  return definitionOf(renderer)?.preview?.(value);
}

/** Only renderers still known, on fields still shown. Anything else is dropped. */
export function cleanRenderers(
  renderers: FieldRoles['fieldRenderers'],
  summaryFields: string[],
): FieldRoles['fieldRenderers'] {
  if (renderers === undefined) return undefined;
  const known = new Set<string>(FIELD_RENDERERS);
  const kept = Object.entries(renderers).filter(
    ([field, id]) => summaryFields.includes(field) && known.has(id),
  );
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

export interface SummaryLayout {
  /** Fields shown as lines on the card, in order. */
  plainFields: string[];
  /** How each chosen field is drawn, slot fields included; a line absent here is plain text. */
  renderers: Record<string, FieldRenderer>;
  /** Fields feeding the picture beside the title, in order: the first is shown first. */
  pictureFields: string[];
  /** Fields feeding the play button, in order: the first with a clip is the one played. */
  mediaFields: string[];
}

/**
 * Splits the chosen fields into the lines that read under the title and the
 * fields that feed a place of their own. Every field asking for the picture
 * or the play button gets it: pictures join one gallery, in the card's order,
 * and clips line up as fallbacks, so a track missing from one catalogue plays
 * from the next.
 */
export function layoutSummary(roles: FieldRoles): SummaryLayout {
  const fields = roles.summaryFields ?? [];
  const renderers: Record<string, FieldRenderer> = {};
  for (const field of fields) {
    const renderer = roles.fieldRenderers?.[field];
    if (renderer !== undefined) renderers[field] = renderer;
  }
  const inSlot = (slot: RendererSlot) => fields.filter((field) => slotOf(renderers[field]) === slot);
  return {
    plainFields: inSlot('line'),
    renderers,
    pictureFields: inSlot('picture'),
    mediaFields: inSlot('media'),
  };
}

/** Everything a card or a ranked row needs to know to draw an item. */
export interface CardLayout extends SummaryLayout {
  /** The field that titles each item; bare strings title themselves. */
  labelField?: string;
}

/** Nothing chosen: a title and nothing else. */
export const EMPTY_LAYOUT: CardLayout = {
  plainFields: [],
  renderers: {},
  pictureFields: [],
  mediaFields: [],
};

/** The card a list's roles describe, worked out once and handed down whole. */
export function cardLayout(roles: FieldRoles): CardLayout {
  return { labelField: roles.labelField, ...layoutSummary(roles) };
}

/** Every picture an item's picture fields give, field by field. */
export function itemPictures(
  read: (field: string) => unknown,
  pictureFields: string[] | undefined,
  renderers: Record<string, FieldRenderer> | undefined,
): Picture[] {
  return (pictureFields ?? []).flatMap((field) => picturesOf(read(field), renderers?.[field]));
}

/** Every clip an item's play-button fields name, in the order to try them. */
export function itemPreviewSources(
  read: (field: string) => unknown,
  mediaFields: string[] | undefined,
  renderers: Record<string, FieldRenderer> | undefined,
): PreviewSource[] {
  return (mediaFields ?? []).flatMap((field) => previewSourceOf(read(field), renderers?.[field]) ?? []);
}
