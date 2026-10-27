import { DRAW_WEIGHT_EACH_WAY, PAIR_WEIGHT, RECENCY_FACTOR, STRONG_WEIGHT } from '@/lib/ranking/bt/constants';
import type { Timeline } from '@/lib/ranking/bt/timeline';
import type { PairOutcome, RankingEvent } from '@/types/rankingEvents';

export interface PairTerm {
  winner: number;
  loser: number;
  weight: number;
  eventIndex: number;
  /** Set when a later answer on the same pair the other way lowered the weight (see discountEarlier). */
  discounted?: true;
}

export interface EvidenceCounts {
  pairs: number;
}

/**
 * The terms with each clear answer multiplied by factor^k, where k is the
 * number of later clear answers between the same two items that picked the
 * other one (docs/ARCHITECTURE.md 6.1). Answers that agree never discount each
 * other, and a draw (two terms with one event index) neither discounts nor is
 * discounted. Order is kept; a lowered term is a new object, every other term
 * is passed through as it was.
 */
export function discountEarlier(terms: readonly PairTerm[], factor: number): PairTerm[] {
  const result = [...terms];
  if (factor === 1) return result;
  const draws = new Set<number>();
  for (let i = 1; i < terms.length; i++) {
    if ((terms[i] as PairTerm).eventIndex === (terms[i - 1] as PairTerm).eventIndex) {
      draws.add((terms[i] as PairTerm).eventIndex);
    }
  }
  // Clear answers seen so far, walking back from the latest: per pair, the count won by its lower slot and by its higher.
  const later = new Map<string, [number, number]>();
  for (let i = terms.length - 1; i >= 0; i--) {
    const term = terms[i] as PairTerm;
    if (draws.has(term.eventIndex)) continue;
    const lowerWon = term.winner < term.loser;
    const key = lowerWon ? `${term.winner},${term.loser}` : `${term.loser},${term.winner}`;
    const counts = later.get(key) ?? [0, 0];
    const against = lowerWon ? counts[1] : counts[0];
    if (against > 0) result[i] = { ...term, weight: term.weight * factor ** against, discounted: true };
    counts[lowerWon ? 0 : 1]++;
    later.set(key, counts);
  }
  return result;
}

function pairWeight(outcome: PairOutcome): number {
  return outcome === 'left_strong' || outcome === 'right_strong' ? STRONG_WEIGHT : PAIR_WEIGHT;
}

/**
 * The comparison evidence, recorded as events arrive and filtered by the
 * timeline's exclusions on demand. A term from event e counts for a slot iff
 * the slot is in the fit and e is later than the slot's last exclusion.
 */
export class Evidence {
  private pairs: PairTerm[] = [];

  /** Adds the terms one event contributes at the time it is recorded. Non-evidence events are ignored. */
  add(event: RankingEvent, index: number, timeline: Timeline): void {
    if (event.kind === 'pair') {
      this.addPair(event.leftItemId, event.rightItemId, event.outcome, index, timeline);
    }
  }

  /** Active terms under the current exclusions: pairs with both slots eligible, later answers discounting earlier ones. */
  activeTerms(timeline: Timeline): { pairs: PairTerm[] } {
    const eligible = (slot: number, eventIndex: number): boolean =>
      timeline.inFit(slot) && eventIndex > timeline.excludedThrough(slot);
    const pairs = this.pairs.filter(
      (t) => eligible(t.winner, t.eventIndex) && eligible(t.loser, t.eventIndex),
    );
    return { pairs: discountEarlier(pairs, RECENCY_FACTOR) };
  }

  /** Terms recorded so far, for truncate. */
  counts(): EvidenceCounts {
    return { pairs: this.pairs.length };
  }

  /**
   * Drops every term recorded after counts were taken. Terms are only ever
   * appended (exclusions live in the timeline), so this restores the evidence
   * of an earlier prefix without keeping a copy of it.
   */
  truncate(counts: EvidenceCounts): void {
    this.pairs.length = Math.min(this.pairs.length, counts.pairs);
  }

  clone(): Evidence {
    const copy = new Evidence();
    copy.pairs = this.pairs.map((t) => ({ ...t }));
    return copy;
  }

  private addPair(
    leftId: string,
    rightId: string,
    outcome: PairOutcome,
    eventIndex: number,
    timeline: Timeline,
  ): void {
    if (leftId === rightId) return;
    const left = timeline.slotOf(leftId);
    const right = timeline.slotOf(rightId);
    if (left === undefined || right === undefined) return;
    if (outcome === 'draw') {
      this.pairs.push({ winner: left, loser: right, weight: DRAW_WEIGHT_EACH_WAY, eventIndex });
      this.pairs.push({ winner: right, loser: left, weight: DRAW_WEIGHT_EACH_WAY, eventIndex });
      return;
    }
    const leftWins = outcome === 'left' || outcome === 'left_strong';
    this.pairs.push({
      winner: leftWins ? left : right,
      loser: leftWins ? right : left,
      weight: pairWeight(outcome),
      eventIndex,
    });
  }
}
