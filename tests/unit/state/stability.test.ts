import { describe, expect, it } from 'vitest';

import { describeStability, selectStability } from '@/lib/state/selectors';
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

  it('counts what is left', () => {
    expect(describeStability({ pairs: 4, unresolved: 1 })).toMatch(/1 neighbouring pair /);
    expect(describeStability({ pairs: 4, unresolved: 3 })).toMatch(/3 neighbouring pairs/);
  });
});
