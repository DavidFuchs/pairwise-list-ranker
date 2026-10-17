/**
 * Every way a field can be drawn, one entry each. Adding a renderer is its id
 * in FIELD_RENDERERS and an entry here; a line renderer that draws more than
 * text also gets a view in components/preview/FieldValue.tsx.
 */
import {
  catalogueId,
  coordinates,
  dateParts,
  deezerTrackId,
  durationText,
  compactText,
  dateText,
  flagText,
  imageLinks,
  isColor,
  isImageLink,
  isLink,
  isNumber,
  isPillList,
  isPlaceText,
  isRating,
  isTagList,
  linkText,
  locationText,
  LONG_TEXT_MIN,
  moneyText,
  oneLine,
  PLACE_FIELD,
  ratingScale,
  ratingText,
  currencyOf,
  regionCode,
  STEAM_HEADER_PATTERN,
  steamAppId,
  youtubeId,
} from '@/lib/renderers/values';
import { CURRENCIES, RATING_SCALES } from '@/types/source';
import type { Currency, FieldRenderer, RatingScale } from '@/types/source';

/**
 * Where a renderer puts its field on a card. Lines read under the title, one
 * per field. A card has one picture slot and one play button, and every field
 * drawn as either feeds that one place rather than competing for it: pictures
 * page through a gallery, sources line up as fallbacks.
 */
export type RendererSlot = 'picture' | 'media' | 'line';

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

/** A catalogue a play button can find a clip in. */
export type PreviewProvider = 'apple' | 'deezer';

export interface PreviewSource {
  provider: PreviewProvider;
  id: string;
}

/** Something worth knowing about how a field will be drawn. */
export interface RendererCaveat {
  /** A warning says some items may draw badly; a tip says how to do better. */
  tone: 'warning' | 'tip';
  text: string;
  /** Fields in the order they are used, this one among them, for a numbered list. */
  order?: { field: string; current: boolean }[];
}

/** Another field on the card, and how it is drawn. */
export interface CardField {
  field: string;
  renderer: FieldRenderer | undefined;
}

/** What a caveat may depend on beyond the field's own values. */
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

/** The renderers that come in variants: a rating's scale, money's currency. */
type FamilyRenderer = `${'stars' | 'bar'}-${RatingScale}` | `currency-${Currency}`;

/** A renderer with one form, and so one entry in RENDERERS. */
export type FixedRenderer = Exclude<FieldRenderer, FamilyRenderer>;

export interface RendererDefinition {
  label: string;
  /** What it does, for the choice that offers it. */
  hint: string;
  /** Where it draws on a card: a line unless it says otherwise. */
  slot?: RendererSlot;
  /** Whether it can draw every one of these values: one that does not fit rules it out. */
  accepts: (values: unknown[], field: string | undefined) => boolean;
  /**
   * One line of text for a value. Undefined when it cannot read this value,
   * which then reads as plain text; null when it draws nothing at all.
   */
  format?: (value: unknown, field: string) => string | null | undefined;
  /** Its name in a setup summary, when that is not its label in lower case. */
  note?: string;
  /** The one thing worth saying about these values, said only when it applies. */
  caveat?: (present: unknown[], context: CaveatContext) => RendererCaveat | undefined;
  /** Every picture a value gives, for a picture renderer. */
  pictures?: (value: unknown) => Picture[];
  /** The clip a value names, for a play-button renderer. */
  preview?: (value: unknown) => PreviewSource | undefined;
}

const linkFormat = (value: unknown) => (isLink(value) ? linkText(value) : undefined);

/** Steam's store banners are 460 by 215. */
const STEAM_HEADER_ASPECT = 460 / 215;

const PREVIEW_CAVEAT: RendererCaveat = {
  tone: 'tip',
  text: 'Not every track has a preview clip, and some are not available in every country. Show an Apple Music or Deezer field as well, and the play button falls back to it.',
};

