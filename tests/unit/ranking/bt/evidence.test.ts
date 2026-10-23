import { describe, expect, it } from 'vitest';

import { Evidence } from '@/lib/ranking/bt/evidence';
import { Timeline } from '@/lib/ranking/bt/timeline';
import type { PairOutcome, RankingEvent } from '@/types/rankingEvents';

const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };
const ids = ['a', 'b', 'c', 'd', 'e'];

function pair(left: string, right: string, outcome: PairOutcome): RankingEvent {
  return { ...base, id: 'p', kind: 'pair', leftItemId: left, rightItemId: right, outcome };
}

function unrecognized(itemIds: string[]): RankingEvent {
  return { ...base, id: 'u', kind: 'unrecognized', itemIds };
}

function removal(itemIds: string[]): RankingEvent {
  return { ...base, id: 'm', kind: 'removal', itemIds };
}

function slotsOf(t: Timeline, names: string[]): number[] {
  return names.map((n) => {
    const s = t.slotOf(n);
    if (s === undefined) throw new Error(`no slot for ${n}`);
    return s;
  });
}

function record(events: RankingEvent[]): { evidence: Evidence; timeline: Timeline } {
  const timeline = new Timeline(ids);
  const evidence = new Evidence();
  events.forEach((event, i) => {
    timeline.apply(event, i);
    // As the engine does: a placement's item is placed.
    if (event.kind === 'placement') timeline.place(timeline.slotOf(event.itemId) as number, i);
    evidence.add(event, i, timeline);
  });
  return { evidence, timeline };
}

