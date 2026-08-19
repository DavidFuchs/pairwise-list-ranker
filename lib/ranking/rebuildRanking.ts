import { applyComparison, createRankingState, seedRating } from '@/lib/ranking/elo';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, RankedItem, RankingState } from '@/types/ranking';

/**
 * Ratings this close are treated as tied, so items that display the same rating
 * are ordered by the deterministic tiebreaks below rather than by float noise.
 */
export const RANK_EPSILON = 0.5;

export type RankingStates = Map<string, RankingState>;

/**
 * Replay the comparison history over every known item, deleted ones included:
 * a survivor keeps the rating it earned against an item that was later removed.
 * Events referencing unknown items are ignored so malformed saved data cannot
 * corrupt the rebuild.
 */
export function replayComparisons(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked = false,
): RankingStates {
  const states: RankingStates = new Map(
    items.map((item, index) => [
      item.id,
      createRankingState(item.id, seedRating(index, items.length, alreadyRanked)),
    ]),
  );

  const ordered = [...events].sort(byEventTime);

  for (const event of ordered) {
    const left = states.get(event.leftItemId);
    const right = states.get(event.rightItemId);
    if (!left || !right) continue;

    const update = applyComparison(left, right, event.outcome, event.createdAt);
    states.set(event.leftItemId, update.left);
    states.set(event.rightItemId, update.right);
  }

  return states;
}

/**
 * Order the active items. Tie order follows ARCHITECTURE.md section 6.4:
 * rating, then head-to-head, then wins, then creation order.
 */
export function rankItems(
  items: ListItem[],
  states: RankingStates,
  events: ComparisonEvent[],
): RankedItem<ListItem>[] {
  const headToHead = buildHeadToHead(events);

  // The order the items arrived in is the user's own order, so it is the last
  // word on ties. Falling back to the item id would sort an unranked list by
  // random UUID, which is not an order anyone chose.
  const arrivalIndex = new Map(items.map((item, index) => [item.id, index]));

  const active = items
    .filter((item) => item.active)
    .map((item) => ({ item, state: states.get(item.id) ?? createRankingState(item.id) }));

  const sorted = active.sort((a, b) => {
    const ratingGap = b.state.rating - a.state.rating;
    if (Math.abs(ratingGap) > RANK_EPSILON) return ratingGap;

    const h2h = headToHeadAdvantage(headToHead, a.item.id, b.item.id);
    if (h2h !== 0) return h2h;

    if (b.state.wins !== a.state.wins) return b.state.wins - a.state.wins;

    return (arrivalIndex.get(a.item.id) ?? 0) - (arrivalIndex.get(b.item.id) ?? 0);
  });

  return sorted.map((entry, index) => ({ rank: index + 1, item: entry.item, state: entry.state }));
}

/** The displayed ranking: replay history, then order the surviving items. */
export function rebuildRanking(
  items: ListItem[],
  events: ComparisonEvent[],
  alreadyRanked = false,
): RankedItem<ListItem>[] {
  return rankItems(items, replayComparisons(items, events, alreadyRanked), events);
}

/**
 * Timestamps are only millisecond-resolution, so events recorded in one tick
 * tie - a hand reorder always records its two neighbour comparisons together.
 * The sort is stable, so ties keep the order the events were appended in, which
 * is the order they happened. Falling back to the event id would sort those by
 * random UUID instead, and Elo is order-dependent: replaying a reorder
 * backwards moves the item roughly 1.4 points the wrong way, enough to carry it
 * past an item nobody compared.
 */
function byEventTime(a: ComparisonEvent, b: ComparisonEvent): number {
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? -1 : 1;
}

/** `wins.get(winnerId)` holds every item that winner has beaten. */
type HeadToHead = Map<string, Map<string, number>>;

function buildHeadToHead(events: ComparisonEvent[]): HeadToHead {
  const wins: HeadToHead = new Map();

  for (const event of events) {
    if (event.outcome === 'skip') continue;
    const leftWon = event.outcome === 'left' || event.outcome === 'left_strong';
    const winner = leftWon ? event.leftItemId : event.rightItemId;
    const loser = leftWon ? event.rightItemId : event.leftItemId;

    const against = wins.get(winner) ?? new Map<string, number>();
    against.set(loser, (against.get(loser) ?? 0) + 1);
    wins.set(winner, against);
  }

  return wins;
}

/** Negative when `a` leads the head-to-head, positive when `b` does, 0 when even. */
function headToHeadAdvantage(headToHead: HeadToHead, a: string, b: string): number {
  const aWins = headToHead.get(a)?.get(b) ?? 0;
  const bWins = headToHead.get(b)?.get(a) ?? 0;
  return bWins - aWins;
}
