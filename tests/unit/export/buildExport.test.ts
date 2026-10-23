import { describe, expect, it } from 'vitest';

import { buildExport, buildExportDocument, setAtPath } from '@/lib/export/buildExport';
import type { ListItem } from '@/types/list';
import type { DataSource } from '@/types/source';

function item(id: string, value: unknown): ListItem {
  return {
    id,
    listId: 'list-1',
    value: value as ListItem['value'],
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

const nestedSource: DataSource = {
  format: 'yaml',
  document: {
    version: 3,
    owner: 'david',
    movies: [
      { title: 'Alien', year: 1979 },
      { title: 'Arrival', year: 2016 },
    ],
    notes: 'personal picks',
  },
  arrayPath: ['movies'],
};

const ranked = [item('a', { title: 'Arrival', year: 2016 }), item('b', { title: 'Alien', year: 1979 })];

describe('setAtPath', () => {
  it('replaces a nested value without touching its siblings', () => {
    expect(setAtPath({ a: 1, b: { c: [1] } }, ['b', 'c'], [9])).toEqual({ a: 1, b: { c: [9] } });
  });

  it('replaces the whole document for an empty path', () => {
    expect(setAtPath({ a: 1 }, [], [9])).toEqual([9]);
  });

  it('does not mutate the input', () => {
    const input = { a: { b: [1] } };
    setAtPath(input, ['a', 'b'], [9]);

    expect(input).toEqual({ a: { b: [1] } });
  });
});

describe('buildExportDocument', () => {
  it('keeps every wrapper key, in order', () => {
    const result = buildExportDocument(nestedSource, {}, [{ title: 'Arrival' }]);

    expect(Object.keys(result as object)).toEqual(['version', 'owner', 'movies', 'notes']);
  });

  it('keeps sibling values untouched', () => {
    const result = buildExportDocument(nestedSource, {}, [{ title: 'Arrival' }]) as Record<string, unknown>;

    expect(result.version).toBe(3);
    expect(result.notes).toBe('personal picks');
  });

  it('writes the reordered entries at the array path', () => {
    const result = buildExportDocument(nestedSource, {}, [
      { title: 'Arrival', year: 2016 },
      { title: 'Alien', year: 1979 },
    ]) as { movies: { title: string }[] };

    expect(result.movies.map((entry) => entry.title)).toEqual(['Arrival', 'Alien']);
  });

  it('keeps fields the app never understood', () => {
    const result = buildExportDocument(nestedSource, {}, [
      { title: 'Arrival', year: 2016, cast: ['Amy Adams'], nested: { a: 1 } },
    ]) as { movies: Record<string, unknown>[] };

    expect(result.movies[0]).toEqual({
      title: 'Arrival',
      year: 2016,
      cast: ['Amy Adams'],
      nested: { a: 1 },
    });
  });

  it('rewrites an existing position field in place, keeping its key order', () => {
    const result = buildExportDocument(nestedSource, { positionField: 'order' }, [
      { title: 'Arrival', order: 7, year: 2016 },
      { title: 'Alien', order: 4, year: 1979 },
    ]) as { movies: Record<string, unknown>[] };

    expect(result.movies[0]).toEqual({ title: 'Arrival', order: 1, year: 2016 });
    expect(Object.keys(result.movies[0] ?? {})).toEqual(['title', 'order', 'year']);
    expect(result.movies[1]?.order).toBe(2);
  });

  it('appends a position field that did not exist', () => {
    const result = buildExportDocument(nestedSource, { positionField: 'rank' }, [{ title: 'Arrival' }]) as {
      movies: Record<string, unknown>[];
    };

    expect(Object.keys(result.movies[0] ?? {})).toEqual(['title', 'rank']);
  });

  it('leaves scalar entries alone even when a position field is set', () => {
    const listSource: DataSource = {
      format: 'list',
      document: ['Alien', 'Arrival'],
      arrayPath: [],
    };

    expect(buildExportDocument(listSource, { positionField: 'order' }, ['Arrival', 'Alien'])).toEqual([
      'Arrival',
      'Alien',
    ]);
  });
});

describe('buildExport', () => {
  it('serializes YAML with the wrapper intact', () => {
    const text = buildExport(nestedSource, {}, ranked, 'yaml');

    expect(text).toContain('version: 3');
    expect(text).toContain('notes: personal picks');
    expect(text.indexOf('Arrival')).toBeLessThan(text.indexOf('Alien'));
  });

  it('serializes JSON with two-space indentation', () => {
    const text = buildExport(nestedSource, {}, ranked, 'json');

    expect(text.startsWith('{\n  "version": 3,')).toBe(true);
  });

  it('serializes a plain list as one label per line', () => {
    const listSource: DataSource = {
      format: 'list',
      document: ['Alien', 'Arrival'],
      arrayPath: [],
    };
    const text = buildExport(listSource, {}, [item('a', 'Arrival'), item('b', 'Alien')], 'list');

    expect(text).toBe('Arrival\nAlien\n');
  });

  it('uses the label field when writing object entries as a plain list', () => {
    expect(buildExport(nestedSource, { labelField: 'title' }, ranked, 'list')).toBe('Arrival\nAlien\n');
  });

  it('is stable: the same inputs give the same text', () => {
    expect(buildExport(nestedSource, {}, ranked, 'yaml')).toBe(buildExport(nestedSource, {}, ranked, 'yaml'));
  });

  it('never mutates the stored source document', () => {
    const before = JSON.stringify(nestedSource.document);
    buildExport(nestedSource, { positionField: 'order' }, ranked, 'json');

    expect(JSON.stringify(nestedSource.document)).toBe(before);
  });
});
