import { describe, expect, it } from 'vitest';

import { describeProgress, levelFor, selectProgressState } from '@/lib/state/progress';
import { rankedList, recorded } from '@/tests/helpers/snapshots';
import type { RankingEvent } from '@/types/rankingEvents';

const NOW = '2026-08-16T00:00:00.000Z';

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `i${i + 1}`);
}

/** Pair answers covering the items two at a time, in order. */
function answers(items: string[], upTo = items.length): RankingEvent[] {
  const events: RankingEvent[] = [];
  for (let i = 0; i < upTo; i += 2) {
    events.push({
      id: `e${i}`,
      listId: 'movies-1',
      createdAt: NOW,
      kind: 'pair',
      leftItemId: items[i]!,
      // An odd list pairs its last item with the first.
      rightItemId: items[(i + 1) % items.length]!,
      outcome: 'left',
    });
  }
  return events;
}

function listOf(n: number, over: Partial<ReturnType<typeof rankedList>> = {}) {
  const items = ids(n);
  return { shown: items, list: rankedList({ originalItemIds: items, events: [], ...over }) };
}

describe('selectProgressState', () => {
  it('says nothing about a list of one', () => {
    const { shown, list } = listOf(1);
    expect(selectProgressState(list, shown, 0.1)).toEqual({ kind: 'none' });
  });

  it('counts the items that have not been in an answered pair', () => {
    const { shown, list } = listOf(30);
    const events = recorded(answers(shown, 20));
    expect(selectProgressState({ ...list, events }, shown, 0.1)).toEqual({
      kind: 'comparing',
      uncompared: 10,
      total: 30,
    });
  });

  it('counts an item only when it was in a pair, not when it was moved or marked', () => {
    const { shown, list } = listOf(4);
    const events = recorded([
      ...answers(shown, 2),
      { id: 'p', listId: 'movies-1', createdAt: NOW, kind: 'placement', itemId: 'i3', aboveItemId: 'i1' },
    ]);
    expect(selectProgressState({ ...list, events }, shown, 0.1)).toMatchObject({
      kind: 'comparing',
      uncompared: 2,
    });
  });

  it('reads a level once every item has been compared', () => {
    const { shown, list } = listOf(30);
    const events = recorded(answers(shown));
    expect(selectProgressState({ ...list, events }, shown, 0.05)).toEqual({
      kind: 'level',
      disorder: 0.05,
      items: 30,
    });
  });

  it('says it cannot tell for a list that started ranked, whatever the disorder', () => {
    const { shown, list } = listOf(40, { initialStartingOrder: 'ranked' });
    const events = recorded(answers(shown));
    expect(selectProgressState({ ...list, events }, shown, 0.01)).toEqual({ kind: 'ranked-start' });
    expect(selectProgressState({ ...list, events }, shown, null)).toEqual({ kind: 'ranked-start' });
  });

  it('still counts the uncompared items of a list that started ranked', () => {
    const { shown, list } = listOf(40, { initialStartingOrder: 'ranked' });
    expect(selectProgressState(list, shown, 0.01)).toMatchObject({ kind: 'comparing' });
  });

  it('reads a level for a short list too', () => {
    const { shown, list } = listOf(10);
    const events = recorded(answers(shown));
    expect(selectProgressState({ ...list, events }, shown, 0.01)).toEqual({
      kind: 'level',
      disorder: 0.01,
      items: 10,
    });
  });

  it('says nothing yet when the engine has not given a disorder', () => {
    const { shown, list } = listOf(40);
    const events = recorded(answers(shown));
    expect(selectProgressState({ ...list, events }, shown, null)).toEqual({ kind: 'none' });
  });

  it('treats a rough start, such as a list sorted by a field, like an unordered one', () => {
    const { shown, list } = listOf(40, { initialStartingOrder: 'rough' });
    const events = recorded(answers(shown));
    expect(selectProgressState({ ...list, events }, shown, 0.05)).toMatchObject({ kind: 'level' });
  });
});

describe('describeProgress', () => {
  it('says what cannot be told yet, with the count', () => {
    expect(describeProgress({ kind: 'comparing', uncompared: 38, total: 120 }, null)).toEqual({
      text: "Can't tell how close you are yet. 38 of 120 items haven't been compared.",
      bar: 'coverage',
      share: 82 / 120,
    });
  });

  it('uses the singular for one item left', () => {
    expect(describeProgress({ kind: 'comparing', uncompared: 1, total: 1200 }, null)?.text).toBe(
      "Can't tell how close you are yet. 1 of 1,200 items hasn't been compared.",
    );
  });

  it('words each level and fills that many quarters of the bar', () => {
    const state = { kind: 'level', disorder: 0, items: 60 } as const;
    expect(describeProgress(state, 0)).toEqual({ text: 'Rough order so far.', bar: 'level', share: 0.25 });
    expect(describeProgress(state, 1)).toEqual({ text: 'Taking shape.', bar: 'level', share: 0.5 });
    expect(describeProgress(state, 2)).toEqual({
      text: 'Close. Mostly fine adjustments left.',
      bar: 'level',
      share: 0.75,
    });
    expect(describeProgress(state, 3)).toEqual({
      text: 'Changes from here should be small.',
      bar: 'level',
      share: 1,
    });
  });

  it('says why it cannot tell for a list that started ranked', () => {
    expect(describeProgress({ kind: 'ranked-start' }, null)).toEqual({
      text: 'Every item has been compared. Keep going to fix your order where answers disagree.',
      bar: 'coverage',
      share: 1,
    });
  });

  it('is nothing for no state', () => {
    expect(describeProgress({ kind: 'none' }, null)).toBeNull();
  });
});

describe('levelFor', () => {
  it('is a level only for a level state, and keeps one through a small slip', () => {
    expect(levelFor({ kind: 'none' }, null)).toBeNull();
    expect(levelFor({ kind: 'comparing', uncompared: 3, total: 9 }, 2)).toBeNull();
    expect(levelFor({ kind: 'level', disorder: 0.021, items: 60 }, 3)).toBe(3);
    expect(levelFor({ kind: 'level', disorder: 0.05, items: 60 }, null)).toBe(1);
  });
});
