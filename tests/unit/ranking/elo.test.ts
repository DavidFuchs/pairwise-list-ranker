import { describe, expect, it } from 'vitest';

import {
  ALREADY_RANKED_MAX_STEP,
  ALREADY_RANKED_SPREAD,
  BASE_K_FACTOR,
  INITIAL_RATING,
  PROVISIONAL_COMPARISONS,
  applyComparison,
  createRankingState,
  expectedScore,
  seedRating,
} from '@/lib/ranking/elo';
import type { RankingState } from '@/types/ranking';

const AT = '2026-08-15T12:00:00.000Z';

/** A settled item: past the provisional window, so the base K-factor applies. */
function settled(itemId: string, rating: number): RankingState {
  return {
    itemId,
    rating,
    comparisons: PROVISIONAL_COMPARISONS + 5,
    wins: 0,
    losses: 0,
    skips: 0,
  };
}

describe('createRankingState', () => {
  it('starts an item at the initial rating with no history', () => {
    const state = createRankingState('item-1');

    expect(state).toEqual({
      itemId: 'item-1',
      rating: INITIAL_RATING,
      comparisons: 0,
      wins: 0,
      losses: 0,
      skips: 0,
    });
  });
});

describe('createRankingState', () => {
  it('accepts a seed rating that overrides the initial rating', () => {
    expect(createRankingState('item-1', 1800).rating).toBe(1800);
  });
});

describe('seedRating', () => {
  it('is the initial rating when the list is not marked as already ranked', () => {
    expect(seedRating(0, 5, false)).toBe(INITIAL_RATING);
    expect(seedRating(4, 5, false)).toBe(INITIAL_RATING);
  });

  it('is the initial rating for a list too short to have a gradient', () => {
    expect(seedRating(0, 1, true)).toBe(INITIAL_RATING);
    expect(seedRating(0, 0, true)).toBe(INITIAL_RATING);
  });

  it('puts the first item at the top of the spread and the last at the bottom once the list is long enough to use the full spread', () => {
    expect(seedRating(0, 15, true)).toBe(INITIAL_RATING + ALREADY_RANKED_SPREAD);
    expect(seedRating(14, 15, true)).toBe(INITIAL_RATING - ALREADY_RANKED_SPREAD);
  });

  it('centers the middle item of an odd-length list on the initial rating', () => {
    expect(seedRating(2, 5, true)).toBe(INITIAL_RATING);
  });

  it('caps the adjacent-item gap for short lists instead of squeezing the full spread into them', () => {
    expect(seedRating(0, 3, true)).toBe(INITIAL_RATING + ALREADY_RANKED_MAX_STEP);
    expect(seedRating(1, 3, true)).toBe(INITIAL_RATING);
    expect(seedRating(2, 3, true)).toBe(INITIAL_RATING - ALREADY_RANKED_MAX_STEP);
  });

  it('spaces the two items of a pair one capped step apart', () => {
    expect(seedRating(0, 2, true)).toBe(INITIAL_RATING + ALREADY_RANKED_MAX_STEP / 2);
    expect(seedRating(1, 2, true)).toBe(INITIAL_RATING - ALREADY_RANKED_MAX_STEP / 2);
  });
});

/**
 * The gap a capped seed leaves between adjacent items. Every already-ranked
 * list short enough for ALREADY_RANKED_MAX_STEP to bind starts its neighbours
 * exactly this far apart, so it is the gap the reorder invariants below are
 * stated against.
 */
const SEEDED_GAP = seedRating(0, 3, true) - seedRating(1, 3, true);

/**
 * Whether one upset by the lower-seeded half of an adjacent pair is enough to
 * put it above its neighbour. Both items move, so the gap closes by twice each
 * item's swing.
 */
function upsetFlipsSeededPair(
  make: (itemId: string, rating: number) => RankingState,
  strong: boolean,
): boolean {
  const top = make('top', INITIAL_RATING + SEEDED_GAP / 2);
  const bottom = make('bottom', INITIAL_RATING - SEEDED_GAP / 2);

  const update = applyComparison(top, bottom, strong ? 'right_strong' : 'right', AT);
  return update.right.rating > update.left.rating;
}

/**
 * What ALREADY_RANKED_MAX_STEP is chosen to buy. A seeded order has to yield
 * to the strongest thing the user can say about a pair and hold against the
 * ordinary one, or the claim it encodes is either unshakeable or worthless.
 * Both halves have to survive an item settling, because that is when the user
 * is fine-tuning near-neighbours. Together these pin the step into a narrow
 * band; they fail if a K-factor is retuned without revisiting the seed.
 */
