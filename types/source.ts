/** The user's own document is the model. See the guided-import spec, section 3. */

import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

export type SourceFormat = 'list' | 'yaml' | 'json';

/** The preview rail's tabs: the ranked view, or the data in a text format. */
export type PreviewTab = 'ranked' | SourceFormat;

export interface DataSource {
  /** How the text parsed. Also the default export format. */
  format: SourceFormat;
  /**
   * The parsed value, verbatim. A string[] when format is 'list'. The text it
   * came from is not kept: the data screen writes it back out from this, in
   * the ranked order, which is the text worth showing.
   */
  document: unknown;
  /** Path to the ranked array within document. Empty when document is the array. */
  arrayPath: string[];
}

/** What a score is out of, for the stars and bar renderers. */
export const RATING_SCALES = [1, 5, 10, 100] as const;
export type RatingScale = (typeof RATING_SCALES)[number];

/** The currencies a money field can be read in, for the currency renderer. */
export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Special ways to draw a field. Plain text is the absence of one. A rating
 * carries its scale in its name, and money its currency, so the choice stays
 * one plain string.
 */
export const FIELD_RENDERERS = [
  'link',
  'image',
  'image-gallery',
  'youtube',
  'steam-header',
  'tags',
  'pills',
  'long-text',
  'location',
  'flag',
  'color-swatch',
  'date',
  'year',
  'duration',
  'compact',
  'badge',
  'apple-music-preview',
  'deezer-preview',
  ...RATING_SCALES.map((scale) => `stars-${scale}` as const),
  ...RATING_SCALES.map((scale) => `bar-${scale}` as const),
  ...CURRENCIES.map((currency) => `currency-${currency}` as const),
] as const;
export type FieldRenderer = (typeof FIELD_RENDERERS)[number];

export interface FieldRoles {
  /** Object entries only: which field shows on the comparison cards. */
  labelField?: string;
  /**
   * Object entries only: the fields always shown, in this
   * order, on each comparison card. Empty or absent means the card picks its
   * own from whatever the item happens to carry.
   */
  summaryFields?: string[];
  /**
   * How a chosen summary field is drawn when not as plain text. Only fields
   * with a special renderer appear here; absent means plain text.
   */
  fieldRenderers?: Record<string, FieldRenderer>;
  /** Optional: which field is rewritten with 1..N on export. */
  positionField?: string;
}

/** How one list is ranked: which fields carry which role, and its order. */
export interface ListConfig {
  roles: FieldRoles;
  alreadyRanked: boolean;
}

/**
 * One list in the document: how it is set up and everything ranked in it. A
 * document can hold several rankable lists, and each one the user opens is
 * kept here until the session ends, so moving between them never loses any.
 */
export interface RankedList {
  /** Items and comparison events name the list they belong to by this. */
  id: string;
  /** Where the list sits in the document. */
  arrayPath: string[];
  roles: FieldRoles;
  /** True when the imported order is a trusted best-to-worst ranking, not an
   * arbitrary sequence - seeds initial ratings from it instead of flat 1500. */
  alreadyRanked: boolean;
  /**
   * True when this list's setup came from the data screen. False when it was
   * derived from the document's listDefaults, which is what lets a later
   * change to the defaults still reach it.
   */
  configuredExplicitly: boolean;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  createdAt: string;
  updatedAt: string;
}

/** The document being ranked, and every list in it that has been opened. */
export interface Workspace {
  /** The user's document. Its arrayPath names the list open now. */
  source: DataSource;
  /**
   * The answer every list in this document gets until it is set up on its
   * own. Held per document rather than read off whichever list is open, so
   * that hand-configuring one list cannot quietly redefine what the next
   * untouched list inherits.
   */
  listDefaults: ListConfig;
  /** Keyed by pathKey of each list's arrayPath; always holds the open one. */
  lists: Record<string, RankedList>;
  createdAt: string;
  updatedAt: string;
}
