import { describe, expect, it, vi } from 'vitest';

import { replay } from '@/lib/ranking/bt/engine';
import { disorderOfState, levelOf } from '@/lib/ranking/bt/progress';
import { selectProgressState } from '@/lib/state/progress';
import { explainProgress, type Spot } from '@/lib/state/progressExplain';
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

describe('explainProgress with later answers counting more', () => {
  it('marks the answers a later answer the other way discounted', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const events = [ask('a', 'b'), ask('a', 'b'), ask('b', 'c'), ask('b', 'a'), ask('c', 'd'), ask('a', 'c')];
    const state = replay({ originalItemIds: ids, startingOrder: 'unordered', events });
    const list = rankedList({
      id: 'list',
      originalItemIds: ids,
      initialStartingOrder: 'unordered',
      events: recorded(events),
    });
    const progress = selectProgressState(list, state.ranked, disorderOfState(state));
    const level = progress.kind === 'level' ? levelOf(progress.disorder, progress.items) : null;
    const explanation = explainProgress({
      state: progress,
      level,
      events,
      shown: state.ranked,
      evidence: state,
    });
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
});
