import { describe, expect, it } from 'vitest';

import { replayComparisons } from '@/lib/ranking/rebuildRanking';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome } from '@/types/ranking';

const OUTCOMES: ComparisonOutcome[] = [
  'left',
  'right',
  'left_strong',
  'right_strong',
  'skip',
  'place_below',
  'place_above',
];

function makeItems(count: number): ListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    listId: 'list',
    value: `Item ${index}`,
    // A removed item still takes part in the history.
    active: index !== 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
}

/** A seeded history: every outcome, shared timestamps, and one unknown item. */
function makeHistory(count: number, items: number, seed = 11): ComparisonEvent[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return Array.from({ length: count }, (_, index) => {
    const left = Math.floor(next() * items);
    const right = (left + 1 + Math.floor(next() * (items - 1))) % items;
    return {
      id: `event-${index}`,
      listId: 'list',
      leftItemId: index === 7 ? 'gone' : `item-${left}`,
      rightItemId: `item-${right}`,
      outcome: OUTCOMES[Math.floor(next() * OUTCOMES.length)]!,
      // Pairs of events share a millisecond, as a quick run of choices does.
      createdAt: new Date(Date.UTC(2026, 0, 1) + Math.floor(index / 2)).toISOString(),
    };
  });
}

/** A replay with nothing cached: a fresh items array is never a cache hit. */
function fresh(items: ListItem[], events: ComparisonEvent[], alreadyRanked = false) {
  return replayComparisons([...items], events, alreadyRanked);
}

describe('incremental replay', () => {
  it('matches a fresh replay after every event, one click at a time', () => {
    const items = makeItems(12);
    const history = makeHistory(120, 12);
    for (let length = 0; length <= history.length; length += 1) {
      const events = history.slice(0, length);
      expect(replayComparisons(items, events), `after ${length}`).toEqual(fresh(items, events));
    }
  });

  it('matches a fresh replay when several events arrive at once', () => {
    const items = makeItems(12);
    const history = makeHistory(90, 12, 5);
    for (const length of [10, 13, 40, 41, 90]) {
      const events = history.slice(0, length);
      expect(replayComparisons(items, events, true), `after ${length}`).toEqual(fresh(items, events, true));
    }
  });

  it('replays from the start after an undo', () => {
    const items = makeItems(8);
    const history = makeHistory(40, 8);
    replayComparisons(items, history);

    const undone = history.slice(0, 39);
    expect(replayComparisons(items, undone)).toEqual(fresh(items, undone));
  });

  it('replays from the start when an event is dated before the last one applied', () => {
    const items = makeItems(8);
    const history = makeHistory(30, 8);
    replayComparisons(items, history);

    const early = [...history, { ...history[2]!, id: 'late-arrival', outcome: 'right' as const }];
    expect(replayComparisons(items, early)).toEqual(fresh(items, early));
  });

  it('replays from the start when the order is declared ranked', () => {
    const items = makeItems(8);
    const history = makeHistory(30, 8);
    replayComparisons(items, history, false);

    expect(replayComparisons(items, history, true)).toEqual(fresh(items, history, true));
  });

  it('never changes ratings it has already handed out', () => {
    const items = makeItems(8);
    const history = makeHistory(30, 8);
    const before = replayComparisons(items, history.slice(0, 20));
    const snapshot = new Map(before);

    replayComparisons(items, history);

    expect(before).toEqual(snapshot);
  });
});
