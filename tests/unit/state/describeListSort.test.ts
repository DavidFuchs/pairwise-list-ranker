import { describe, expect, it, vi } from 'vitest';

import { describeListSort } from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { RankedList } from '@/types/source';

const detections = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/lib/import/sortField', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/import/sortField')>();
  return {
    ...actual,
    detectSortFields: (entries: unknown[]) => {
      detections.count += 1;
      return actual.detectSortFields(entries);
    },
  };
});

const NOW = '2026-08-15T12:00:00.000Z';

function listOver(items: ListItem[]): RankedList {
  return {
    id: 'list-1',
    arrayPath: ['albums'],
    roles: {},
    initialStartingOrder: 'rough',
    initialSort: { field: 'at', direction: 'desc' },
    configuredExplicitly: true,
    originalItemIds: items.map((item) => item.id),
    items,
    events: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as RankedList;
}

function itemsOf(values: unknown[]): ListItem[] {
  return values.map((value, index) => ({ id: `i-${index}`, value }) as ListItem);
}

describe('describeListSort', () => {
  it('reads the sort field kind once per items array, and again when the items change', () => {
    const items = itemsOf([{ at: '2024-01-01' }, { at: '2025-01-01' }]);
    detections.count = 0;

    expect(describeListSort(listOver(items))).toBe('sorted by at, newest first');
    expect(describeListSort({ ...listOver(items), updatedAt: 'later' })).toBe('sorted by at, newest first');
    expect(describeListSort(listOver(items))).toBe('sorted by at, newest first');
    expect(detections.count).toBe(1);

    const changed = itemsOf([{ at: 1 }, { at: 2 }]);
    expect(describeListSort(listOver(changed))).toBe('sorted by at, high to low');
    expect(detections.count).toBe(2);
  });
});
