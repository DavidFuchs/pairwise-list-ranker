import { describe, expect, it } from 'vitest';

import { deepEqual } from '@/lib/import/deepEqual';
import { diffImport, diffSettings } from '@/lib/import/diff';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { ListConfig } from '@/types/source';

function item(id: string, value: unknown, active = true): ListItem {
  return {
    id,
    listId: 'list-1',
    value: value as ListItem['value'],
    active,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

function event(leftItemId: string, rightItemId: string): ComparisonEvent {
  return {
    id: `${leftItemId}-${rightItemId}`,
    listId: 'list-1',
    leftItemId,
    rightItemId,
    outcome: 'left',
    createdAt: '2026-08-16T00:00:00.000Z',
  };
}

describe('deepEqual', () => {
  it('compares scalars', () => {
    expect(deepEqual('Alien', 'Alien')).toBe(true);
    expect(deepEqual('Alien', 'Arrival')).toBe(false);
  });

  it('compares objects regardless of key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('compares nested arrays and objects', () => {
    expect(deepEqual({ a: [{ b: 1 }] }, { a: [{ b: 1 }] })).toBe(true);
    expect(deepEqual({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toBe(false);
  });

  it('treats a missing key as different from an undefined one', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});

describe('diffImport', () => {
  it('keeps every item when nothing changed', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];
    const diff = diffImport(items, [{ title: 'Alien' }, { title: 'Arrival' }]);

    expect(diff.kept.map((entry) => entry.item.id)).toEqual(['a', 'b']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('keeps items whose position moved', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];
    const diff = diffImport(items, [{ title: 'Arrival' }, { title: 'Alien' }]);

    expect(diff.kept.map((entry) => entry.item.id).sort()).toEqual(['a', 'b']);
    expect(diff.added).toEqual([]);
  });

  it('reports new entries', () => {
    const diff = diffImport([item('a', { title: 'Alien' })], [{ title: 'Alien' }, { title: 'Solaris' }]);

    expect(diff.added).toEqual([{ title: 'Solaris' }]);
  });

  it('reports entries that disappeared', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];
    const diff = diffImport(items, [{ title: 'Alien' }]);

    expect(diff.removed.map((entry) => entry.id)).toEqual(['b']);
  });

  it('treats an edited field as a removal plus an addition', () => {
    const diff = diffImport([item('a', { title: 'Alien', year: 1979 })], [{ title: 'Alien', year: 1980 }]);

    expect(diff.kept).toEqual([]);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['a']);
    expect(diff.added).toEqual([{ title: 'Alien', year: 1980 }]);
  });

  it('matches duplicates by position among equals', () => {
    const items = [item('a', 'Alien'), item('b', 'Alien'), item('c', 'Arrival')];
    const diff = diffImport(items, ['Alien', 'Arrival']);

    expect(diff.kept.map((entry) => entry.item.id)).toEqual(['a', 'c']);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['b']);
  });

  it('ignores items already removed during comparison', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival', false)];
    const diff = diffImport(items, ['Alien']);

    expect(diff.removed).toEqual([]);
  });

  it('reports a wholesale replacement without special-casing it', () => {
    const diff = diffImport([item('a', 'Alien')], ['Solaris', 'Stalker']);

    expect(diff.kept).toEqual([]);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['a']);
  });

  it('counts the comparisons that survive', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival'), item('c', 'Solaris')];
    const events = [event('a', 'b'), event('a', 'c'), event('b', 'c')];
    const diff = diffImport(items, ['Alien', 'Arrival'], events);

    expect(diff.keptComparisons).toBe(1);
  });

  it('counts no comparisons when none were passed', () => {
    expect(diffImport([item('a', 'Alien')], ['Alien']).keptComparisons).toBe(0);
  });
});