describe('Evidence', () => {
  it('evidence holds pair terms only', () => {
    const { evidence, timeline } = record([
      pair('a', 'b', 'left'),
      pair('c', 'd', 'draw'),
      pair('e', 'a', 'right_strong'),
      pair('b', 'c', 'left_strong'),
    ]);
    const terms = evidence.activeTerms(timeline);
    expect(Object.keys(terms)).toEqual(['pairs']);
    expect(terms.pairs).toHaveLength(5);
    expect(evidence.counts()).toEqual({ pairs: 5 });
  });

  it('a pair choice is one term of weight 1', () => {
    const { evidence, timeline } = record([pair('a', 'b', 'left')]);
    const [a, b] = slotsOf(timeline, ['a', 'b']);
    expect(evidence.activeTerms(timeline).pairs).toEqual([{ winner: a, loser: b, weight: 1, eventIndex: 0 }]);
    const right = record([pair('a', 'b', 'right')]);
    expect(right.evidence.activeTerms(right.timeline).pairs).toEqual([
      { winner: b, loser: a, weight: 1, eventIndex: 0 },
    ]);
  });

  it('much better has weight 1.75', () => {
    const { evidence, timeline } = record([pair('a', 'b', 'right_strong')]);
    const [a, b] = slotsOf(timeline, ['a', 'b']);
    expect(evidence.activeTerms(timeline).pairs).toEqual([
      { winner: b, loser: a, weight: 1.75, eventIndex: 0 },
    ]);
  });

  it('a draw is two opposite terms of weight 0.25 each', () => {
    const { evidence, timeline } = record([pair('a', 'b', 'draw')]);
    const [a, b] = slotsOf(timeline, ['a', 'b']);
    expect(evidence.activeTerms(timeline).pairs).toEqual([
      { winner: a, loser: b, weight: 0.25, eventIndex: 0 },
      { winner: b, loser: a, weight: 0.25, eventIndex: 0 },
    ]);
  });

  it('a later exclusion drops only the terms of the excluded items', () => {
    const events = [pair('a', 'b', 'left'), pair('b', 'c', 'left'), pair('d', 'e', 'draw')];
    const one = record([...events, unrecognized(['c'])]);
    expect(one.evidence.activeTerms(one.timeline).pairs.map((t) => t.eventIndex)).toEqual([0, 2, 2]);
    const two = record([...events, unrecognized(['a', 'd'])]);
    expect(two.evidence.activeTerms(two.timeline).pairs.map((t) => t.eventIndex)).toEqual([1]);
    const three = record([...events, unrecognized(['b', 'e'])]);
    expect(three.evidence.activeTerms(three.timeline).pairs).toEqual([]);
  });

  it('activeTerms follows the timeline it is given, matching a recompute', () => {
    const { evidence, timeline } = record([pair('a', 'b', 'left'), pair('c', 'd', 'left')]);
    expect(evidence.activeTerms(timeline).pairs).toHaveLength(2);
    const later = timeline.clone();
    later.apply(unrecognized(['c']), 2);
    expect(evidence.activeTerms(later).pairs).toHaveLength(1);
    expect(evidence.activeTerms(timeline).pairs).toHaveLength(2);
  });

  it('an excluded item drops its pairs on either side', () => {
    const { evidence, timeline } = record([
      pair('a', 'b', 'left'),
      pair('c', 'a', 'left'),
      unrecognized(['a']),
    ]);
    expect(evidence.activeTerms(timeline).pairs).toEqual([]);
  });

  it("a removed item's evidence still counts", () => {
    const { evidence, timeline } = record([pair('a', 'b', 'left'), removal(['a'])]);
    expect(evidence.activeTerms(timeline).pairs).toHaveLength(1);
  });

  it('evidence recorded before a placement stops counting, and later evidence counts', () => {
    const placement: RankingEvent = { ...base, id: 'pl', kind: 'placement', itemId: 'a' };
    const { evidence, timeline } = record([pair('a', 'b', 'left'), placement, pair('a', 'c', 'left')]);
    expect(evidence.activeTerms(timeline).pairs.map((p) => p.eventIndex)).toEqual([2]);
  });

  it('terms come back in event order', () => {
    const { evidence, timeline } = record([
      pair('a', 'b', 'left'),
      pair('b', 'e', 'right_strong'),
      pair('c', 'd', 'draw'),
    ]);
    const terms = evidence.activeTerms(timeline);
    expect(terms.pairs.map((p) => p.eventIndex)).toEqual([0, 1, 2, 2]);
  });

  it('events naming unknown ids are skipped without throwing', () => {
    const { evidence, timeline } = record([pair('a', 'zzz', 'left'), pair('zzz', 'b', 'draw')]);
    expect(evidence.activeTerms(timeline)).toEqual({ pairs: [] });
  });

  it('a pair of an item with itself is skipped', () => {
    const { evidence, timeline } = record([pair('a', 'a', 'left')]);
    expect(evidence.activeTerms(timeline).pairs).toEqual([]);
  });

  it('non-evidence events are ignored', () => {
    const { evidence, timeline } = record([removal(['b']), unrecognized(['a'])]);
    expect(evidence.activeTerms(timeline)).toEqual({ pairs: [] });
  });

  it('clone is independent of the original', () => {
    const { evidence, timeline } = record([pair('a', 'b', 'left')]);
    const copy = evidence.clone();
    copy.add(pair('b', 'c', 'left'), 1, timeline);
    expect(evidence.activeTerms(timeline).pairs).toHaveLength(1);
    expect(copy.activeTerms(timeline).pairs).toHaveLength(2);
  });

  it('truncate returns to the terms recorded at an earlier count', () => {
    const prefix = [pair('a', 'b', 'draw'), pair('b', 'c', 'left')];
    const { evidence, timeline } = record(prefix);
    const counts = evidence.counts();
    expect(counts).toEqual({ pairs: 3 });
    const later = [pair('c', 'd', 'left_strong'), pair('e', 'd', 'draw')];
    later.forEach((event, i) => evidence.add(event, prefix.length + i, timeline));
    expect(evidence.counts()).toEqual({ pairs: 6 });
    evidence.truncate(counts);
    expect(evidence.activeTerms(timeline)).toEqual(record(prefix).evidence.activeTerms(timeline));
  });
});
