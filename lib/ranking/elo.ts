import type { ComparisonOutcome, RankingState } from '@/types/ranking';

/** Rating every item starts from. See ARCHITECTURE.md section 6.2. */
export const INITIAL_RATING = 1500;

/** Standard rating movement for a settled item. */
export const BASE_K_FACTOR = 24;

/** "Much better" outcomes swing ratings this much harder than a normal win. */
export const STRONG_WIN_MULTIPLIER = 1.75;

/** Below this many rated comparisons an item is still finding its level. */
export const PROVISIONAL_COMPARISONS = 5;

/** Provisional items move faster so early rounds converge sooner. */
export const PROVISIONAL_K_MULTIPLIER = 1.5;

export function createRankingState(itemId: string): RankingState {
  return { itemId, rating: INITIAL_RATING, comparisons: 0, wins: 0, losses: 0, skips: 0 };
}

/** Probability that `rating` beats `opponentRating` under the logistic Elo curve. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function kFactorFor(state: RankingState, strong: boolean): number {
  const provisional = state.comparisons < PROVISIONAL_COMPARISONS;
  return (
    BASE_K_FACTOR *
    (provisional ? PROVISIONAL_K_MULTIPLIER : 1) *
    (strong ? STRONG_WIN_MULTIPLIER : 1)
  );
}

export interface ComparisonUpdate {
  left: RankingState;
  right: RankingState;
}

/**
 * Apply one pairwise decision. Pure: the input states are never mutated.
 *
 * A skip records exposure but leaves both ratings alone. Deletion is not an
 * outcome here at all: the caller removes the item and no update is recorded.
 */
export function applyComparison(
  left: RankingState,
  right: RankingState,
  outcome: ComparisonOutcome,
  at: string,
): ComparisonUpdate {
  if (outcome === 'skip') {
    return {
      left: { ...left, skips: left.skips + 1, lastComparedAt: at },
      right: { ...right, skips: right.skips + 1, lastComparedAt: at },
    };
  }

  const leftWon = outcome === 'left' || outcome === 'left_strong';
  const strong = outcome === 'left_strong' || outcome === 'right_strong';

  const leftScore = leftWon ? 1 : 0;
  const expectedLeft = expectedScore(left.rating, right.rating);
  const surprise = leftScore - expectedLeft;

  return {
    left: {
      ...left,
      rating: left.rating + kFactorFor(left, strong) * surprise,
      comparisons: left.comparisons + 1,
      wins: left.wins + (leftWon ? 1 : 0),
      losses: left.losses + (leftWon ? 0 : 1),
      lastComparedAt: at,
    },
    right: {
      ...right,
      rating: right.rating - kFactorFor(right, strong) * surprise,
      comparisons: right.comparisons + 1,
      wins: right.wins + (leftWon ? 0 : 1),
      losses: right.losses + (leftWon ? 1 : 0),
      lastComparedAt: at,
    },
  };
}