describe('seedRating reorder invariants', () => {
  it('lets one "much better" upset reorder adjacent seeded neighbours while they are provisional', () => {
    expect(upsetFlipsSeededPair(createRankingState, true)).toBe(true);
  });

  it('holds adjacent seeded neighbours against a normal win while they are provisional', () => {
    expect(upsetFlipsSeededPair(createRankingState, false)).toBe(false);
  });

  it('still lets one "much better" upset reorder adjacent seeded neighbours once they settle', () => {
    expect(upsetFlipsSeededPair(settled, true)).toBe(true);
  });

  it('holds adjacent seeded neighbours against a normal win once they settle', () => {
    expect(upsetFlipsSeededPair(settled, false)).toBe(false);
  });
});

describe('expectedScore', () => {
  it('is even between equally rated items', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
  });

  it('favors the higher-rated item', () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1300, 1500)).toBeLessThan(0.5);
  });

  it('gives both sides scores that sum to one', () => {
    expect(expectedScore(1720, 1480) + expectedScore(1480, 1720)).toBeCloseTo(1, 10);
  });
});

describe('applyComparison', () => {
  it('moves an even matchup by half the K-factor when the left item wins', () => {
    const result = applyComparison(settled('a', 1500), settled('b', 1500), 'left', AT);

    expect(result.left.rating).toBeCloseTo(1500 + BASE_K_FACTOR / 2, 10);
    expect(result.right.rating).toBeCloseTo(1500 - BASE_K_FACTOR / 2, 10);
  });

  it('moves the right item up when the right item wins', () => {
    const result = applyComparison(settled('a', 1500), settled('b', 1500), 'right', AT);

    expect(result.right.rating).toBeGreaterThan(1500);
    expect(result.left.rating).toBeLessThan(1500);
  });

  it('conserves total rating between equally settled items', () => {
    const result = applyComparison(settled('a', 1620), settled('b', 1430), 'right', AT);

    expect(result.left.rating + result.right.rating).toBeCloseTo(1620 + 1430, 10);
  });

  it('moves ratings further for a much-better win than a normal win', () => {
    const normal = applyComparison(settled('a', 1500), settled('b', 1500), 'left', AT);
    const strong = applyComparison(settled('a', 1500), settled('b', 1500), 'left_strong', AT);

    expect(strong.left.rating).toBeGreaterThan(normal.left.rating);
    expect(strong.right.rating).toBeLessThan(normal.right.rating);
  });

  it('treats a much-better right win as a right win with a bigger swing', () => {
    const normal = applyComparison(settled('a', 1500), settled('b', 1500), 'right', AT);
    const strong = applyComparison(settled('a', 1500), settled('b', 1500), 'right_strong', AT);

    expect(strong.right.rating).toBeGreaterThan(normal.right.rating);
  });

  it('moves ratings further on an upset than on an expected win', () => {
    const upset = applyComparison(settled('a', 1300), settled('b', 1700), 'left', AT);
    const expected = applyComparison(settled('a', 1700), settled('b', 1300), 'left', AT);

    const upsetGain = upset.left.rating - 1300;
    const expectedGain = expected.left.rating - 1700;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it('moves a provisional item further than a settled one for the same result', () => {
    const provisional = applyComparison(
      { ...settled('a', 1500), comparisons: 0 },
      settled('b', 1500),
      'left',
      AT,
    );
    const seasoned = applyComparison(settled('a', 1500), settled('b', 1500), 'left', AT);

    expect(provisional.left.rating).toBeGreaterThan(seasoned.left.rating);
  });

  it('records the win, the loss, and the comparison counts', () => {
    const result = applyComparison(settled('a', 1500), settled('b', 1500), 'left', AT);

    expect(result.left.wins).toBe(1);
    expect(result.left.losses).toBe(0);
    expect(result.right.losses).toBe(1);
    expect(result.left.comparisons).toBe(PROVISIONAL_COMPARISONS + 6);
    expect(result.right.comparisons).toBe(PROVISIONAL_COMPARISONS + 6);
  });

  it('stamps both items with the comparison time', () => {
    const result = applyComparison(settled('a', 1500), settled('b', 1500), 'left', AT);

    expect(result.left.lastComparedAt).toBe(AT);
    expect(result.right.lastComparedAt).toBe(AT);
  });

  it('leaves ratings untouched on a skip', () => {
    const result = applyComparison(settled('a', 1600), settled('b', 1400), 'skip', AT);

    expect(result.left.rating).toBe(1600);
    expect(result.right.rating).toBe(1400);
  });

  it('counts a skip as a skip rather than a comparison', () => {
    const left = settled('a', 1500);
    const result = applyComparison(left, settled('b', 1500), 'skip', AT);

    expect(result.left.skips).toBe(1);
    expect(result.left.comparisons).toBe(left.comparisons);
    expect(result.left.wins).toBe(0);
    expect(result.left.losses).toBe(0);
  });

  it('does not mutate the states it was given', () => {
    const left = settled('a', 1500);
    const right = settled('b', 1500);

    applyComparison(left, right, 'left_strong', AT);

    expect(left).toEqual(settled('a', 1500));
    expect(right).toEqual(settled('b', 1500));
  });
});
