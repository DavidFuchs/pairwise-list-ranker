/** Pairwise comparison and rating shapes. See ARCHITECTURE.md sections 5.1 and 6. */

/**
 * A choice between two items, or a placement from the ranked list: the left
 * item moved by hand to sit directly below (or, at the very top, directly
 * above) the right one. A placement is a statement about position, not a
 * contest, so it moves only the item that was moved.
 */
export type ComparisonOutcome =
  | 'left'
  | 'right'
  | 'left_strong'
  | 'right_strong'
  | 'skip'
  | 'place_below'
  | 'place_above';

export interface RankingState {
  itemId: string;
  rating: number;
  comparisons: number;
  wins: number;
  losses: number;
  skips: number;
  lastComparedAt?: string;
}

export interface ComparisonEvent {
  id: string;
  listId: string;
  leftItemId: string;
  rightItemId: string;
  outcome: ComparisonOutcome;
  createdAt: string;
}

/** A single ranked row of the derived ordering shown in previews and exports. */
export interface RankedItem<TItem = unknown> {
  rank: number;
  item: TItem;
  state: RankingState;
}

export interface CandidatePair {
  leftItemId: string;
  rightItemId: string;
  /** Higher means a more informative pair to show next. */
  score: number;
}
