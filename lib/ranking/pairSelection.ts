import { PROVISIONAL_COMPARISONS, createRankingState } from '@/lib/ranking/elo';
import type { RankingStates } from '@/lib/ranking/rebuildRanking';
import type { ListItem } from '@/types/list';
import type { CandidatePair, ComparisonEvent, RankingState } from '@/types/ranking';

/** Rating gap, in points, at which two items stop looking like near-neighbors. */
export const PROXIMITY_SCALE = 200;

export const PROXIMITY_WEIGHT = 1;
export const EXPOSURE_WEIGHT = 1.2;
export const UNCERTAINTY_WEIGHT = 0.5;

/**
 * Reward for two items that sit next to each other in the current order and
 * have never been compared. Those are the pairs whose answer can still change
 * the ranking, so they are asked before near-ties further apart.
 */
export const ADJACENT_BONUS = 0.4;

/** Penalty for a pair the user has already seen, strongest when it was the last one. */
export const REPEAT_PENALTY = 1.5;

/** Smaller standing penalty so unseen pairs win over long-ago repeats. */
export const ALREADY_MET_PENALTY = 0.15;

/**
 * Each item is only matched against this many rating-neighbors, which keeps
 * selection linear-ish on large lists instead of scanning every pair.
 */
export const NEIGHBOR_WINDOW = 32;

/**
 * Choose the most informative next pair, or null when fewer than two items are
 * active. Deterministic: no randomness, so the same workspace always offers the
 * same next comparison.
 */
export function selectNextPair(
  items: ListItem[],
  states: RankingStates,
  events: ComparisonEvent[],
): CandidatePair | null {
  // Ties are broken by position in the list, never by id: ids are random uuids,
  // so an id-ordered pool would offer an arbitrary first pair.
  const pool = items
    .filter((item) => item.active)
    .map((item, index) => ({
      state: states.get(item.id) ?? createRankingState(item.id),
      index,
    }))
    .sort(byRatingThenPosition)
    .map((entry) => entry.state);

  if (pool.length < 2) return null;

  const history = summarizeHistory(events);

  let best: CandidatePair | null = null;

  for (let i = 0; i < pool.length; i += 1) {
    const limit = Math.min(pool.length, i + 1 + NEIGHBOR_WINDOW);
    for (let j = i + 1; j < limit; j += 1) {
      const left = pool[i]!;
      const right = pool[j]!;
      let score = scorePair(left, right, history);
      if (j === i + 1 && !history.meetings.has(pairKey(left.itemId, right.itemId))) {
        score += ADJACENT_BONUS;
      }
      if (best === null || score > best.score) {
        best = { leftItemId: left.itemId, rightItemId: right.itemId, score };
      }
    }
  }

  return best;
}

export interface PairHistory {
  /** How many times each unordered pair has been shown. */
  meetings: Map<string, number>;
  /** How many comparisons have happened since each pair was last shown. */
  eventsSinceLastMeeting: Map<string, number>;
}

export function summarizeHistory(events: ComparisonEvent[]): PairHistory {
  const meetings = new Map<string, number>();
  const lastSeenIndex = new Map<string, number>();

  events.forEach((event, index) => {
    const key = pairKey(event.leftItemId, event.rightItemId);
    meetings.set(key, (meetings.get(key) ?? 0) + 1);
    lastSeenIndex.set(key, index);
  });

  const eventsSinceLastMeeting = new Map<string, number>();
  for (const [key, index] of lastSeenIndex) {
    eventsSinceLastMeeting.set(key, events.length - 1 - index);
  }

  return { meetings, eventsSinceLastMeeting };
}

/**
 * Higher is better. Rewards near-equal ratings, under-compared items, and items
 * whose rating is still provisional; penalizes pairs the user has already seen.
 */
export function scorePair(left: RankingState, right: RankingState, history: PairHistory): number {
  const proximity = Math.exp(-Math.abs(left.rating - right.rating) / PROXIMITY_SCALE);
  const exposure = (exposureNeed(left) + exposureNeed(right)) / 2;
  const uncertainty = (provisionalWeight(left) + provisionalWeight(right)) / 2;

  const key = pairKey(left.itemId, right.itemId);
  const met = history.meetings.get(key) ?? 0;
  const since = history.eventsSinceLastMeeting.get(key);
  const repeat =
    met === 0 ? 0 : ALREADY_MET_PENALTY + REPEAT_PENALTY / (1 + (since ?? Number.MAX_SAFE_INTEGER));

  return (
    PROXIMITY_WEIGHT * proximity + EXPOSURE_WEIGHT * exposure + UNCERTAINTY_WEIGHT * uncertainty - repeat
  );
}

/** Skips count as exposure: the user has already looked at that item. */
function exposureNeed(state: RankingState): number {
  return 1 / (1 + state.comparisons + state.skips);
}

function provisionalWeight(state: RankingState): number {
  return state.comparisons < PROVISIONAL_COMPARISONS ? 1 : 0;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

interface PoolEntry {
  state: RankingState;
  index: number;
}

function byRatingThenPosition(a: PoolEntry, b: PoolEntry): number {
  if (a.state.rating !== b.state.rating) return b.state.rating - a.state.rating;
  return a.index - b.index;
}
