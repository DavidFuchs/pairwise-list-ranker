/**
 * Reading values: what a value is (a link, a date, a place, a colour) and how
 * it reads as text. Nothing here knows which renderer asked; the registry
 * puts these together into renderers.
 */
import type { Currency, FieldRenderer, RatingScale } from '@/types/source';

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
export const STEAM_HEADER_PATTERN =
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
export function catalogueId(value: unknown): string | undefined {
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
  return (
    catalogueId(value) ?? (typeof value === 'string' ? DEEZER_PATTERN.exec(value.trim())?.[1] : undefined)
  );
}

/** A link shortened to read on a chip: the host and path, without the scheme. */
export function linkText(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

/** The year, month and day of an ISO date, when it names a real one. */
export function dateParts(value: unknown): [number, number, number] | undefined {
  if (typeof value !== 'string') return undefined;
  const match = DATE_PATTERN.exec(value.trim());
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects a 2023-02-30 that Date would quietly roll into March.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? [year, month, day] : undefined;
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isTagList(value: unknown): value is (string | number)[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' || isNumber(entry));
}

/** One image address, or a list of them. */
export function imageLinks(value: unknown): string[] | undefined {
  if (isImageLink(value)) return [value.trim()];
  if (Array.isArray(value) && value.every(isImageLink)) return value.map((entry) => entry.trim());
  return undefined;
}

/* Pills: a few short words, repeated across items. */

/** More than this and the labels stop telling items apart at a glance. Tones repeat past eight. */
const PILL_MAX_VALUES = 24;
const PILL_MAX_LENGTH = 32;

/** Field names that say their text is a category, so it can be drawn as pills before its values repeat. */
const CATEGORY_FIELD =
  /genre|category|categories|type|kind|status|priority|tier|class|group|level|stage|state|severity|platform|cuisine|style|mood|format/i;

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

export function isPillList(values: unknown[], field: string | undefined): boolean {
  if (
    !values.every(
      (value) => typeof value === 'string' && value.trim() !== '' && value.trim().length <= PILL_MAX_LENGTH,
    )
  ) {
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
export const LONG_TEXT_MIN = 80;

/** Prose on one line: runs of spaces and line breaks become single spaces. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/* Locations. */

const COORDINATE_TEXT = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Field names that say their text is a place, so an address can be offered a map. */
export const PLACE_FIELD =
  /address|location|city|place|venue|where|destination|town|neighbou?rhood|park|landmark|spot|map/i;

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

export function isPlaceText(value: unknown): value is string {
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
  return query === undefined
    ? undefined
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
export function moneyText(value: number, currency: Currency): string {
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

/** Whole seconds as m:ss, or h:mm:ss past the hour. */
export function durationText(seconds: number): string {
  const whole = Math.round(seconds);
  const [h, m, s] = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60];
  const pad = (part: number) => String(part).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A calendar day in the reader's own format. Read as a day, not an instant, so no time zone moves it. */
export function dateText([year, month, day]: [number, number, number]): string {
  dateFormat ??= new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return dateFormat.format(Date.UTC(year, month - 1, day));
}

/** A large number shortened, like 1.5M. */
export function compactText(value: number): string {
  compactFormat ??= new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
  return compactFormat.format(value);
}
