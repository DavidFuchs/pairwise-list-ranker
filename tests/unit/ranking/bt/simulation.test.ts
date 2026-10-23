import { describe, expect, it } from 'vitest';

import { EngineSession } from '@/lib/ranking/bt/engine';
import { makeUser } from '@/tests/helpers/simUser';

const N = 100;
const ANSWERS = 6 * N;

/** The share of items shown within 5% of the list of their true place after the picker's own pairs are answered. */
function shareNearTrueRank(seed: number, reversedArrival: boolean): number {
  const ids = Array.from({ length: N }, (_, i) => `i${i}`);
  const trueRank = (id: string): number => Number(id.slice(1));
  const user = makeUser('typical', seed, trueRank, N);
  const session = new EngineSession({
    originalItemIds: reversedArrival ? [...ids].reverse() : ids,
    startingOrder: 'unordered',
    events: [],
  });
  for (let answer = 0; answer < ANSWERS; answer++) {
    const pair = session.state.nextPair;
    if (!pair) throw new Error('the picker had no pair to ask');
    session.append({
      id: `e${answer}`,
      listId: 'sim-list',
      createdAt: new Date(Date.UTC(2026, 0, 1) + answer * 1000).toISOString(),
      kind: 'pair',
      leftItemId: pair[0],
      rightItemId: pair[1],
      outcome: user.pair(pair[0], pair[1]),
    });
  }
  const tolerance = Math.max(1, 0.05 * N);
  const near = session.state.ranked.filter((id, place) => Math.abs(trueRank(id) - place) <= tolerance);
  return near.length / N;
}

describe('simulated typical user (docs/ARCHITECTURE.md 6.4)', () => {
  it('reversed arrival order does not materially change quality', () => {
    const forward = shareNearTrueRank(11, false);
    const backward = shareNearTrueRank(11, true);
    expect(Math.abs(forward - backward)).toBeLessThanOrEqual(0.05);
  }, 300_000);

  it('a typical user reaches a good rough order on 100 items within 6n pair answers', () => {
    expect(shareNearTrueRank(12, false)).toBeGreaterThanOrEqual(0.9);
  }, 300_000);
});
