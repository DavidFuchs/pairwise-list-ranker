/** The user's own document is the model. See the guided-import spec, section 3. */

import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

export type SourceFormat = 'list' | 'yaml' | 'json';

/** The preview rail's tabs: the ranked view, or the data in a text format. */
export type PreviewTab = 'ranked' | SourceFormat;

export interface DataSource {
  /** How the text parsed. Also the default export format. */
  format: SourceFormat;
  /** Exactly what the user gave us, so the data screen can show it back. */
  rawText: string;
  /** The parsed value, verbatim. A string[] when format is 'list'. */
  document: unknown;
  /** Path to the ranked array within document. Empty when document is the array. */
  arrayPath: string[];
}

export const MAX_SUMMARY_FIELDS = 3;

export interface FieldRoles {
  /** Object entries only: which field shows on the comparison cards. */
  labelField?: string;
  /**
   * Object entries only: up to MAX_SUMMARY_FIELDS fields always shown, in this
   * order, on each comparison card. Empty or absent means the card picks its
   * own from whatever the item happens to carry.
   */
  summaryFields?: string[];
  /** Optional: which field is rewritten with 1..N on export. */
  positionField?: string;
}

/** How one list is ranked: which fields carry which role, and its order. */
export interface ListConfig {
  roles: FieldRoles;
  alreadyRanked: boolean;
}

export interface Workspace {
  id: string;
  source: DataSource;
  roles: FieldRoles;
  /** True when the imported order is a trusted best-to-worst ranking, not an
   * arbitrary sequence - seeds initial ratings from it instead of flat 1500. */
  alreadyRanked: boolean;
  /**
   * The answer every list in this document gets until it is set up on its
   * own. Held per document rather than read off whichever list is open, so
   * that hand-configuring one list cannot quietly redefine what the next
   * untouched list inherits.
   */
  listDefaults: ListConfig;
  /**
   * True when this list's own setup came from the data screen. False when it
   * was derived from listDefaults, which is what lets a later change to the
   * defaults still reach it.
   */
  configuredExplicitly: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A list's ranking progress while a different list from the same document is
 * active. One document can hold several rankable lists, and moving between
 * them must not discard any of them - so each one that has been ranked stays
 * here until the user comes back to it.
 */
export interface SavedList {
  workspaceId: string;
  arrayPath: string[];
  roles: FieldRoles;
  alreadyRanked: boolean;
  /** See Workspace.configuredExplicitly - a list keeps its answer across a
   *  switch, including whether that answer was ever the user's own. */
  configuredExplicitly: boolean;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  createdAt: string;
  updatedAt: string;
}
