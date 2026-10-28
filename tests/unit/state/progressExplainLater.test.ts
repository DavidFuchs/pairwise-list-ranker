import { describe, expect, it, vi } from 'vitest';

import { MAX_SHOWINGS_SPLIT } from '@/lib/ranking/bt/constants';
import { replay } from '@/lib/ranking/bt/engine';
import { disorderOfState, levelOf } from '@/lib/ranking/bt/progress';
import { selectProgressState } from '@/lib/state/progress';
import { explainProgress, type ProgressExplanation, type Spot } from '@/lib/state/progressExplain';
import { rankedList, recorded } from '@/tests/helpers/snapshots';
import type { RankingEvent } from '@/types/rankingEvents';

// The rule that later answers discount earlier ones, on at the spec's example factor.
vi.mock('@/lib/ranking/bt/constants', async (original) => ({
  ...(await original<typeof import('@/lib/ranking/bt/constants')>()),
  RECENCY_FACTOR: 0.5,
}));

let counter = 0;
function ask(winner: string, loser: string): RankingEvent {
  counter++;
  return {
    id: `e${counter}`,
    listId: 'list',
    createdAt: '2026-10-27T00:00:00.000Z',
    kind: 'pair',
    leftItemId: winner,
    rightItemId: loser,
    outcome: 'left',
  };
}

function explain(ids: string[], events: RankingEvent[]): ProgressExplanation {
  const state = replay({ originalItemIds: ids, startingOrder: 'unordered', events });
  const list = rankedList({
    id: 'list',
    originalItemIds: ids,
    initialStartingOrder: 'unordered',
    events: recorded(events),
  });
  const progress = selectProgressState(list, state.ranked, disorderOfState(state));
  const level = progress.kind === 'level' ? levelOf(progress.disorder, progress.items) : null;
  return explainProgress({ state: progress, level, events, shown: state.ranked, evidence: state });
}

describe('explainProgress with later answers counting more', () => {
  it('marks the answers a later answer the other way discounted', () => {
    const explanation = explain(
      ['a', 'b', 'c', 'd'],
      [ask('a', 'b'), ask('a', 'b'), ask('b', 'c'), ask('b', 'a'), ask('c', 'd'), ask('a', 'c')],
    );
    const spot = explanation.spots.find((s) => s.kind === 'both-ways') as Extract<
      Spot,
      { kind: 'both-ways' | 'undecided' | 'one-answer' }
    >;
    expect(spot).toBeDefined();
    expect(spot.answers.map((answer) => [answer.answer, answer.discounted])).toEqual([
      [1, true],
      [2, true],
      [4, false],
    ]);
  });

  it('names a pair the later answers turned against the count, though it is not in doubt', () => {
    const events = [
      ...Array.from({ length: 4 }, () => ask('a', 'b')),
      ...Array.from({ length: 3 }, () => ask('b', 'a')),
      ...['c', 'd'].flatMap((other) => [ask('b', other), ask('b', other), ask('a', other), ask('a', other)]),
      ask('c', 'd'),
      ask('c', 'd'),
    ];
    const explanation = explain(['a', 'b', 'c', 'd'], events);
    expect(explanation.level).toBe(3);
    expect(explanation.spots).toEqual([]);
    expect(explanation.changed).toHaveLength(1);
    const [pair] = explanation.changed;
    expect([pair?.above, pair?.below]).toEqual(['b', 'a']);
    expect(pair?.answers.map((answer) => [answer.answer, answer.discounted])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, true],
      [5, false],
      [6, false],
      [7, false],
    ]);
    expect(explanation.moreChanged).toBe(0);
  });

  describe('resting follows the picker: an open pair is asked until two answers in a row agree', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    // c and d each lose clearly to both a and b, and c beats d, and c and d split once, so a and b are not the next question.
    const others = () => [
      ...['c', 'd'].flatMap((other) => [ask('b', other), ask('b', other), ask('a', other), ask('a', other)]),
      ask('c', 'd'),
      ask('c', 'd'),
      ask('d', 'e'),
    ];
    const asAnswered = (order: ('ab' | 'ba')[]) =>
      order.map((way) => (way === 'ab' ? ask('a', 'b') : ask('b', 'a')));
    const spotOf = (explanation: ProgressExplanation) =>
      explanation.spots.find(
        (s): s is Extract<Spot, { kind: 'both-ways' | 'undecided' | 'one-answer' }> =>
          (s.kind === 'both-ways' || s.kind === 'undecided' || s.kind === 'one-answer') &&
          [s.above, s.below].sort().join() === 'a,b',
      );

    it('a pair answered A, B, A is not resting: Pairwise will ask it again', () => {
      const spot = spotOf(explain(ids, [...asAnswered(['ab', 'ba', 'ab']), ...others()]));
      expect(spot?.kind).toBe('both-ways');
      expect(spot?.next).toBe(false);
      expect(spot?.resting).toBe(false);
    });

    it('after two answers in a row agree it rests', () => {
      const spot = spotOf(explain(ids, [...asAnswered(['ab', 'ab', 'ba', 'ba']), ...others()]));
      expect(spot?.kind).toBe('both-ways');
      expect(spot?.next).toBe(false);
      expect(spot?.resting).toBe(true);
    });

    it('a split that came from an answer a move set aside does not count', () => {
      // B, A, then a move of b sets b's earlier answers aside, then B: the one counted
      // answer is not a split, so the pair, asked 3 times, rests. Counting the
      // set-aside answers it would read B, A, B and stay open.
      const events = [
        ...asAnswered(['ba', 'ab']),
        {
          id: 'move',
          listId: 'list',
          createdAt: '2026-10-27T00:00:00.000Z',
          kind: 'placement',
          itemId: 'b',
          belowItemId: 'a',
        } as RankingEvent,
        ...asAnswered(['ba']),
        ...others(),
      ];
      const spot = spotOf(explain(ids, events));
      expect(spot).toBeDefined();
      expect(spot?.kind).not.toBe('both-ways');
      expect(spot?.next).toBe(false);
      expect(spot?.resting).toBe(true);
    });

    it('an open pair rests at MAX_SHOWINGS_SPLIT', () => {
      const alternating = Array.from({ length: MAX_SHOWINGS_SPLIT }, (_, k): 'ab' | 'ba' =>
        k % 2 === 0 ? 'ab' : 'ba',
      );
      const spot = spotOf(explain(ids, [...asAnswered(alternating), ...others()]));
      expect(spot?.kind).toBe('both-ways');
      expect(spot?.next).toBe(false);
      expect(spot?.resting).toBe(true);
    });
  });

  it('leaves a pair to its both-ways card when the card is shown', () => {
    const events = [
      ...Array.from({ length: 3 }, () => ask('a', 'b')),
      ...Array.from({ length: 2 }, () => ask('b', 'a')),
      ...['c', 'd'].flatMap((other) => [ask('b', other), ask('b', other), ask('a', other), ask('a', other)]),
    ];
    const explanation = explain(['a', 'b', 'c', 'd'], events);
    expect(explanation.spots.some((spot) => spot.kind === 'both-ways')).toBe(true);
    expect(explanation.changed).toEqual([]);
  });
});
