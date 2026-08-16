/** Pairwise comparison and rating shapes. See ARCHITECTURE.md sections 5.1 and 6. */

export type ComparisonOutcome = 'left' | 'right' | 'left_strong' | 'right_strong' | 'skip';

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
