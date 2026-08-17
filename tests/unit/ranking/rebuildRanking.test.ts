import { describe, expect, it } from 'vitest';

import { ALREADY_RANKED_SPREAD, INITIAL_RATING, createRankingState } from '@/lib/ranking/elo';
import { rankItems, rebuildRanking, replayComparisons } from '@/lib/ranking/rebuildRanking';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome, RankingState } from '@/types/ranking';

const LIST_ID = 'list-1';

function item(id: string, overrides: Partial<ListItem> = {}): ListItem {
  // 'a' was created first, then 'b', then 'c'.
  const order = id.charCodeAt(id.length - 1) - 'a'.charCodeAt(0);
  const createdAt = `2026-08-15T12:00:${String(order).padStart(2, '0')}.000Z`;
  return {
    id,
    listId: LIST_ID,
    value: `Item ${id}`,
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function event(
  leftItemId: string,
  rightItemId: string,
  outcome: ComparisonOutcome,
  seconds: number,
): ComparisonEvent {
  return {
    id: `event-${seconds}`,
    listId: LIST_ID,
    leftItemId,
    rightItemId,
    outcome,
    createdAt: `2026-08-15T13:00:${String(seconds).padStart(2, '0')}.000Z`,
  };
}

function ids(ranked: { item: ListItem }[]): string[] {
  return ranked.map((entry) => entry.item.id);
}

describe('rebuildRanking', () => {
  it('ranks every item in creation order when there is no history', () => {
    const ranked = rebuildRanking([item('a'), item('b'), item('c')], []);

    expect(ids(ranked)).toEqual(['a', 'b', 'c']);
    expect(ranked.every((entry) => entry.state.rating === INITIAL_RATING)).toBe(true);
  });

  it('numbers ranks from one without gaps', () => {
    const ranked = rebuildRanking([item('a'), item('b'), item('c')], []);

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('puts the winner of a comparison above the loser', () => {
    const ranked = rebuildRanking(
      [item('a'), item('b')],
      [event('a', 'b', 'right', 1)],
    );

    expect(ids(ranked)).toEqual(['b', 'a']);
  });

  it('replays events in timestamp order rather than array order', () => {
    const items = [item('a'), item('b'), item('c')];
    const cycle = [
      event('a', 'b', 'left', 1),
      event('b', 'c', 'left', 2),
      event('c', 'a', 'left', 3),
    ];

    const inOrder = rebuildRanking(items, cycle);
    const shuffled = rebuildRanking(items, [cycle[2]!, cycle[0]!, cycle[1]!]);

    expect(shuffled).toEqual(inOrder);
  });

  it('leaves the order unchanged when a pair is skipped', () => {
    const items = [item('a'), item('b')];

    const ranked = rebuildRanking(items, [event('a', 'b', 'skip', 1)]);

    expect(ids(ranked)).toEqual(['a', 'b']);
    expect(ranked.every((entry) => entry.state.rating === INITIAL_RATING)).toBe(true);
  });

  it('records a skip as exposure without a win or loss', () => {
    const ranked = rebuildRanking([item('a'), item('b')], [event('a', 'b', 'skip', 1)]);

    expect(ranked[0]?.state.skips).toBe(1);
    expect(ranked[0]?.state.comparisons).toBe(0);
  });

  it('drops deleted items from the ranking', () => {
    const ranked = rebuildRanking([item('a'), item('b', { active: false }), item('c')], []);

    expect(ids(ranked)).toEqual(['a', 'c']);
  });

  it('keeps the rating a survivor earned against an item that was later deleted', () => {
    const ranked = rebuildRanking(
      [item('a'), item('b', { active: false })],
      [event('a', 'b', 'left', 1)],
    );

    expect(ids(ranked)).toEqual(['a']);
    expect(ranked[0]?.state.rating).toBeGreaterThan(INITIAL_RATING);
    expect(ranked[0]?.state.wins).toBe(1);
  });

  it('lets a run of comparisons overturn the seeded order of an already-ranked list', () => {
    const items = [item('a'), item('b')];
    const oneEvent = [event('a', 'b', 'right', 1)];
    const manyEvents = Array.from({ length: 14 }, (_, i) => event('a', 'b', 'right', i + 1));

    // A single upset against the seeded gap is not enough to flip the order...
    expect(ids(rebuildRanking(items, oneEvent, true))).toEqual(['a', 'b']);
    // ...but a sustained run of them is.
    expect(ids(rebuildRanking(items, manyEvents, true))).toEqual(['b', 'a']);
  });

  it('ignores events that reference items the list no longer has', () => {
    const ranked = rebuildRanking(
      [item('a'), item('b')],
      [event('a', 'ghost', 'right', 1), event('a', 'b', 'left', 2)],
    );

    expect(ids(ranked)).toEqual(['a', 'b']);
    expect(ranked[0]?.state.comparisons).toBe(1);
  });
});

describe('replayComparisons', () => {
  it('returns a state for every item, including deleted ones', () => {
    const states = replayComparisons([item('a'), item('b', { active: false })], []);

    expect([...states.keys()].sort()).toEqual(['a', 'b']);
  });

  it('seeds ratings flat by default even with a defined order', () => {
    const states = replayComparisons([item('a'), item('b'), item('c')], []);

    expect(states.get('a')?.rating).toBe(INITIAL_RATING);
    expect(states.get('c')?.rating).toBe(INITIAL_RATING);
  });

  it('seeds ratings from item order when the list is already ranked', () => {
    const states = replayComparisons([item('a'), item('b'), item('c')], [], true);

    expect(states.get('a')?.rating).toBe(INITIAL_RATING + ALREADY_RANKED_SPREAD);
    expect(states.get('b')?.rating).toBe(INITIAL_RATING);
    expect(states.get('c')?.rating).toBe(INITIAL_RATING - ALREADY_RANKED_SPREAD);
  });
});

describe('rankItems tiebreaks', () => {
  function stateWith(itemId: string, overrides: Partial<RankingState> = {}): RankingState {
    return { ...createRankingState(itemId), ...overrides };
  }

  it('breaks a rating tie with the head-to-head result', () => {
    const items = [item('a'), item('b')];
    const states = new Map([
      ['a', stateWith('a', { rating: 1500, wins: 1, losses: 1, comparisons: 2 })],
      ['b', stateWith('b', { rating: 1500, wins: 1, losses: 1, comparisons: 2 })],
    ]);

    const ranked = rankItems(items, states, [event('a', 'b', 'right', 1)]);

    expect(ids(ranked)).toEqual(['b', 'a']);
  });

  it('breaks a rating tie on total wins when the pair never met', () => {
    const items = [item('a'), item('b')];
    const states = new Map([
      ['a', stateWith('a', { rating: 1500, wins: 1, comparisons: 3 })],
      ['b', stateWith('b', { rating: 1500, wins: 2, comparisons: 3 })],
    ]);

    const ranked = rankItems(items, states, []);

    expect(ids(ranked)).toEqual(['b', 'a']);
  });

  /**
   * Every item of one import is created in the same millisecond, so `createdAt`
   * cannot break these ties and the old id fallback amounted to sorting by
   * random UUID. The order the items arrived in is the user's own order.
   */
  it('falls back to the order the items arrived in', () => {
    const items = [item('b'), item('a')];
    const states = new Map([
      ['a', stateWith('a')],
      ['b', stateWith('b')],
    ]);

    const ranked = rankItems(items, states, []);

    expect(ids(ranked)).toEqual(['b', 'a']);
  });
});

describe('the order items arrived in', () => {
  function unranked(labels: string[]): ListItem[] {
    // Ids deliberately descend so a sort by id would reverse the list.
    return labels.map((label, index) => ({
      id: `zz-${labels.length - index}`,
      listId: 'list-1',
      value: label,
      active: true,
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    }));
  }

  it('shows an unranked list in the order it was imported', () => {
    const items = unranked(['Tacos', 'Ramen', 'Curry']);

    expect(rebuildRanking(items, []).map((entry) => entry.item.value)).toEqual([
      'Tacos',
      'Ramen',
      'Curry',
    ]);
  });

  it('does not fall back to sorting by id', () => {
    const items = unranked(['Tacos', 'Ramen', 'Curry']);
    const byId = [...items].sort((a, b) => (a.id < b.id ? -1 : 1)).map((item) => item.value);

    expect(rebuildRanking(items, []).map((entry) => entry.item.value)).not.toEqual(byId);
  });

  it('still lets a won comparison beat arrival order', () => {
    const items = unranked(['Tacos', 'Ramen']);
    const events = [
      {
        id: 'event-1',
        listId: 'list-1',
        leftItemId: items[0]!.id,
        rightItemId: items[1]!.id,
        outcome: 'right' as const,
        createdAt: '2026-08-16T00:00:01.000Z',
      },
    ];

    expect(rebuildRanking(items, events)[0]?.item.value).toBe('Ramen');
  });
});
