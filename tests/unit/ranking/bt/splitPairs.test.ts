import { describe, expect, it } from 'vitest';
import { MAX_SHOWINGS_SPLIT } from '@/lib/ranking/bt/constants';
import type { PairTerm } from '@/lib/ranking/bt/evidence';
import { pairKey } from '@/lib/ranking/bt/picker';
import { openPairs, rests } from '@/lib/ranking/bt/splitPairs';

/** Terms in event order; a draw is two terms between slots 0 and 1 with one event index. */
function terms(...answers: ([winner: number, loser: number] | 'draw')[]): PairTerm[] {
  const result: PairTerm[] = [];
  answers.forEach((answer, eventIndex) => {
    if (answer === 'draw') {
      result.push({ winner: 0, loser: 1, weight: 0.5, eventIndex });
      result.push({ winner: 1, loser: 0, weight: 0.5, eventIndex });
    } else {
      result.push({ winner: answer[0], loser: answer[1], weight: 1, eventIndex });
    }
  });
  return result;
}

describe('openPairs', () => {
  it('a pair answered one way is not open', () =>
    expect(openPairs(terms([0, 1], [0, 1], [0, 1])).size).toBe(0));
  it('A, B, A is open', () => expect(openPairs(terms([0, 1], [1, 0], [0, 1])).has(pairKey(0, 1))).toBe(true));
  it('B, A, A is not open: a run of two', () =>
    expect(openPairs(terms([1, 0], [0, 1], [0, 1])).size).toBe(0));
  it('A, B, A, B is open', () =>
    expect(openPairs(terms([0, 1], [1, 0], [0, 1], [1, 0])).has(pairKey(0, 1))).toBe(true));
  it('a draw neither extends nor breaks a run', () => {
    expect(openPairs(terms([0, 1], [1, 0], [0, 1], 'draw', [0, 1])).size).toBe(0);
    expect(openPairs(terms([0, 1], [1, 0], 'draw', [0, 1])).has(pairKey(0, 1))).toBe(true);
  });
  it('a much better answer counts in the run like a plain one', () => {
    const t = terms([1, 0], [0, 1], [0, 1]);
    (t[2] as { weight: number }).weight = 1.75;
    expect(openPairs(t).size).toBe(0);
  });
  it('a discounted term still counts', () => {
    const t = terms([1, 0], [0, 1]);
    t[0] = { ...(t[0] as PairTerm), weight: 0.5, discounted: true };
    expect(openPairs(t).has(pairKey(0, 1))).toBe(true);
  });
  it('pairs are kept apart', () => {
    const open = openPairs([
      ...terms([0, 1], [1, 0], [0, 1]),
      { winner: 2, loser: 3, weight: 1, eventIndex: 3 },
      { winner: 2, loser: 3, weight: 1, eventIndex: 4 },
      { winner: 2, loser: 3, weight: 1, eventIndex: 5 },
    ]);
    expect([...open]).toEqual([pairKey(0, 1)]);
  });
});

describe('rests', () => {
  it('below MAX_SHOWINGS nothing rests', () => expect(rests(2, false)).toBe(false));
  it('at MAX_SHOWINGS a closed pair rests and an open one does not', () => {
    expect(rests(3, false)).toBe(true);
    expect(rests(3, true)).toBe(false);
  });
  it('at MAX_SHOWINGS_SPLIT everything rests', () => expect(rests(MAX_SHOWINGS_SPLIT, true)).toBe(true));
});
