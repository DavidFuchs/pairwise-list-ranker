import { applyComparison, createRankingState, seedRating } from '@/lib/ranking/elo';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, RankedItem, RankingState } from '@/types/ranking';

/**
 * Ratings this close are treated as tied, so float noise never decides an
 * order; the deterministic tiebreaks below do. Kept to noise on purpose: a
 * placement separates items by a fraction of a point, and that fraction has to
 * count, or an item dropped between two equals would not stay put.
 */
export const RANK_EPSILON = 1e-9;

/** How far past the edge item a placement at the top or bottom of the list goes. */
const EDGE_STEP = 1;

/** The most a tied group is spread to make room for a placement: invisible in the shown whole-number ratings. */
const MAX_SPREAD = 0.25;

export function isPlacement(outcome: ComparisonEvent['outcome']): boolean {
  return outcome === 'place_below' || outcome === 'place_above';
}

export type RankingStates = Map<string, RankingState>;

/** A replay part way through: the ratings so far, and the head-to-head they came with. */
interface Replay {
  states: RankingStates;
  headToHead: HeadToHead;
  arrivalIndex: Map<string, number>;
  /** The latest event time applied, which any event added later must not precede. */
  lastAt: string | undefined;
}

interface ReplayCache {
  alreadyRanked: boolean;
  /** The history as it was passed in, to recognise one with events added to its end. */
  events: ComparisonEvent[];
  replay: Replay;
}

/**
 * The last replay of each items array. A comparison only adds an event, so the
 * next replay can carry on from here instead of starting over; anything else
 * (an undo, an edit, a loaded file) changes the history or the items, and is
 * replayed from the start.
 */
const replayCache = new WeakMap<ListItem[], ReplayCache>();

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
  const cached = replayCache.get(items);
  const added = cached === undefined ? null : addedEvents(cached, events, alreadyRanked);

  let replay: Replay;
  if (cached !== undefined && added !== null) {
    replay = cached.replay;
    for (const event of added) applyEvent(replay, items, event);
  } else {
    replay = startReplay(items, alreadyRanked);
    for (const event of [...events].sort(byEventTime)) applyEvent(replay, items, event);
  }
  replayCache.set(items, { alreadyRanked, events, replay });

  // The cache carries on from its own copy, so the caller's never changes under it.
  return new Map(replay.states);
}

/**
 * The events added to the end of the cached history, in the order they
 * replay, or null when the history changed some other way. An event dated
 * before one already applied would have replayed earlier, so it forces a
 * replay from the start as well.
 */
function addedEvents(
  cached: ReplayCache,
  events: ComparisonEvent[],
  alreadyRanked: boolean,
): ComparisonEvent[] | null {
  if (cached.alreadyRanked !== alreadyRanked || events.length < cached.events.length) return null;
  for (let index = 0; index < cached.events.length; index += 1) {
    if (events[index] !== cached.events[index]) return null;
  }

  const added = events.slice(cached.events.length);
  let lastAt = cached.replay.lastAt;
  for (const event of added) {
    if (lastAt !== undefined && event.createdAt < lastAt) return null;
    lastAt = event.createdAt;
  }
  return added;
}

function startReplay(items: ListItem[], alreadyRanked: boolean): Replay {
  return {
    states: new Map(
      items.map((item, index) => [
        item.id,
        createRankingState(item.id, seedRating(index, items.length, alreadyRanked)),
      ]),
    ),
    headToHead: new Map(),
    arrivalIndex: arrivalIndexOf(items),
    lastAt: undefined,
  };
}

function applyEvent(replay: Replay, items: ListItem[], event: ComparisonEvent): void {
  replay.lastAt = event.createdAt;
  const { states } = replay;
  const left = states.get(event.leftItemId);
  const right = states.get(event.rightItemId);
  if (!left || !right) return;

  if (isPlacement(event.outcome)) {
    applyPlacement(items, replay, event);
  } else {
    const update = applyComparison(left, right, event.outcome, event.createdAt);
    states.set(event.leftItemId, update.left);
    states.set(event.rightItemId, update.right);
  }
  tally(replay.headToHead, event);
}

/**
 * Puts the moved item exactly where it was dropped, in the order as it stood
 * at that moment, by giving it a rating between its new neighbours'. Nothing
 * else moves. Later comparisons start from there, so they can still carry it
 * elsewhere.
 *
 * Neighbours on the same rating - items never compared all sit at 1500 - leave
 * no room between them. Then the tied group is spread across a fraction of a
 * point, keeping its own order, so the moved item has a gap to sit in.
 */
