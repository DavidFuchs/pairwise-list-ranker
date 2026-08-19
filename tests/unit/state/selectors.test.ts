import { describe, expect, it } from 'vitest';

import {
  describeCoverage,
  describeRoles,
  selectAvailableTabs,
  selectContextLine,
  selectCurrentPair,
  selectExportText,
  selectListConfig,
  selectProgress,
  selectRanking,
  selectRemovedCount,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { SavedList, Workspace } from '@/types/source';

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
  listDefaults: { roles: { labelField: 'title' }, alreadyRanked: false },
  configuredExplicitly: true,
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

describe('selectProgress', () => {
  /** n * log2(n) for three items is ~4.75, so five rated comparisons pass it. */
  function comparisons(count: number, outcome: ComparisonEvent['outcome'] = 'left') {
    return Array.from({ length: count }, (_, index) => ({
      id: `event-${index}`,
      listId: 'list-1',
      leftItemId: 'item-1',
      rightItemId: 'item-2',
      outcome,
      createdAt: NOW,
    })) satisfies ComparisonEvent[];
  }

  it('counts active items and rated comparisons', () => {
    const progress = selectProgress(items, comparisons(2));

    expect(progress.activeItems).toBe(3);
    expect(progress.comparisons).toBe(2);
  });

  it('leaves skips out of the count, because they say nothing about the order', () => {
    const progress = selectProgress(items, [...comparisons(2), ...comparisons(1, 'skip')]);

    expect(progress.comparisons).toBe(2);
    expect(progress.skips).toBe(1);
  });

  it('passes 1 once the estimate is beaten, so surplus work still registers', () => {
    const progress = selectProgress(items, comparisons(10));

    expect(progress.coverage).toBeGreaterThan(1);
  });

  it('keeps climbing with every comparison past the estimate', () => {
    const at10 = selectProgress(items, comparisons(10)).coverage;
    const at12 = selectProgress(items, comparisons(12)).coverage;

    expect(at12).toBeGreaterThan(at10);
  });

  it('is zero when there is nothing to rank', () => {
    expect(selectProgress([items[0]!], []).coverage).toBe(0);
  });

  it('starts an already-ranked list at full coverage with no comparisons yet', () => {
    const progress = selectProgress(items, [], true);

    expect(progress.coverage).toBe(1);
  });

  it('climbs past full coverage as an already-ranked list gets compared further', () => {
    const at0 = selectProgress(items, [], true).coverage;
    const at2 = selectProgress(items, comparisons(2), true).coverage;

    expect(at2).toBeGreaterThan(at0);
    expect(at0).toBe(1);
  });

  it('does not credit coverage for being already ranked when there is nothing to rank', () => {
    expect(selectProgress([items[0]!], [], true).coverage).toBe(0);
  });
});

describe('describeCoverage', () => {
  it('reads as a plain percentage below the estimate', () => {
    const shown = describeCoverage(0.52);

    expect(shown.label).toBe('52%');
    expect(shown.filled).toBe(52);
    expect(shown.surplus).toBe(0);
  });

  it('splits the bar into a full green run and a gold surplus past the estimate', () => {
    const shown = describeCoverage(1.38);

    expect(shown.label).toBe('138%');
    expect(shown.filled).toBe(100);
    expect(shown.surplus).toBe(38);
  });

  it('caps the number once the plating is complete, rather than climbing forever', () => {
    expect(describeCoverage(2).label).toBe('200%');
    expect(describeCoverage(2.4).label).toBe('200%+');
    expect(describeCoverage(37).label).toBe('200%+');
  });

  it('keeps the plating full once capped', () => {
    expect(describeCoverage(2.4).surplus).toBe(100);
    expect(describeCoverage(37).surplus).toBe(100);
  });

  it('says nothing extra while the estimate is still ahead', () => {
    expect(describeCoverage(0.52).note).toBeNull();
    expect(describeCoverage(0.99).note).toBeNull();
  });

  it('tells the user the order is usable, and that carrying on still helps', () => {
    const note = describeCoverage(1).note;

    expect(note).toMatch(/sorted/i);
    expect(note).toMatch(/keep going/i);
    expect(describeCoverage(1.38).note).toBe(note);
    expect(describeCoverage(37).note).toBe(note);
  });

  it('says the surplus out loud for screen readers', () => {
    expect(describeCoverage(0.52).valueText).toBe('52%');
    expect(describeCoverage(1.38).valueText).toMatch(/138%.*past the estimate/i);
    expect(describeCoverage(37).valueText).toMatch(/over 200%.*past the estimate/i);
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

describe('describeRoles', () => {
  it('names the label field', () => {
    expect(describeRoles({ labelField: 'title' }, false)).toBe('shown by title');
  });

  it('mentions the position field when there is one', () => {
    expect(describeRoles({ labelField: 'title', positionField: 'order' }, false)).toBe(
      'shown by title · order written back',
    );
  });

  it('mentions already-ranked status when set', () => {
    expect(describeRoles({ labelField: 'title' }, true)).toBe('shown by title · already ranked');
  });

  it('says nothing about a plain list that is in no particular order', () => {
    expect(describeRoles({}, false)).toBe('');
  });
});

describe('selectListConfig', () => {
  const multiList: Workspace = {
    ...workspace,
    source: {
      ...workspace.source,
      document: {
        movies: [{ title: 'Alien' }, { title: 'Arrival' }],
        actors: [{ name: 'Weaver' }, { name: 'Adams' }],
      },
    },
    alreadyRanked: true,
    configuredExplicitly: true,
    listDefaults: { roles: { labelField: 'title' }, alreadyRanked: true },
  };

  const savedActors: SavedList = {
    workspaceId: 'list-2',
    arrayPath: ['actors'],
    roles: { labelField: 'name' },
    alreadyRanked: false,
    configuredExplicitly: true,
    items: [],
    comparisonEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('reports the active list its own configuration', () => {
    expect(selectListConfig(multiList, [], ['movies'])).toEqual({
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });
  });

  it('reports a parked list the configuration it was set up with', () => {
    expect(selectListConfig(multiList, [savedActors], ['actors'])).toEqual({
      roles: { labelField: 'name' },
      alreadyRanked: false,
    });
  });

  it('takes the order answer for an unconfigured list from the document defaults', () => {
    const defaultNotRanked = {
      ...multiList,
      listDefaults: { roles: { labelField: 'title' }, alreadyRanked: false },
    };

    expect(selectListConfig(defaultNotRanked, [], ['actors']).alreadyRanked).toBe(false);
  });

  it('falls back to the target list own label field when the default one is absent', () => {
    expect(selectListConfig(multiList, [], ['actors']).roles).toEqual({ labelField: 'name' });
  });

  it('keeps the default label field when the target list carries it too', () => {
    const shared: Workspace = {
      ...multiList,
      source: {
        ...multiList.source,
        document: {
          movies: [{ title: 'Alien' }, { title: 'Arrival' }],
          books: [{ title: 'Dune' }, { title: 'Ubik' }],
        },
      },
    };

    expect(selectListConfig(shared, [], ['books']).roles).toEqual({ labelField: 'title' });
  });

  it('takes an unconfigured list from the defaults, not from whatever list is open', () => {
    const onYear: Workspace = {
      ...multiList,
      source: {
        ...multiList.source,
        arrayPath: ['movies'],
        document: {
          movies: [{ title: 'Alien', year: 1979 }],
          books: [{ title: 'Dune', year: 1965 }],
        },
      },
      roles: { labelField: 'year' },
      alreadyRanked: false,
      listDefaults: { roles: { labelField: 'title' }, alreadyRanked: true },
    };

    expect(selectListConfig(onYear, [], ['books'])).toEqual({
      roles: { labelField: 'title' },
      alreadyRanked: true,
    });
  });

  it('re-derives a parked list that was never set up by hand', () => {
    const inherited: SavedList = {
      ...savedActors,
      roles: { labelField: 'name' },
      alreadyRanked: false,
      configuredExplicitly: false,
    };
    const defaults = {
      ...multiList,
      listDefaults: { roles: { labelField: 'nickname' }, alreadyRanked: true },
      source: {
        ...multiList.source,
        document: {
          movies: [{ title: 'Alien' }],
          actors: [{ name: 'Weaver', nickname: 'Ripley' }],
        },
      },
    };

    expect(selectListConfig(defaults, [inherited], ['actors'])).toEqual({
      roles: { labelField: 'nickname' },
      alreadyRanked: true,
    });
  });

  it('has nothing to inherit with no workspace', () => {
    expect(selectListConfig(null, [], ['movies'])).toEqual({ roles: {}, alreadyRanked: false });
  });
});