/** In the order a field's choices are offered. */
export const RENDERERS: Record<FixedRenderer, RendererDefinition> = {
  link: {
    label: 'Link',
    hint: 'Opens in a new tab',
    accepts: (values) => values.every(isLink),
    format: linkFormat,
  },
  image: {
    label: 'Image',
    hint: 'Pictured beside the title',
    slot: 'picture',
    accepts: (values) => values.every(isImageLink),
    format: linkFormat,
    pictures: (value) => (imageLinks(value) ?? []).map((uri) => ({ uri, aspect: 1 })),
  },
  'image-gallery': {
    label: 'Image gallery',
    hint: 'Several pictures to page through',
    slot: 'picture',
    // Offered for lists only: a field of single images is already an image.
    accepts: (values) =>
      values.every((value) => imageLinks(value) !== undefined) &&
      values.some((value) => Array.isArray(value) && value.length > 0),
    format: (value) => {
      const count = imageLinks(value)?.length;
      return count === undefined ? undefined : `${count} ${count === 1 ? 'picture' : 'pictures'}`;
    },
    pictures: (value) => (imageLinks(value) ?? []).map((uri) => ({ uri, aspect: 1 })),
  },
  youtube: {
    label: 'YouTube thumbnail',
    hint: "The video's picture, opening the video",
    slot: 'picture',
    accepts: (values) => values.every((value) => youtubeId(value) !== undefined),
    format: linkFormat,
    pictures: (value) => {
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
    },
  },
  'steam-header': {
    label: 'Steam header',
    hint: "The game's store banner, by app id or banner address",
    slot: 'picture',
    accepts: (values) => values.every((value) => steamAppId(value) !== undefined),
    caveat: (present) =>
      present.some((value) => !(typeof value === 'string' && STEAM_HEADER_PATTERN.test(value.trim())))
        ? {
            tone: 'warning',
            text: "Newer games keep their banner where an app id can't find it, so some may show an empty frame. The banner's own address always works: on the game's store page, copy the address of the header image.",
          }
        : undefined,
    pictures: (value) => {
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
    },
  },
  tags: {
    label: 'Tags',
    hint: 'Each entry as its own label',
    accepts: (values) => values.every(isTagList),
    format: (value) => (isTagList(value) ? (value.length === 0 ? '–' : value.join(', ')) : undefined),
  },
  pills: {
    label: 'Pills',
    hint: 'A coloured label, the same colour for the same word',
    accepts: isPillList,
    format: (value) => (typeof value === 'string' ? value.trim() : undefined),
  },
  'long-text': {
    label: 'Long text',
    hint: 'A few lines, with the rest a tap away',
    accepts: (values) =>
      values.every((value) => typeof value === 'string') &&
      (values as string[]).some((value) => value.length > LONG_TEXT_MIN || value.includes('\n')),
    format: (value) => (typeof value === 'string' ? oneLine(value) : undefined),
  },
  location: {
    label: 'Location',
    hint: 'Opens on a map',
    accepts: (values, field) =>
      values.every((value) => coordinates(value) !== undefined) ||
      (field !== undefined && PLACE_FIELD.test(field) && values.every(isPlaceText)),
    format: locationText,
    caveat: (present) =>
      present.some((value) => coordinates(value) === undefined)
        ? {
            tone: 'tip',
            text: 'An address opens a map search, which may pick the wrong place. Coordinates, like 53.12, -9.73, point to the exact spot.',
          }
        : undefined,
  },
  flag: {
    label: 'Flag',
    hint: 'A two-letter country code as its flag and name',
    accepts: (values) => values.every((value) => regionCode(value) !== undefined),
    format: flagText,
    caveat: (_present, context) =>
      context.drawsFlags
        ? undefined
        : {
            tone: 'tip',
            text: "This browser shows flags as their two letters, like US, beside the country's name. Firefox, and most phones and Macs, draw the flags themselves.",
          },
  },
  'color-swatch': {
    label: 'Colour swatch',
    hint: 'A square of the colour',
    accepts: (values) => values.every(isColor),
    format: (value) => (typeof value === 'string' ? value.trim() : undefined),
  },
  date: {
    label: 'Date',
    hint: 'In your own date format',
    accepts: (values) => values.every((value) => dateParts(value) !== undefined),
    format: (value) => {
      const parts = dateParts(value);
      return parts === undefined ? undefined : dateText(parts);
    },
  },
  year: {
    label: 'Year only',
    hint: 'Just the year of the date',
    accepts: (values) => values.every((value) => dateParts(value) !== undefined),
    format: (value) => {
      const parts = dateParts(value);
      return parts === undefined ? undefined : String(parts[0]);
    },
  },
  duration: {
    label: 'Duration (seconds)',
    hint: 'Whole seconds as minutes and seconds',
    accepts: (values) => values.every((value) => isNumber(value) && Number.isInteger(value) && value >= 0),
    format: (value) => (isNumber(value) ? durationText(value) : undefined),
  },
  compact: {
    label: 'Compact number',
    hint: 'Large numbers shortened, like 1.5M',
    // Offered only where there is something to shorten.
    accepts: (values) => values.every(isNumber) && values.some((value) => Math.abs(value as number) >= 1000),
    format: (value) => (isNumber(value) ? compactText(value) : undefined),
  },
  badge: {
    label: 'Badge',
    hint: 'The field name when true, nothing when false',
    accepts: (values) => values.every((value) => typeof value === 'boolean'),
    format: (value, field) => (value === true ? field : value === false ? null : undefined),
  },
  'apple-music-preview': {
    label: 'Apple Music preview',
    hint: 'Plays a clip, by track id',
    slot: 'media',
    note: 'preview',
    accepts: (values) => values.every((value) => catalogueId(value) !== undefined),
    // The only preview on the card: sharing ones are answered by the slot.
    caveat: () => PREVIEW_CAVEAT,
    preview: (value) => {
      const id = catalogueId(value);
      return id === undefined ? undefined : { provider: 'apple', id };
    },
  },
  'deezer-preview': {
    label: 'Deezer preview',
    hint: 'Plays a clip, by track id or address',
    slot: 'media',
    accepts: (values) => values.every((value) => deezerTrackId(value) !== undefined),
    caveat: () => PREVIEW_CAVEAT,
    preview: (value) => {
      const id = deezerTrackId(value);
      return id === undefined ? undefined : { provider: 'deezer', id };
    },
  },
};

