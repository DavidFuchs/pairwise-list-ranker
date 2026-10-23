import { describe, expect, it } from 'vitest';

import { placementBetween, unrecognizedIds } from '@/lib/state/placement';
import type { RankingEvent } from '@/types/rankingEvents';

describe('placementBetween', () => {
  it('puts an item between the rows given', () => {
    expect(placementBetween('a', 'b', 'c')).toEqual({ itemId: 'a', aboveItemId: 'b', belowItemId: 'c' });
    expect(placementBetween('a', undefined, 'c')).toEqual({ itemId: 'a', belowItemId: 'c' });
  });

  it('is nothing with no row to anchor it', () => {
    expect(placementBetween('a', undefined, undefined)).toBeNull();
  });
});

describe('unrecognizedIds', () => {
  const base = { listId: 'l', createdAt: '2026-10-18T00:00:00.000Z' };

  it('lasts until the item is placed', () => {
    const events: RankingEvent[] = [
      { ...base, id: '1', kind: 'unrecognized', itemIds: ['a', 'b', 'c'] },
      { ...base, id: '2', kind: 'placement', itemId: 'a', aboveItemId: 'x' },
      { ...base, id: '3', kind: 'placement', itemId: 'z', aboveItemId: 'x' },
      { ...base, id: '4', kind: 'placement', itemId: 'b', belowItemId: 'x' },
    ];

    expect([...unrecognizedIds(events)]).toEqual(['c']);
  });
});
