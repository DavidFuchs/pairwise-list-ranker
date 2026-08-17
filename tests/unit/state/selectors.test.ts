import { describe, expect, it } from 'vitest';

import {
  selectAvailableTabs,
  selectContextLine,
  selectCurrentPair,
  selectExportText,
  selectRanking,
  selectRemovedCount,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { Workspace } from '@/types/source';

const NOW = '2026-08-15T12:00:00.000Z';

const workspace: Workspace = {
  id: 'list-1',
  source: {
    format: 'yaml',
    rawText: '',
    document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
    arrayPath: ['movies'],
  },
  roles: { labelField: 'title' },
  alreadyRanked: false,
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

  it('seeds ratings from the given order when the list is already ranked', () => {
    const view = selectWorkspaceView(items, [], true);

    expect(view.states.get('item-1')!.rating).toBeGreaterThan(1500);
    expect(view.states.get('item-3')!.rating).toBeLessThan(1500);
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

describe('selectExportText', () => {
  it('serializes the user document with the ranking applied', () => {
    const objects = [item('item-1', { title: 'Alien' }), item('item-2', { title: 'Arrival' })];

    expect(selectExportText(workspace, objects, [], 'yaml')).toContain('owner: david');
  });

  it('is empty with no workspace', () => {
    expect(selectExportText(null, [], [], 'yaml')).toBe('');
  });
});

describe('selectRemovedCount', () => {
  it('counts only the deactivated items', () => {
    expect(selectRemovedCount([item('a', 'x'), item('b', 'y', false)])).toBe(1);
  });
});

describe('selectContextLine', () => {
  it('names the array and the label field', () => {
    expect(selectContextLine(workspace)).toBe('movies · shown by title');
  });

  it('mentions the position field when there is one', () => {
    const withOrder = {
      ...workspace,
      roles: { labelField: 'title', positionField: 'order' },
    };

    expect(selectContextLine(withOrder)).toBe('movies · shown by title · order written back');
  });

  it('mentions already-ranked status when set', () => {
    const ranked = { ...workspace, alreadyRanked: true };

    expect(selectContextLine(ranked)).toBe('movies · shown by title · already ranked');
  });

  it('names a bare list plainly', () => {
    const bare = {
      ...workspace,
      source: { ...workspace.source, format: 'list' as const, document: ['a'], arrayPath: [] },
      roles: {},
    };

    expect(selectContextLine(bare)).toBe('the list');
  });

  it('is empty with no workspace', () => {
    expect(selectContextLine(null)).toBe('');
  });
});

describe('selectAvailableTabs', () => {
  it('offers ranked plus the text formats for a structured source', () => {
    expect(selectAvailableTabs(workspace)).toEqual(['ranked', 'yaml', 'json']);
  });

  it('offers the plain list tab for a plain list source', () => {
    const bare = {
      ...workspace,
      source: { ...workspace.source, format: 'list' as const, document: ['a'], arrayPath: [] },
    };

    expect(selectAvailableTabs(bare)).toEqual(['ranked', 'list', 'yaml', 'json']);
  });

  it('offers only the ranked tab with no workspace', () => {
    expect(selectAvailableTabs(null)).toEqual(['ranked']);
  });
});