describe('the order the edited document lists', () => {
  it('reports every entry in document order, matched where it can be', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival')];
    const diff = diffImport(items, ['Solaris', 'Arrival']);

    expect(diff.ordered.map((entry) => entry.item?.id ?? null)).toEqual([null, 'b']);
    expect(diff.ordered.map((entry) => entry.entry)).toEqual(['Solaris', 'Arrival']);
  });

  /** An edited entry is a removal plus an addition, and must not fall to the end. */
  it('keeps an edited entry in its own position', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival'), item('c', 'Solaris')];
    const diff = diffImport(items, ['Aliens', 'Arrival', 'Solaris']);

    expect(diff.ordered.map((entry) => entry.item?.id ?? 'new')).toEqual(['new', 'b', 'c']);
  });

  it('reports a reorder of the very same entries', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival')];

    expect(diffImport(items, ['Arrival', 'Alien']).reordered).toBe(true);
  });

  it('reports no reorder when the sequence is untouched', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival')];

    expect(diffImport(items, ['Alien', 'Arrival']).reordered).toBe(false);
  });

  it('ignores added entries when judging the order of the kept ones', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival')];

    expect(diffImport(items, ['Alien', 'Solaris', 'Arrival']).reordered).toBe(false);
  });

  it('reports a reorder around a removal', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival'), item('c', 'Solaris')];

    expect(diffImport(items, ['Solaris', 'Alien']).reordered).toBe(true);
  });
});

describe('diffSettings', () => {
  const plain: ListConfig = { roles: {}, alreadyRanked: false };

  it('reports nothing when the setup is untouched', () => {
    const config: ListConfig = {
      roles: { labelField: 'title', positionField: 'rank' },
      alreadyRanked: true,
    };

    expect(diffSettings(config, { ...config, roles: { ...config.roles } })).toEqual({
      order: 'unchanged',
      label: null,
      writeBack: null,
      changed: false,
    });
  });

  it('reports the order option turning on', () => {
    const diff = diffSettings(plain, { roles: {}, alreadyRanked: true });

    expect(diff.order).toBe('seeded');
    expect(diff.changed).toBe(true);
  });

  it('reports the order option turning off', () => {
    const diff = diffSettings({ roles: {}, alreadyRanked: true }, plain);

    expect(diff.order).toBe('flattened');
    expect(diff.changed).toBe(true);
  });

  it('reports the label field moving between fields', () => {
    const diff = diffSettings(
      { roles: { labelField: 'name' }, alreadyRanked: false },
      { roles: { labelField: 'title' }, alreadyRanked: false },
    );

    expect(diff.label).toEqual({ from: 'name', to: 'title' });
    expect(diff.changed).toBe(true);
  });

  it('reports the write-back field being chosen and cleared', () => {
    const chosen = diffSettings(plain, { roles: { positionField: 'rank' }, alreadyRanked: false });
    const cleared = diffSettings({ roles: { positionField: 'rank' }, alreadyRanked: false }, plain);

    expect(chosen.writeBack).toEqual({ from: undefined, to: 'rank' });
    expect(cleared.writeBack).toEqual({ from: 'rank', to: undefined });
  });

  it('reports every option changing at once', () => {
    const diff = diffSettings(plain, {
      roles: { labelField: 'title', positionField: 'rank' },
      alreadyRanked: true,
    });

    expect(diff.order).toBe('seeded');
    expect(diff.label).toEqual({ from: undefined, to: 'title' });
    expect(diff.writeBack).toEqual({ from: undefined, to: 'rank' });
  });
});

describe('diffSettings summary fields', () => {
  const base = { roles: { labelField: 'title', summaryFields: ['a', 'b'] }, alreadyRanked: false };

  it('notices when only the order of the card fields changed', () => {
    const diff = diffSettings(base, { ...base, roles: { ...base.roles, summaryFields: ['b', 'a'] } });
    expect(diff.changed).toBe(true);
    expect(diff.summary).toEqual({ to: ['b', 'a'] });
  });

  it('says nothing when they are the same', () => {
    expect(diffSettings(base, { ...base }).summary).toBeUndefined();
  });
});