function applyPlacement(items: ListItem[], replay: Replay, event: ComparisonEvent): void {
  const { states } = replay;
  const movedId = event.leftItemId;
  const order = orderActive(items, states, replay.headToHead, replay.arrivalIndex)
    .map((entry) => entry.item.id)
    .filter((id) => id !== movedId);
  const anchor = order.indexOf(event.rightItemId);
  if (anchor < 0) return;

  const at = event.outcome === 'place_below' ? anchor + 1 : anchor;
  const rating = (id: string) => states.get(id)!.rating;
  const setRating = (id: string, value: number) => states.set(id, { ...states.get(id)!, rating: value });
  const aboveId = order[at - 1];
  const belowId = order[at];

  if (aboveId === undefined && belowId === undefined) return;
  if (aboveId === undefined) {
    setRating(movedId, Math.max(rating(movedId), rating(belowId!) + EDGE_STEP));
    return;
  }
  if (belowId === undefined) {
    setRating(movedId, Math.min(rating(movedId), rating(aboveId) - EDGE_STEP));
    return;
  }

  const high = rating(aboveId);
  const low = rating(belowId);
  if (high - low > 4 * RANK_EPSILON) {
    setRating(movedId, (high + low) / 2);
    return;
  }

  // The run of items sharing the neighbours' rating, and the room around it.
  const tied = (index: number) => Math.abs(rating(order[index]!) - high) <= RANK_EPSILON;
  let start = at - 1;
  while (start > 0 && tied(start - 1)) start -= 1;
  let end = at;
  while (end < order.length - 1 && tied(end + 1)) end += 1;
  const roomAbove = start > 0 ? rating(order[start - 1]!) - high : Infinity;
  const roomBelow = end < order.length - 1 ? high - rating(order[end + 1]!) : Infinity;
  const half = Math.min(MAX_SPREAD, roomAbove / 2, roomBelow / 2);

  const run = [...order.slice(start, at), movedId, ...order.slice(at, end + 1)];
  run.forEach((id, index) => setRating(id, high + half - (2 * half * index) / (run.length - 1)));
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
  return orderActive(items, states, buildHeadToHead(events), arrivalIndexOf(items)).map((entry, index) => ({
    rank: index + 1,
    item: entry.item,
    state: entry.state,
  }));
}

/**
 * The order the items arrived in is the user's own order, so it is the last
 * word on ties. Falling back to the item id would sort an unranked list by
 * random UUID, which is not an order anyone chose.
 */
function arrivalIndexOf(items: ListItem[]): Map<string, number> {
  return new Map(items.map((item, index) => [item.id, index]));
}

function orderActive(
  items: ListItem[],
  states: RankingStates,
  headToHead: HeadToHead,
  arrivalIndex: Map<string, number>,
): { item: ListItem; state: RankingState }[] {
  const active = items
    .filter((item) => item.active)
    .map((item) => ({ item, state: states.get(item.id) ?? createRankingState(item.id) }));

  return active.sort((a, b) => {
    const ratingGap = b.state.rating - a.state.rating;
    if (Math.abs(ratingGap) > RANK_EPSILON) return ratingGap;

    const h2h = headToHeadAdvantage(headToHead, a.item.id, b.item.id);
    if (h2h !== 0) return h2h;

    if (b.state.wins !== a.state.wins) return b.state.wins - a.state.wins;

    return (arrivalIndex.get(a.item.id) ?? 0) - (arrivalIndex.get(b.item.id) ?? 0);
  });
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
 * tie - a quick run of choices, or a placement right after one.
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
  for (const event of events) tally(wins, event);
  return wins;
}

/** Counts one event's winner over its loser. A skip has neither. */
function tally(wins: HeadToHead, event: ComparisonEvent): void {
  if (event.outcome === 'skip') return;
  // A placement ranks the item above the one it was placed over, and below
  // the one it was placed under, which is what a tie should then remember.
  const leftWon =
    event.outcome === 'left' || event.outcome === 'left_strong' || event.outcome === 'place_above';
  const winner = leftWon ? event.leftItemId : event.rightItemId;
  const loser = leftWon ? event.rightItemId : event.leftItemId;

  const against = wins.get(winner) ?? new Map<string, number>();
  against.set(loser, (against.get(loser) ?? 0) + 1);
  wins.set(winner, against);
}

/** Negative when `a` leads the head-to-head, positive when `b` does, 0 when even. */
function headToHeadAdvantage(headToHead: HeadToHead, a: string, b: string): number {
  const aWins = headToHead.get(a)?.get(b) ?? 0;
  const bWins = headToHead.get(b)?.get(a) ?? 0;
  return bWins - aWins;
}
