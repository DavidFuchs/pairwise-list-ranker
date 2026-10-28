import { MAX_SHOWINGS, MAX_SHOWINGS_SPLIT, SPLIT_SETTLED_RUN } from '@/lib/ranking/bt/constants';
import type { PairTerm } from '@/lib/ranking/bt/evidence';

// A pair whose answers go back and forth stays open until two answers in a row
// agree (docs/ARCHITECTURE.md 6.7).

/**
 * Order-independent key for an unordered pair of slots: the pair's index in
 * the triangle of all pairs, so it is unique without knowing how many slots
 * there are. A number keeps the picker's many lookups free of string building.
 */
export function pairKey(a: number, b: number): number {
  const high = a > b ? a : b;
  const low = a > b ? b : a;
  return (high * (high + 1)) / 2 + low;
}

/**
 * The pairKeys of pairs answered clearly both ways whose latest run (clear
 * answers since the last one the other way) is shorter than SPLIT_SETTLED_RUN.
 * Terms are in event order. A draw (two adjacent terms with one event index) is
 * skipped, so it neither extends nor breaks a run; weight and discounting do
 * not matter.
 */
export function openPairs(pairs: readonly PairTerm[]): Set<number> {
  const state = new Map<number, { last: number; run: number; split: boolean }>();
  for (let i = 0; i < pairs.length; i++) {
    const term = pairs[i] as PairTerm;
    const before = pairs[i - 1];
    const after = pairs[i + 1];
    if (before?.eventIndex === term.eventIndex || after?.eventIndex === term.eventIndex) continue;
    const key = pairKey(term.winner, term.loser);
    const seen = state.get(key);
    if (seen === undefined) {
      state.set(key, { last: term.winner, run: 1, split: false });
    } else if (seen.last === term.winner) {
      seen.run++;
    } else {
      seen.last = term.winner;
      seen.run = 1;
      seen.split = true;
    }
  }
  const open = new Set<number>();
  for (const [key, { run, split }] of state) {
    if (split && run < SPLIT_SETTLED_RUN) open.add(key);
  }
  return open;
}

/** Whether a pair shown `times` before is set aside: always at MAX_SHOWINGS_SPLIT, and at MAX_SHOWINGS unless it is open. */
export function rests(times: number, open: boolean): boolean {
  return times >= MAX_SHOWINGS_SPLIT || (times >= MAX_SHOWINGS && !open);
}
