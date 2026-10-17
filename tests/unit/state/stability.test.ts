import { describe, expect, it } from 'vitest';

import {
  comparisonTarget,
  describeScale,
  describeStability,
  LONG_LIST_ITEMS,
  selectStability,
} from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, RankedItem } from '@/types/ranking';

const NOW = '2026-08-15T12:00:00.000Z';

function row(id: string, rating: number, rank: number): RankedItem<ListItem> {
  return {
    rank,
    item: { id, listId: 'l', value: id, active: true, createdAt: NOW, updatedAt: NOW },
    state: { itemId: id, rating, comparisons: 0, wins: 0, losses: 0, skips: 0 },
  };
}

function event(left: string, right: string, outcome: ComparisonEvent['outcome'] = 'left'): ComparisonEvent {
  return {
    id: `${left}${right}`,
    listId: 'l',
    leftItemId: left,
    rightItemId: right,
    outcome,
    createdAt: NOW,
  };
}

describe('selectStability', () => {
  const close = [row('a', 1510, 1), row('b', 1505, 2), row('c', 1500, 3)];

  it('counts close neighbours nobody has compared', () => {
    expect(selectStability(close, [])).toEqual({ pairs: 2, unresolved: 2 });
  });

  it('resolves a pair once it has been compared directly', () => {
    expect(selectStability(close, [event('a', 'b')]).unresolved).toBe(1);
  });

  it('does not count a skip as a comparison', () => {
    expect(selectStability(close, [event('a', 'b', 'skip')]).unresolved).toBe(2);
  });

  it('resolves neighbours whose ratings are far apart', () => {
    const spread = [row('a', 1600, 1), row('b', 1500, 2), row('c', 1400, 3)];
    expect(selectStability(spread, []).unresolved).toBe(0);
  });
});

describe('describeStability', () => {
  it('says nothing for a list too short to have neighbours', () => {
    expect(describeStability({ pairs: 0, unresolved: 0 })).toBe('');
  });

  it('says when everything is settled', () => {
    expect(describeStability({ pairs: 4, unresolved: 0 })).toMatch(/settled/);
  });

  it('counts what has settled, not what is left', () => {
    expect(describeStability({ pairs: 4, unresolved: 3 })).toBe('1 of 4 places in the order is settled.');
    expect(describeStability({ pairs: 4, unresolved: 1 })).toBe('3 of 4 places in the order are settled.');
    expect(describeStability({ pairs: 499, unresolved: 499 })).toBe(
      '0 of 499 places in the order are settled.',
    );
    expect(describeStability({ pairs: 1, unresolved: 1 })).toBe('0 of 1 place in the order is settled.');
  });
});

describe('describeScale', () => {
  it('says how many choices a long list takes, to two figures', () => {
    expect(describeScale(500, 0.01)).toBe(
      'About 4,500 choices settle 500 items. The order is usable well before that.',
    );
    expect(describeScale(LONG_LIST_ITEMS, 0)).toMatch(/^About 280 choices settle 50 items/);
  });

  it('says nothing on a short list', () => {
    expect(describeScale(LONG_LIST_ITEMS - 1, 0)).toBeNull();
  });

  it('gives way once the estimate is met', () => {
    expect(describeScale(500, 0.994)).not.toBeNull();
    expect(describeScale(500, 0.995)).toBeNull();
  });

  it('agrees with the estimate behind the meter', () => {
    expect(comparisonTarget(500)).toBe(4483);
    expect(comparisonTarget(1)).toBe(0);
  });
});
