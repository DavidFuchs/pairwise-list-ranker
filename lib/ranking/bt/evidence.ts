import { DRAW_WEIGHT_EACH_WAY, PAIR_WEIGHT, STRONG_WEIGHT } from '@/lib/ranking/bt/constants';
import type { Timeline } from '@/lib/ranking/bt/timeline';
import type { PairOutcome, RankingEvent } from '@/types/rankingEvents';

export interface PairTerm {
  winner: number;
  loser: number;
  weight: number;
  eventIndex: number;
}

export interface EvidenceCounts {
  pairs: number;
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

  /** Active terms under the current exclusions: pairs with both slots eligible. */
  activeTerms(timeline: Timeline): { pairs: PairTerm[] } {
    const eligible = (slot: number, eventIndex: number): boolean =>
      timeline.inFit(slot) && eventIndex > timeline.excludedThrough(slot);
    const pairs = this.pairs.filter(
      (t) => eligible(t.winner, t.eventIndex) && eligible(t.loser, t.eventIndex),
    );
    return { pairs };
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