/**
 * Renderers that come in variants, each variant its own renderer id: a rating
 * out of one of several scales, or money in one of several currencies. Offered
 * as one choice with its fitting variants beside it.
 */
export interface RendererFamily {
  label: string;
  hint: string;
  /** Read before the variants: "out of" 10, "in" CAD. */
  variantPrompt: string;
  /** Whether a renderer id is one of this family's variants. */
  owns: (renderer: FieldRenderer) => boolean;
  /** The variants that draw every value, in the order offered; none rules the family out. */
  variantsFor: (values: unknown[]) => { id: FieldRenderer; label: string }[];
  /** As RendererDefinition.format, for one of this family's ids. */
  format: (value: unknown, renderer: FieldRenderer) => string | undefined;
  /** Its name in a setup summary. */
  note: (renderer: FieldRenderer) => string;
}

/** The scales every value fits under: none negative, none above the scale. */
function fittingScales(values: unknown[]): RatingScale[] {
  if (!values.every(isNumber) || values.some((value) => (value as number) < 0)) return [];
  const highest = Math.max(...(values as number[]));
  return RATING_SCALES.filter((scale) => highest <= scale);
}

function ratingFamily(kind: 'stars' | 'bar', label: string, hint: string): RendererFamily {
  return {
    label,
    hint,
    variantPrompt: 'out of',
    owns: (renderer) => isRating(renderer, kind),
    variantsFor: (values) =>
      fittingScales(values).map((scale) => ({
        id: `${kind}-${scale}` as FieldRenderer,
        label: String(scale),
      })),
    format: (value, renderer) => {
      const scale = ratingScale(renderer);
      if (scale === undefined || !isNumber(value)) return undefined;
      return kind === 'stars' ? `★ ${ratingText(value, scale)}` : ratingText(value, scale);
    },
    note: (renderer) => `${kind} /${ratingScale(renderer)}`,
  };
}

/** In the order they are offered, after every renderer in RENDERERS. */
export const FAMILIES: RendererFamily[] = [
  ratingFamily('stars', 'Stars', 'Five stars, filled to the score'),
  ratingFamily('bar', 'Bar', 'A bar filled to the score'),
  {
    label: 'Currency',
    hint: 'An amount of money',
    variantPrompt: 'in',
    owns: (renderer) => currencyOf(renderer) !== undefined,
    variantsFor: (values) =>
      values.every(isNumber)
        ? CURRENCIES.map((currency) => ({ id: `currency-${currency}` as FieldRenderer, label: currency }))
        : [],
    format: (value, renderer) => {
      const currency = currencyOf(renderer);
      return currency === undefined || !isNumber(value) ? undefined : moneyText(value, currency);
    },
    note: (renderer) => currencyOf(renderer) ?? renderer,
  },
];

/** The entry for a renderer with one form, or undefined for none or a family's variant. */
export function definitionOf(renderer: FieldRenderer | undefined): RendererDefinition | undefined {
  return renderer !== undefined && Object.hasOwn(RENDERERS, renderer)
    ? RENDERERS[renderer as FixedRenderer]
    : undefined;
}

/** The family a variant id belongs to. */
export function familyOf(renderer: FieldRenderer | undefined): RendererFamily | undefined {
  return renderer === undefined ? undefined : FAMILIES.find((family) => family.owns(renderer));
}
