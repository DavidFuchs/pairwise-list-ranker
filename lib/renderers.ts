import { summaryText } from '@/lib/state/summary';
import { CURRENCIES, FIELD_RENDERERS, RATING_SCALES } from '@/types/source';
import type { Currency, FieldRenderer, FieldRoles, RatingScale } from '@/types/source';

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

/**
 * Where a renderer puts its field on a card. Lines read under the title, one
 * per field. A card has one picture slot and one play button, and every field
 * drawn as either feeds that one place rather than competing for it: pictures
 * page through a gallery, sources line up as fallbacks.
 */
export type RendererSlot = 'picture' | 'media' | 'line';

const PICTURE_RENDERERS: readonly FieldRenderer[] = ['image', 'image-gallery', 'youtube', 'steam-header'];
const MEDIA_RENDERERS: readonly FieldRenderer[] = ['apple-music-preview', 'deezer-preview'];

export function slotOf(renderer: FieldRenderer | undefined): RendererSlot {
  if (renderer !== undefined && PICTURE_RENDERERS.includes(renderer)) return 'picture';
  if (renderer !== undefined && MEDIA_RENDERERS.includes(renderer)) return 'media';
  return 'line';
}

const LINK_PATTERN = /^https?:\/\/\S+$/i;

/** Raster and vector formats every current browser draws in an <img>. */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];

