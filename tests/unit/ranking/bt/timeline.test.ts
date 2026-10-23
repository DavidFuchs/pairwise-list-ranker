import { describe, expect, it } from 'vitest';

import { Timeline } from '@/lib/ranking/bt/timeline';
import type { RankingEvent } from '@/types/rankingEvents';

const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };

function removal(itemIds: string[]): RankingEvent {
  return { ...base, id: 'm', kind: 'removal', itemIds };
}

function unrecognized(itemIds: string[]): RankingEvent {
  return { ...base, id: 'u', kind: 'unrecognized', itemIds };
}

function placement(itemId: string): RankingEvent {
  return { ...base, id: 'p', kind: 'placement', itemId };
}

function slot(timeline: Timeline, id: string): number {
  const s = timeline.slotOf(id);
  if (s === undefined) throw new Error(`no slot for ${id}`);
  return s;
}

describe('Timeline', () => {
  it('arrival sequence is the original import, a duplicate id keeping its first slot', () => {
    const t = new Timeline(['a', 'b', 'd', 'c', 'b']);
    expect(t.arrivalOrder).toEqual(['a', 'b', 'd', 'c']);
    expect(t.slotOf('c')).toBe(3);
    expect(t.slotOf('b')).toBe(1);
    expect(t.slotOf('never')).toBeUndefined();
  });

  it('removal keeps an item in the fit but hides it', () => {
    const t = new Timeline(['a', 'b']);
    t.apply(removal(['a']), 0);
    const a = slot(t, 'a');
    expect(t.isRemoved(a)).toBe(true);
    expect(t.inFit(a)).toBe(true);
    expect(t.isVisible(a)).toBe(false);
    expect(t.isVisible(slot(t, 'b'))).toBe(true);
    // Removing it again changes nothing.
    t.apply(removal(['a']), 1);
    expect(t.isRemoved(a)).toBe(true);
    expect(t.excludedThrough(a)).toBe(-1);
  });

  it('an unrecognized item leaves the fit and is listed in marking order', () => {
    const t = new Timeline(['a', 'b']);
    t.apply(unrecognized(['b']), 0);
    t.apply(unrecognized(['a']), 1);
    expect(t.inFit(slot(t, 'a'))).toBe(false);
    expect(t.inFit(slot(t, 'b'))).toBe(false);
    expect(t.isVisible(slot(t, 'a'))).toBe(false);
    expect(t.unrecognizedOrder.map((s) => t.arrivalOrder[s])).toEqual(['b', 'a']);
  });

  it('a placement clears the unrecognized mark and excludes earlier evidence', () => {
    const t = new Timeline(['a', 'b']);
    t.apply(unrecognized(['b']), 3);
    const b = slot(t, 'b');
    // The engine decides whether a placement applies, then places its item.
    t.place(b, 5);
    expect(t.isUnrecognized(b)).toBe(false);
    expect(t.inFit(b)).toBe(true);
    expect(t.excludedThrough(b)).toBe(5);
    expect(t.unrecognizedOrder).toEqual([]);
  });

  it('marking unrecognized excludes evidence through the mark', () => {
    const t = new Timeline(['a', 'b']);
    expect(t.excludedThrough(slot(t, 'a'))).toBe(-1);
    t.apply(unrecognized(['a']), 4);
    expect(t.excludedThrough(slot(t, 'a'))).toBe(4);
  });

  it('unknown ids in events are ignored', () => {
    const t = new Timeline(['a']);
    t.apply(removal(['zz']), 0);
    t.apply(unrecognized(['zz']), 1);
    t.apply(placement('zz'), 2);
    expect(t.arrivalOrder).toEqual(['a']);
    expect(t.unrecognizedOrder).toEqual([]);
    expect(t.isVisible(0)).toBe(true);
  });

  it('pair events do not change the timeline', () => {
    const t = new Timeline(['a', 'b']);
    t.apply({ ...base, id: 'x', kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' }, 0);
    t.apply({ ...base, id: 'y', kind: 'pair', leftItemId: 'b', rightItemId: 'a', outcome: 'draw' }, 1);
    expect(t.excludedThrough(0)).toBe(-1);
    expect(t.isVisible(0)).toBe(true);
  });

  it('clone is independent', () => {
    const t = new Timeline(['a', 'b']);
    const c = t.clone();
    c.apply(removal(['a']), 0);
    c.apply(unrecognized(['b']), 1);
    expect(t.arrivalOrder).toEqual(['a', 'b']);
    expect(t.isRemoved(0)).toBe(false);
    expect(t.isUnrecognized(1)).toBe(false);
    expect(t.unrecognizedOrder).toEqual([]);
    expect(c.isRemoved(0)).toBe(true);
    expect(c.unrecognizedOrder).toEqual([1]);
  });
});
