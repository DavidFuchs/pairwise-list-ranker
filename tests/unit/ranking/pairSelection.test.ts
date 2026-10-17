import { describe, expect, it } from 'vitest';

import { createRankingState } from '@/lib/ranking/elo';
import { selectNextPair } from '@/lib/ranking/pairSelection';
import type { RankingStates } from '@/lib/ranking/rebuildRanking';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome, RankingState } from '@/types/ranking';

const LIST_ID = 'list-1';

function item(id: string, overrides: Partial<ListItem> = {}): ListItem {
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

function statesFor(entries: Record<string, Partial<RankingState>>): RankingStates {
  return new Map(
    Object.entries(entries).map(([id, overrides]) => [id, { ...createRankingState(id), ...overrides }]),
  );
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

function pairIds(pair: { leftItemId: string; rightItemId: string } | null): string[] {
  if (!pair) throw new Error('expected a pair');
  return [pair.leftItemId, pair.rightItemId].sort();
}

describe('selectNextPair', () => {
  it('returns nothing when there are no items', () => {
    expect(selectNextPair([], statesFor({}), [])).toBeNull();
  });

  it('returns nothing when only one item can be compared', () => {
    expect(selectNextPair([item('a')], statesFor({ a: {} }), [])).toBeNull();
  });

  it('returns nothing when deleted items leave fewer than two candidates', () => {
    const items = [item('a'), item('b', { active: false })];

    expect(selectNextPair(items, statesFor({ a: {}, b: {} }), [])).toBeNull();
  });

  it('never offers a deleted item', () => {
    const items = [item('a'), item('b'), item('c', { active: false })];
    const states = statesFor({
      a: { comparisons: 10 },
      b: { comparisons: 10 },
      c: { comparisons: 0 },
    });

    expect(pairIds(selectNextPair(items, states, []))).toEqual(['a', 'b']);
  });

  it('never pairs an item with itself', () => {
    const pair = selectNextPair([item('a'), item('b')], statesFor({ a: {}, b: {} }), []);

    expect(pair?.leftItemId).not.toBe(pair?.rightItemId);
  });

  it('prefers a pair that includes the least-compared item', () => {
    const items = [item('a'), item('b'), item('c')];
    const states = statesFor({
      a: { comparisons: 10 },
      b: { comparisons: 10 },
      c: { comparisons: 0 },
    });

    expect(pairIds(selectNextPair(items, states, []))).toContain('c');
  });

  it('prefers close ratings when exposure is equal', () => {
    const items = [item('a'), item('b'), item('c')];
    const states = statesFor({
      a: { comparisons: 10, rating: 1500 },
      b: { comparisons: 10, rating: 1505 },
      c: { comparisons: 10, rating: 1900 },
    });

    expect(pairIds(selectNextPair(items, states, []))).toEqual(['a', 'b']);
  });

  it('counts a skip as exposure so a skipped pair is not offered straight back', () => {
    const items = [item('a'), item('b'), item('c')];
    const states = statesFor({
      a: { comparisons: 4, skips: 1 },
      b: { comparisons: 4, skips: 1 },
      c: { comparisons: 5 },
    });

    expect(pairIds(selectNextPair(items, states, [event('a', 'b', 'skip', 1)]))).not.toEqual(['a', 'b']);
  });

  it('avoids repeating the pair that was just compared', () => {
    const items = [item('a'), item('b'), item('c')];
    const states = statesFor({
      a: { comparisons: 10 },
      b: { comparisons: 10 },
      c: { comparisons: 10 },
    });

    const pair = selectNextPair(items, states, [event('a', 'b', 'left', 1)]);

    expect(pairIds(pair)).not.toEqual(['a', 'b']);
  });

  it('still offers the only possible pair even if it was just compared', () => {
    const items = [item('a'), item('b')];
    const states = statesFor({ a: { comparisons: 10 }, b: { comparisons: 10 } });

    const pair = selectNextPair(items, states, [event('a', 'b', 'left', 1)]);

    expect(pairIds(pair)).toEqual(['a', 'b']);
  });

  it('prefers a pair that has never met over one that has', () => {
    const items = [item('a'), item('b'), item('c'), item('d')];
    const states = statesFor({
      a: { comparisons: 10 },
      b: { comparisons: 10 },
      c: { comparisons: 10 },
      d: { comparisons: 10 },
    });
    const history = [
      event('a', 'b', 'left', 1),
      event('c', 'd', 'left', 2),
      event('a', 'c', 'left', 3),
      event('b', 'd', 'left', 4),
      event('b', 'c', 'left', 5),
    ];

    const pair = selectNextPair(items, states, history);

    expect(pairIds(pair)).toEqual(['a', 'd']);
  });

  it('starts from the top of the list when nothing distinguishes the items', () => {
    // Ids are random uuids in the real app, so ordering must come from the
    // list, not from the id, or the first pair shown would be arbitrary.
    const items = [item('c'), item('a'), item('b')];
    const states = statesFor({ a: {}, b: {}, c: {} });

    const pair = selectNextPair(items, states, []);

    expect([pair?.leftItemId, pair?.rightItemId]).toEqual(['c', 'a']);
  });

  it('is deterministic for the same input', () => {
    const items = [item('a'), item('b'), item('c'), item('d')];
    const states = statesFor({ a: {}, b: {}, c: {}, d: {} });

    const first = selectNextPair(items, states, []);
    const second = selectNextPair(items, states, []);

    expect(first).toEqual(second);
  });

  it('scores the pair it returns', () => {
    const pair = selectNextPair([item('a'), item('b')], statesFor({ a: {}, b: {} }), []);

    expect(pair?.score).toBeGreaterThan(0);
  });
});

describe('adjacent pairs', () => {
  it('prefers an uncompared neighbour over an equally unseen pair further apart', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => item(id));
    const states = statesFor({ a: {}, b: {}, c: {}, d: {} });
    // a-b and c-d are already met, so of the unmet pairs only b-c are neighbours.
    const events = [event('a', 'b', 'left', 1), event('c', 'd', 'left', 2)];

    expect(pairIds(selectNextPair(items, states, events))).toEqual(['b', 'c']);
  });
});
