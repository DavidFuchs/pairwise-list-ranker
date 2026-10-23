import { describe, expect, it } from 'vitest';

import { activeItems, isItemActive, removedCount, removedIds, removedItemsOf } from '@/lib/state/membership';
import { listItem, NOW } from '@/tests/helpers/snapshots';
import type { RankingEvent } from '@/types/rankingEvents';

function removal(id: string, itemIds: string[]): RankingEvent {
  return { id, listId: 'l', createdAt: NOW, kind: 'removal', itemIds };
}

const items = ['a', 'b', 'c'].map((id) => listItem(id, 'l', id));
const originalItemIds = ['a', 'b', 'c'];

describe('membership from the history', () => {
  it('has every item active with no events', () => {
    expect(activeItems({ items, events: [], originalItemIds }).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(removedCount({ items, events: [], originalItemIds })).toBe(0);
  });

  it('gathers every removal in the history', () => {
    const events = [removal('1', ['a']), removal('2', ['c', 'a'])];
    expect([...removedIds(events)].sort()).toEqual(['a', 'c']);
    expect(isItemActive({ items, events, originalItemIds }, 'a')).toBe(false);
    expect(isItemActive({ items, events, originalItemIds }, 'b')).toBe(true);
    expect(removedCount({ items, events, originalItemIds })).toBe(2);
    expect(removedItemsOf({ items, events, originalItemIds }).map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('ignores events that are not removals', () => {
    const events: RankingEvent[] = [
      {
        id: 'p',
        listId: 'l',
        createdAt: NOW,
        kind: 'pair',
        leftItemId: 'a',
        rightItemId: 'b',
        outcome: 'left',
      },
      removal('m', ['b']),
    ];
    expect(activeItems({ items, events, originalItemIds }).map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('knows no item the list does not hold', () => {
    expect(isItemActive({ items, events: [], originalItemIds }, 'z')).toBe(false);
  });

  it('knows no item outside the import, which the engine has no place for', () => {
    expect(isItemActive({ items, events: [], originalItemIds: ['a', 'b'] }, 'c')).toBe(false);
    expect(activeItems({ items, events: [], originalItemIds: ['a', 'b'] }).map((item) => item.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('gives the same answer for the same history', () => {
    const events = [removal('1', ['a'])];
    expect(activeItems({ items, events, originalItemIds })).toBe(
      activeItems({ items, events, originalItemIds }),
    );
  });
});
