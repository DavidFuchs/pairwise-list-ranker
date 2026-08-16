import { describe, expect, it } from 'vitest';

import {
  selectCurrentPair,
  selectDocument,
  selectNeedsSortField,
  selectPreviewText,
  selectRanking,
  selectSortFieldCandidates,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import type { ListItem, WorkspaceList } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

const NOW = '2026-08-15T12:00:00.000Z';

const list: WorkspaceList = {
  id: 'list-1',
  title: 'Weeknight dinners',
  kind: 'primitive',
  createdAt: NOW,
  updatedAt: NOW,
};

function item(id: string, value: ListItem['value'], active = true): ListItem {
  return { id, listId: 'list-1', value, active, createdAt: NOW, updatedAt: NOW };
}

const items = [item('item-1', 'Tacos'), item('item-2', 'Ramen'), item('item-3', 'Curry')];

const bWins: ComparisonEvent[] = [
  {
    id: 'event-1',
    listId: 'list-1',
    leftItemId: 'item-1',
    rightItemId: 'item-2',
    outcome: 'right',
    createdAt: NOW,
  },
];

describe('selectWorkspaceView', () => {
  it('reuses the previous result when nothing changed', () => {
    const first = selectWorkspaceView(items, bWins);
    const second = selectWorkspaceView(items, bWins);

    expect(second).toBe(first);
  });

  it('recomputes when the history changes', () => {
    const first = selectWorkspaceView(items, []);
    const second = selectWorkspaceView(items, bWins);

    expect(second).not.toBe(first);
  });
});

describe('selectRanking', () => {
  it('orders items by the comparison history', () => {
    // Ramen won, so Tacos drops below the item that has not been compared yet.
    expect(selectRanking(items, bWins).map((entry) => entry.item.id)).toEqual([
      'item-2',
      'item-3',
      'item-1',
    ]);
  });

  it('leaves out deleted items', () => {
    const withDeleted = [items[0]!, item('item-2', 'Ramen', false), items[2]!];

    expect(selectRanking(withDeleted, []).map((entry) => entry.item.id)).toEqual([
      'item-1',
      'item-3',
    ]);
  });
});

describe('selectCurrentPair', () => {
  it('offers two different active items', () => {
    const pair = selectCurrentPair(items, []);

    expect(pair).not.toBeNull();
    expect(pair?.left.id).not.toBe(pair?.right.id);
    expect(pair?.left.active).toBe(true);
  });

  it('offers nothing when a single item is left', () => {
    expect(selectCurrentPair([items[0]!], [])).toBeNull();
  });
});

describe('selectDocument', () => {
  it('exports items in ranked order, best first', () => {
    const doc = selectDocument(list, items, bWins);

    expect(doc.items.map((entry) => entry.id)).toEqual(['item-2', 'item-3', 'item-1']);
  });

  it('carries the list title and kind', () => {
    expect(selectDocument(list, items, [])).toMatchObject({ title: list.title, kind: 'primitive' });
  });
});

describe('selectPreviewText', () => {
  it('renders the ranked list in each exportable format', () => {
    expect(selectPreviewText(list, items, bWins, 'markdown')).toContain('- Ramen\n- Curry\n- Tacos');
    expect(selectPreviewText(list, items, bWins, 'yaml')).toContain('value: Ramen');
    expect(selectPreviewText(list, items, bWins, 'json')).toContain('"value": "Ramen"');
  });

  it('renders an empty workspace as empty text rather than failing', () => {
    expect(selectPreviewText(null, [], [], 'yaml')).toBe('');
  });
});

describe('selectSortFieldCandidates', () => {
  it('lists scalar fields that every object shares', () => {
    const objects = [
      item('item-1', { title: 'Arrival', year: 2016, cast: ['Amy Adams'] }),
      item('item-2', { title: 'Alien', year: 1979, cast: ['Sigourney Weaver'] }),
    ];

    expect(selectSortFieldCandidates(objects)).toEqual(['title', 'year']);
  });

  it('skips fields that are missing from some items', () => {
    const objects = [
      item('item-1', { title: 'Arrival', year: 2016 }),
      item('item-2', { title: 'Alien' }),
    ];

    expect(selectSortFieldCandidates(objects)).toEqual(['title']);
  });

  it('has nothing to offer for a simple list', () => {
    expect(selectSortFieldCandidates(items)).toEqual([]);
  });
});

describe('selectNeedsSortField', () => {
  it('blocks ranking for an object list with no sort field chosen', () => {
    const objectList: WorkspaceList = { ...list, kind: 'object', sortField: undefined };

    expect(selectNeedsSortField(objectList)).toBe(true);
  });

  it('allows ranking once a sort field is chosen', () => {
    const objectList: WorkspaceList = { ...list, kind: 'object', sortField: 'title' };

    expect(selectNeedsSortField(objectList)).toBe(false);
  });

  it('never blocks a simple list', () => {
    expect(selectNeedsSortField(list)).toBe(false);
  });
});