/** watch?v=, youtu.be/, shorts/, embed/ and live/ addresses, each ending in an 11-character video id. */
const YOUTUBE_PATTERN =
  /^https?:\/\/(?:(?:www\.|m\.|music\.)?youtube\.com\/(?:watch\?(?:\S*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i;

const STEAM_PATTERN = /^https?:\/\/store\.steampowered\.com\/app\/(\d+)(?!\d)/i;

/**
 * A header image as Steam hands it out, under the app's own folder: newer
 * games keep it behind a hashed folder no app id can lead to.
 */
const STEAM_HEADER_PATTERN =
  /^https?:\/\/[\w.-]*steamstatic\.com\/(?:store_item_assets\/)?steam\/apps\/(\d+)\/(?:[\w-]+\/)?header(?:_\w+)?\.jpg(?:[?#]\S*)?$/i;

/** deezer.com/track/1, with or without a language segment like /fr/. */
const DEEZER_PATTERN = /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?track\/(\d+)(?!\d)/i;

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

/** A positive whole number, as catalogues number their entries, sometimes written as text. */
function catalogueId(value: unknown): string | undefined {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? String(value) : undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? text : undefined;
}

/** A Steam app id, as a number, a store page address or a header image address. */
export function steamAppId(value: unknown): string | undefined {
  if (typeof value !== 'string') return catalogueId(value);
  const text = value.trim();
  return catalogueId(text) ?? STEAM_PATTERN.exec(text)?.[1] ?? STEAM_HEADER_PATTERN.exec(text)?.[1];
}

/** A Deezer track id, as a number or a track page address. */
export function deezerTrackId(value: unknown): string | undefined {
  return catalogueId(value) ?? (typeof value === 'string' ? DEEZER_PATTERN.exec(value.trim())?.[1] : undefined);
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

/** One image address, or a list of them. */
function imageLinks(value: unknown): string[] | undefined {
  if (isImageLink(value)) return [value.trim()];
  if (Array.isArray(value) && value.every(isImageLink)) return value.map((entry) => entry.trim());
  return undefined;
}

/* Pills: a few short words, repeated across items. */

/** More than this and the labels stop telling items apart at a glance. Tones repeat past eight. */
const PILL_MAX_VALUES = 24;
const PILL_MAX_LENGTH = 32;

/** Field names that say their text is a category, so it can be drawn as pills before its values repeat. */
const CATEGORY_FIELD = /genre|category|categories|type|kind|status|priority|tier|class|group|level|stage|state|severity|platform|cuisine|style|mood|format/i;

/** The colours a pill is drawn in. Each is a family of theme tokens. */
export const PILL_TONES = ['red', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'slate'] as const;
export type PillTone = (typeof PILL_TONES)[number];

/** Words whose colour is part of what they mean, so "high" is never drawn calm. */
const TONE_WORDS: Record<string, PillTone> = {
  critical: 'red',
  blocker: 'red',
  urgent: 'red',
  high: 'red',
  p0: 'red',
  p1: 'red',
  must: 'red',
  medium: 'amber',
  normal: 'amber',
  p2: 'amber',
  should: 'amber',
  low: 'green',
  minor: 'green',
  p3: 'green',
  could: 'green',
};

const pillKey = (value: string) => value.trim().toLowerCase();

/**
 * The colour a pill is drawn in. Read from the word alone, so a value is the
 * same colour on every card, in every list, every time.
 */
export function pillTone(value: string): PillTone {
  const key = pillKey(value);
  const known = TONE_WORDS[key];
  if (known !== undefined) return known;
  let hash = 5381;
  for (const char of key) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return PILL_TONES[hash % PILL_TONES.length]!;
}

function isPillList(values: unknown[], field: string | undefined): boolean {
  if (!values.every((value) => typeof value === 'string' && value.trim() !== '' && value.trim().length <= PILL_MAX_LENGTH)) {
    return false;
  }
  const distinct = new Set((values as string[]).map(pillKey)).size;
  if (distinct > PILL_MAX_VALUES) return false;
  // A quarter of the items repeat a value already seen: a field where nearly
  // every item is different is a name, not a category - unless its name says
  // otherwise.
  return distinct * 4 <= values.length * 3 || (field !== undefined && CATEGORY_FIELD.test(field));
}

/* Long text. */

/** Longer than this, or broken over lines, and a value reads as prose. */
const LONG_TEXT_MIN = 80;

/** Prose on one line: runs of spaces and line breaks become single spaces. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/* Locations. */

const COORDINATE_TEXT = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Field names that say their text is a place, so an address can be offered a map. */
const PLACE_FIELD = /address|location|city|place|venue|where|destination|town|neighbou?rhood|park|landmark|spot|map/i;

/** Latitude and longitude, from {lat, lng}, [lat, lng] or "lat, lng". */
export function coordinates(value: unknown): [number, number] | undefined {
  let pair: [unknown, unknown] | undefined;
  if (Array.isArray(value) && value.length === 2) pair = [value[0], value[1]];
  else if (typeof value === 'string') {
    const match = COORDINATE_TEXT.exec(value);
    if (match !== null) pair = [Number(match[1]), Number(match[2])];
  } else if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    pair = [record.lat ?? record.latitude, record.lng ?? record.lon ?? record.longitude];
  }
  if (pair === undefined) return undefined;
  const [lat, lng] = pair;
  if (!isNumber(lat) || !isNumber(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return [lat, lng];
}

function isPlaceText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim().length <= 200 && !isLink(value);
}

/** What a location reads as: its address, or its coordinates to about ten metres. */
export function locationText(value: unknown): string | undefined {
  const pair = coordinates(value);
  if (pair !== undefined) return pair.map((part) => Number(part.toFixed(4))).join(', ');
  return isPlaceText(value) ? value.trim() : undefined;
}

/** A map search for the place, which opens the maps app where there is one. */
export function mapUrl(value: unknown): string | undefined {
  const pair = coordinates(value);
  const query = pair !== undefined ? pair.join(',') : locationText(value);
  return query === undefined ? undefined : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/* Flags. */

/** Codes some systems use for a country in place of its ISO code. */
const REGION_ALIASES: Record<string, string> = { UK: 'GB' };

let englishRegions: Intl.DisplayNames | null | undefined;
let localRegions: Intl.DisplayNames | null | undefined;

function regionNames(local: boolean): Intl.DisplayNames | null {
  try {
    if (local) return (localRegions ??= new Intl.DisplayNames(undefined, { type: 'region' }));
    return (englishRegions ??= new Intl.DisplayNames(['en'], { type: 'region' }));
  } catch {
    return null;
  }
}

/** The ISO 3166 code a value names, or undefined when it names no real region. */
export function regionCode(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value.trim())) return undefined;
  const upper = value.trim().toUpperCase();
  const code = REGION_ALIASES[upper] ?? upper;
  // AA, QM-QZ and XA-XZ are private use, and ZZ is "unknown".
  if (/^(AA|Q[M-Z]|X[A-Z]|ZZ)$/.test(code)) return undefined;
  const name = regionNames(false)?.of(code);
  // An unknown code comes back as itself.
  return name === undefined || name === code ? undefined : code;
}

/** A two-letter code as its flag, built from the regional indicator letters. */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

/** The flag and the region's name in the reader's own language. */
export function flagText(value: unknown): string | undefined {
  const code = regionCode(value);
  if (code === undefined) return undefined;
  return `${flagEmoji(code)} ${regionNames(true)?.of(code) ?? code}`;
}

/* Colours. */

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR = /^(?:rgba?|hsla?)\(\s*-?[\d.]+(?:deg|%)?(?:\s*[,\s/]\s*-?[\d.]+%?){2,3}\s*\)$/i;

/** A colour written as CSS writes it: #hex, rgb() or hsl(). */
export function isColor(value: unknown): value is string {
  return typeof value === 'string' && (HEX_COLOR.test(value.trim()) || FUNCTION_COLOR.test(value.trim()));
}

/* Ratings and money. */

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

/** The currency a money renderer reads its value in. */
export function currencyOf(renderer: FieldRenderer | undefined): Currency | undefined {
  const match = /^currency-([A-Z]{3})$/.exec(renderer ?? '');
  return match === null ? undefined : (match[1] as Currency);
}

/**
 * Building a formatter costs far more than using one, and the ranked list asks
 * for one per field per row, so each is built once and kept.
 */
const moneyFormats = new Map<string, Intl.NumberFormat>();
let dateFormat: Intl.DateTimeFormat | undefined;
let compactFormat: Intl.NumberFormat | undefined;

/** An amount in its currency, without cents when it is a whole number. */
function moneyText(value: number, currency: Currency): string {
  const whole = Number.isInteger(value);
  const key = `${currency}-${whole}`;
  let format = moneyFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
    moneyFormats.set(key, format);
  }
  return format.format(value);
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
  accepts: (values: unknown[], field: string | undefined) => boolean;
}[] = [
  { id: 'link', label: 'Link', hint: 'Opens in a new tab', accepts: (values) => values.every(isLink) },
  { id: 'image', label: 'Image', hint: 'Pictured beside the title', accepts: (values) => values.every(isImageLink) },
  {
    id: 'image-gallery',
    label: 'Image gallery',
    hint: 'Several pictures to page through',
    // Offered for lists only: a field of single images is already an image.
    accepts: (values) =>
      values.every((value) => imageLinks(value) !== undefined) &&
      values.some((value) => Array.isArray(value) && value.length > 0),
  },
  {
    id: 'youtube',
    label: 'YouTube thumbnail',
    hint: "The video's picture, opening the video",
    accepts: (values) => values.every((value) => youtubeId(value) !== undefined),
  },
  {
    id: 'steam-header',
    label: 'Steam header',
    hint: "The game's store banner, by app id or banner address",
    accepts: (values) => values.every((value) => steamAppId(value) !== undefined),
  },
  { id: 'tags', label: 'Tags', hint: 'Each entry as its own label', accepts: (values) => values.every(isTagList) },
  {
    id: 'pills',
    label: 'Pills',
    hint: 'A coloured label, the same colour for the same word',
    accepts: isPillList,
  },
  {
    id: 'long-text',
    label: 'Long text',
    hint: 'A few lines, with the rest a tap away',
    accepts: (values) =>
      values.every((value) => typeof value === 'string') &&
      (values as string[]).some((value) => value.length > LONG_TEXT_MIN || value.includes('\n')),
  },
  {
    id: 'location',
    label: 'Location',
    hint: 'Opens on a map',
    accepts: (values, field) =>
      values.every((value) => coordinates(value) !== undefined) ||
      (field !== undefined && PLACE_FIELD.test(field) && values.every(isPlaceText)),
  },
  {
    id: 'flag',
    label: 'Flag',
    hint: 'A two-letter country code as its flag and name',
    accepts: (values) => values.every((value) => regionCode(value) !== undefined),
  },
  { id: 'color-swatch', label: 'Colour swatch', hint: 'A square of the colour', accepts: (values) => values.every(isColor) },
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
    accepts: (values) => values.every((value) => catalogueId(value) !== undefined),
  },
  {
    id: 'deezer-preview',
    label: 'Deezer preview',
    hint: 'Plays a clip, by track id or address',
    accepts: (values) => values.every((value) => deezerTrackId(value) !== undefined),
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
  const scales = present.length === 0 ? [] : fittingScales(present);
  const money = present.length > 0 && present.every(isNumber);
  return [
    { id: undefined, label: types.length === 1 ? types[0]! : 'text' },
    ...SPECIAL_RENDERERS.filter((renderer) => present.length > 0 && renderer.accepts(present, field)).map(
      ({ id, label, hint }) => ({ id, label, hint }),
    ),
    ...(scales.length === 0
      ? []
      : RATINGS.map(({ kind, label, hint }) => ({
          id: `${kind}-${scales[0]!}` as FieldRenderer,
          label,
          hint,
          variantPrompt: 'out of',
          variants: scales.map((scale) => ({ id: `${kind}-${scale}` as FieldRenderer, label: String(scale) })),
        }))),
    ...(money
      ? [
          {
            id: `currency-${CURRENCIES[0]}` as FieldRenderer,
            label: 'Currency',
            hint: 'An amount of money',
            variantPrompt: 'in',
            variants: CURRENCIES.map((currency) => ({ id: `currency-${currency}` as FieldRenderer, label: currency })),
          },
        ]
      : []),
  ];
}

/** Something worth knowing about how a field will be drawn. */
export interface RendererCaveat {
  /** A warning says some items may draw badly; a tip says how to do better. */
  tone: 'warning' | 'tip';
  text: string;
  /** Fields in the order they are used, this one among them, for a numbered list. */
  order?: { field: string; current: boolean }[];
}

/** What a caveat may depend on beyond the field's own values. */
/** Another field on the card, and how it is drawn. */
export interface CardField {
  field: string;
  renderer: FieldRenderer | undefined;
}

export interface CaveatContext {
  /** The field the caveat is about. */
  field: string;
  /** The fields above this one on the card, in order. */
  earlier: CardField[];
  /** The fields below this one on the card, in order. */
  later: CardField[];
  /** Whether this browser draws flag emoji, rather than their two letters. */
  drawsFlags: boolean;
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
  const present = values.filter((value) => value !== undefined && value !== null && value !== '');
  // Fields sharing one place on the card - the play button, or the picture
  // beside the title - each list all of them, in the order they are used.
  const slot = slotOf(renderer);
  const sharing = (others: CardField[]) => others.filter((other) => slotOf(other.renderer) === slot);
  if (slot !== 'line' && sharing(context.earlier).length + sharing(context.later).length > 0) {
    const order = [
      ...sharing(context.earlier).map(({ field }) => ({ field, current: false })),
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
  switch (renderer) {
    case 'steam-header':
      return present.some((value) => !(typeof value === 'string' && STEAM_HEADER_PATTERN.test(value.trim())))
        ? {
            tone: 'warning',
            text: "Newer games keep their banner where an app id can't find it, so some may show an empty frame. The banner's own address always works: on the game's store page, copy the address of the header image.",
          }
        : undefined;
    case 'flag':
      return context.drawsFlags
        ? undefined
        : {
            tone: 'tip',
            text: "This browser shows flags as their two letters, like US, beside the country's name. Firefox, and most phones and Macs, draw the flags themselves.",
          };
    case 'apple-music-preview':
    case 'deezer-preview':
      // The only preview on the card: sharing ones are answered above.
      return {
        tone: 'tip',
        text: 'Not every track has a preview clip, and some are not available in every country. Show an Apple Music or Deezer field as well, and the play button falls back to it.',
      };
    case 'location':
      return present.some((value) => coordinates(value) === undefined)
        ? {
            tone: 'tip',
            text: 'An address opens a map search, which may pick the wrong place. Coordinates, like 53.12, -9.73, point to the exact spot.',
          }
        : undefined;
    default:
      return undefined;
  }
}

/** The renderer's own name, for a configuration summary. */
export function rendererNote(renderer: FieldRenderer): string {
  const scale = ratingScale(renderer);
  if (scale !== undefined) return `${isRating(renderer, 'stars') ? 'stars' : 'bar'} /${scale}`;
  const currency = currencyOf(renderer);
  if (currency !== undefined) return currency;
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
  const currency = currencyOf(renderer);
  if (currency !== undefined) return isNumber(value) ? moneyText(value, currency) : summaryText(value);
  switch (renderer) {
    case 'link':
    case 'image':
    case 'youtube':
      return isLink(value) ? linkText(value) : summaryText(value);
    case 'image-gallery': {
      const count = imageLinks(value)?.length;
      return count === undefined ? summaryText(value) : `${count} ${count === 1 ? 'picture' : 'pictures'}`;
    }
    case 'tags':
      return isTagList(value) ? (value.length === 0 ? '–' : value.join(', ')) : summaryText(value);
    case 'pills':
      return typeof value === 'string' ? value.trim() : summaryText(value);
    case 'long-text':
      return typeof value === 'string' ? oneLine(value) : summaryText(value);
    case 'location':
      return locationText(value) ?? summaryText(value);
    case 'flag':
      return flagText(value) ?? summaryText(value);
    case 'color-swatch':
      return typeof value === 'string' ? value.trim() : summaryText(value);
    case 'date': {
      const parts = dateParts(value);
      if (parts === undefined) return summaryText(value);
      // Read as a calendar day, not an instant, so no time zone moves it.
      dateFormat ??= new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
      return dateFormat.format(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    }
    case 'year':
      return String(dateParts(value)?.[0] ?? summaryText(value));
    case 'duration':
      return isNumber(value) ? durationText(value) : summaryText(value);
    case 'compact':
      return isNumber(value)
        ? (compactFormat ??= new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })).format(value)
        : summaryText(value);
    case 'badge':
      return value === true ? field : value === false ? null : summaryText(value);
    default:
      return summaryText(value);
  }
}

/** One picture in a card's picture slot, and where it leads. */
export interface Picture {
  uri: string;
  /** Width over height. Most are square crops; a store banner keeps its shape. */
  aspect: number;
  /** Opened by the picture, in a new tab: a video, a store page. */
  href?: string;
  /** What opening it does, for its accessible name: "Watch {label} on YouTube". */
  action?: string;
  /** Marked as something that plays. */
  video?: boolean;
}

/** Steam's store banners are 460 by 215. */
const STEAM_HEADER_ASPECT = 460 / 215;

/** Every picture one field's value gives, in order. A value that gives none is an empty list. */
export function picturesOf(value: unknown, renderer: FieldRenderer | undefined): Picture[] {
  switch (renderer) {
    case 'image':
    case 'image-gallery':
      return (imageLinks(value) ?? []).map((uri) => ({ uri, aspect: 1 }));
    case 'youtube': {
      const id = youtubeId(value);
      if (id === undefined) return [];
      return [
        {
          uri: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          aspect: 1,
          href: `https://www.youtube.com/watch?v=${id}`,
          action: 'Watch {label} on YouTube',
          video: true,
        },
      ];
    }
    case 'steam-header': {
      const id = steamAppId(value);
      if (id === undefined) return [];
      return [
        {
          // A banner address is drawn as given. An id or a store page falls
          // back to where most games keep theirs; newer ones may not, and an
          // image that fails keeps an empty frame like any other.
          uri:
            typeof value === 'string' && STEAM_HEADER_PATTERN.test(value.trim())
              ? value.trim()
              : `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
          aspect: STEAM_HEADER_ASPECT,
          href: `https://store.steampowered.com/app/${id}`,
          action: 'Open {label} on Steam',
        },
      ];
    }
    default:
      return [];
  }
}

/** A catalogue a play button can find a clip in. */
export type PreviewProvider = 'apple' | 'deezer';

export interface PreviewSource {
  provider: PreviewProvider;
  id: string;
}

/** The clip a value names, for a play-button renderer. */
export function previewSourceOf(value: unknown, renderer: FieldRenderer | undefined): PreviewSource | undefined {
  if (renderer === 'apple-music-preview') {
    const id = catalogueId(value);
    return id === undefined ? undefined : { provider: 'apple', id };
  }
  if (renderer === 'deezer-preview') {
    const id = deezerTrackId(value);
    return id === undefined ? undefined : { provider: 'deezer', id };
  }
  return undefined;
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
