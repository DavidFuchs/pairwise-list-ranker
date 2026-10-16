import { summaryText } from '@/lib/state/summary';
import { FIELD_RENDERERS, RATING_SCALES } from '@/types/source';
import type { FieldRenderer, FieldRoles, RatingScale } from '@/types/source';

export interface RendererOption {
  /** Absent for the plain default. For a rating, the smallest scale that fits. */
  id: FieldRenderer | undefined;
  label: string;
  /** What the renderer does, for the choice that offers it. */
  hint?: string;
  /** A rating's scales that fit every value, each its own renderer. */
  scales?: { scale: RatingScale; id: FieldRenderer }[];
}

const LINK_PATTERN = /^https?:\/\/\S+$/i;

/** Raster and vector formats every current browser draws in an <img>. */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];

/** watch?v=, youtu.be/, shorts/, embed/ and live/ addresses, each ending in an 11-character video id. */
const YOUTUBE_PATTERN =
  /^https?:\/\/(?:(?:www\.|m\.|music\.)?youtube\.com\/(?:watch\?(?:\S*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** A web address, which a card can open in a new tab. */
export function isLink(value: unknown): value is string {
  return typeof value === 'string' && LINK_PATTERN.test(value.trim());
}

/** A web address whose path ends in an image extension, ignoring any query or fragment. */
export function isImageLink(value: unknown): value is string {
  if (!isLink(value)) return false;
  const path = value.trim().split(/[?#]/, 1)[0]!.toLowerCase();
  const extension = path.slice(path.lastIndexOf('.') + 1);
  return path.includes('.') && IMAGE_EXTENSIONS.includes(extension);
}

/** The video id of a YouTube address, or undefined for anything else. */
export function youtubeId(value: unknown): string | undefined {
  return typeof value === 'string' ? YOUTUBE_PATTERN.exec(value.trim())?.[1] : undefined;
}

/** A link shortened to read on a chip: the host and path, without the scheme. */
export function linkText(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** The year, month and day of an ISO date, when it names a real one. */
function dateParts(value: unknown): [number, number, number] | undefined {
  if (typeof value !== 'string') return undefined;
  const match = DATE_PATTERN.exec(value.trim());
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects a 2023-02-30 that Date would quietly roll into March.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? [year, month, day] : undefined;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTagList(value: unknown): value is (string | number)[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' || isNumber(entry));
}

/** The scale a rating renderer reads its value against. */
export function ratingScale(renderer: FieldRenderer | undefined): RatingScale | undefined {
  const match = /^(?:stars|bar)-(\d+)$/.exec(renderer ?? '');
  return match === null ? undefined : (Number(match[1]) as RatingScale);
}

export function isRating(renderer: FieldRenderer | undefined, kind: 'stars' | 'bar'): boolean {
  return renderer?.startsWith(`${kind}-`) ?? false;
}

/** How full a rating is, 0 to 1: the value against its scale, clamped. */
export function ratingFraction(value: unknown, scale: RatingScale): number | undefined {
  return isNumber(value) ? Math.min(1, Math.max(0, value / scale)) : undefined;
}

/** A score as written against its scale: 9.2/10, or 86% out of 1 or 100. */
export function ratingText(value: number, scale: RatingScale): string {
  if (scale === 1) return `${Math.round(value * 100)}%`;
  if (scale === 100) return `${Math.round(value)}%`;
  return `${Number(value.toFixed(1))}/${scale}`;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * What a field may be drawn as, decided by every value it actually holds. A
 * single value that does not fit rules a renderer out, so a choice offered is
 * one that draws every item.
 */
const SPECIAL_RENDERERS: {
  id: FieldRenderer;
  label: string;
  hint: string;
  accepts: (values: unknown[]) => boolean;
}[] = [
  { id: 'link', label: 'Link', hint: 'Opens in a new tab', accepts: (values) => values.every(isLink) },
  { id: 'image', label: 'Image', hint: 'Pictured beside the title', accepts: (values) => values.every(isImageLink) },
  {
    id: 'youtube',
    label: 'YouTube thumbnail',
    hint: "The video's picture, opening the video",
    accepts: (values) => values.every((value) => youtubeId(value) !== undefined),
  },
  { id: 'tags', label: 'Tags', hint: 'Each entry as its own label', accepts: (values) => values.every(isTagList) },
  { id: 'date', label: 'Date', hint: 'In your own date format', accepts: (values) => values.every((value) => dateParts(value) !== undefined) },
  { id: 'year', label: 'Year only', hint: 'Just the year of the date', accepts: (values) => values.every((value) => dateParts(value) !== undefined) },
  {
    id: 'duration',
    label: 'Duration (seconds)',
    hint: 'Whole seconds as minutes and seconds',
    accepts: (values) => values.every((value) => isNumber(value) && Number.isInteger(value) && value >= 0),
  },
  {
    id: 'compact',
    label: 'Compact number',
    hint: 'Large numbers shortened, like 1.5M',
    // Offered only where there is something to shorten.
    accepts: (values) => values.every(isNumber) && values.some((value) => Math.abs(value as number) >= 1000),
  },
  { id: 'badge', label: 'Badge', hint: 'The field name when true, nothing when false', accepts: (values) => values.every((value) => typeof value === 'boolean') },
  {
    id: 'apple-music-preview',
    label: 'Apple Music preview',
    hint: 'Plays a clip, by track id',
    // Track ids are whole numbers, sometimes written as text.
    accepts: (values) =>
      values.every(
        (value) => (typeof value === 'string' && /^\d+$/.test(value.trim())) || (Number.isInteger(value) && (value as number) > 0),
      ),
  },
];

const RATINGS: { kind: 'stars' | 'bar'; label: string; hint: string }[] = [
  { kind: 'stars', label: 'Stars', hint: 'Five stars, filled to the score' },
  { kind: 'bar', label: 'Bar', hint: 'A bar filled to the score' },
];

/** The scales every value fits under: none negative, none above the scale. */
function fittingScales(values: unknown[]): RatingScale[] {
  if (!values.every(isNumber) || values.some((value) => (value as number) < 0)) return [];
  const highest = Math.max(...(values as number[]));
  return RATING_SCALES.filter((scale) => highest <= scale);
}

/**
 * The plain default is always offered, named after the values' type. A special
 * renderer is offered only when every value the field holds is one it can draw.
 */
export function rendererOptionsFor(values: unknown[]): RendererOption[] {
  const present = values.filter((value) => value !== undefined);
  const types = [...new Set(present.map(typeOf))];
  const scales = present.length === 0 ? [] : fittingScales(present);
  return [
    { id: undefined, label: types.length === 1 ? types[0]! : 'text' },
    ...SPECIAL_RENDERERS.filter((renderer) => present.length > 0 && renderer.accepts(present)).map(
      ({ id, label, hint }) => ({ id, label, hint }),
    ),
    ...(scales.length === 0
      ? []
      : RATINGS.map(({ kind, label, hint }) => ({
          id: `${kind}-${scales[0]!}` as FieldRenderer,
          label,
          hint,
          scales: scales.map((scale) => ({ scale, id: `${kind}-${scale}` as FieldRenderer })),
        }))),
  ];
}

/** The renderer's own name, for a configuration summary. */
export function rendererNote(renderer: FieldRenderer): string {
  const scale = ratingScale(renderer);
  if (scale !== undefined) return `${isRating(renderer, 'stars') ? 'stars' : 'bar'} /${scale}`;
  if (renderer === 'apple-music-preview') return 'preview';
  return SPECIAL_RENDERERS.find((entry) => entry.id === renderer)?.label.toLowerCase() ?? renderer;
}

const durationText = (seconds: number) => {
  const whole = Math.round(seconds);
  const [h, m, s] = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60];
  const pad = (part: number) => String(part).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/**
 * A value as one line of text, drawn the way its renderer reads: for the
 * ranked list, where a row is a single line, and for the plain parts of a
 * card. Null when the renderer draws nothing for this value (a false badge).
 * A value the renderer cannot read falls back to its plain text.
 */
export function formatValue(value: unknown, renderer: FieldRenderer | undefined, field: string): string | null {
  if (value === undefined || value === null || value === '') return summaryText(value);
  const scale = ratingScale(renderer);
  if (scale !== undefined) {
    if (!isNumber(value)) return summaryText(value);
    return isRating(renderer, 'stars') ? `★ ${ratingText(value, scale)}` : ratingText(value, scale);
  }
  switch (renderer) {
    case 'link':
    case 'image':
    case 'youtube':
      return isLink(value) ? linkText(value) : summaryText(value);
    case 'tags':
      return isTagList(value) ? (value.length === 0 ? '–' : value.join(', ')) : summaryText(value);
    case 'date': {
      const parts = dateParts(value);
      if (parts === undefined) return summaryText(value);
      // Read as a calendar day, not an instant, so no time zone moves it.
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        Date.UTC(parts[0], parts[1] - 1, parts[2]),
      );
    }
    case 'year':
      return String(dateParts(value)?.[0] ?? summaryText(value));
    case 'duration':
      return isNumber(value) ? durationText(value) : summaryText(value);
    case 'compact':
      return isNumber(value)
        ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
        : summaryText(value);
    case 'badge':
      return value === true ? field : value === false ? null : summaryText(value);
    default:
      return summaryText(value);
  }
}

/** The address a picture renderer shows: the image itself, or a video's thumbnail. */
export function pictureUrl(value: unknown, renderer: FieldRenderer | undefined): string | undefined {
  if (renderer === 'youtube') {
    const id = youtubeId(value);
    return id === undefined ? undefined : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return isImageLink(value) ? value.trim() : undefined;
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
  /** How each line is drawn; a line absent here is plain text. */
  renderers: Record<string, FieldRenderer>;
  /** The field whose value is an Apple Music id, drawn as a play button. */
  previewField: string | undefined;
  /** The field pictured beside the title: an image, or a video's thumbnail. */
  pictureField: string | undefined;
  pictureRenderer: FieldRenderer | undefined;
}

/**
 * Splits the chosen fields into the lines that read under the title and the
 * fields that get a place of their own. A card has one play button and one
 * picture, so a second field asking for either falls back to what it still
 * is: an id reads as text, an image or video address as a link.
 */
export function layoutSummary(roles: FieldRoles): SummaryLayout {
  const fields = roles.summaryFields ?? [];
  const rendererOf = (field: string) => roles.fieldRenderers?.[field];
  const previewField = fields.find((field) => rendererOf(field) === 'apple-music-preview');
  const pictureField = fields.find((field) => rendererOf(field) === 'image' || rendererOf(field) === 'youtube');
  const plainFields = fields.filter((field) => field !== previewField && field !== pictureField);

  const renderers: Record<string, FieldRenderer> = {};
  for (const field of plainFields) {
    const renderer = rendererOf(field);
    if (renderer === undefined || renderer === 'apple-music-preview') continue;
    renderers[field] = renderer === 'image' || renderer === 'youtube' ? 'link' : renderer;
  }

  return {
    plainFields,
    renderers,
    previewField,
    pictureField,
    pictureRenderer: pictureField === undefined ? undefined : rendererOf(pictureField),
  };
}
