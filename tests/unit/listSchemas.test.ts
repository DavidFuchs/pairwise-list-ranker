import { describe, expect, it } from 'vitest';

import { coerceToListDocument, parseListDocument } from '@/lib/validation/listSchemas';
import { LIST_DOCUMENT_VERSION } from '@/types/workspace';

describe('parseListDocument', () => {
  it('accepts a canonical primitive document', () => {
    const result = parseListDocument({
      version: 1,
      title: 'Weeknight dinners',
      kind: 'primitive',
      items: [{ value: 'Tacos' }, { value: 'Ramen' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('primitive');
    expect(result.data.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('accepts a canonical object document with a sort field', () => {
    const result = parseListDocument({
      version: 1,
      title: 'Favorite sci-fi films',
      description: 'Personal ranking list',
      kind: 'object',
      sortField: 'title',
      items: [{ id: 'item-1', value: { title: 'Arrival', year: 2016 } }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sortField).toBe('title');
    expect(result.data.items[0]).toEqual({ id: 'item-1', value: { title: 'Arrival', year: 2016 } });
  });

  it('defaults the version when the document omits it', () => {
    const result = parseListDocument({
      title: 'No version',
      kind: 'primitive',
      items: [{ value: 'One' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(LIST_DOCUMENT_VERSION);
  });

  it('rejects a document written by a newer app version', () => {
    const result = parseListDocument({
      version: LIST_DOCUMENT_VERSION + 1,
      title: 'From the future',
      kind: 'primitive',
      items: [{ value: 'One' }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/newer version/i);
  });

  it('rejects a missing title with a field path', () => {
    const result = parseListDocument({ kind: 'primitive', items: [{ value: 'One' }] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path)).toContain('title');
  });

  it('rejects an object value inside a primitive list', () => {
    const result = parseListDocument({
      title: 'Mismatched',
      kind: 'primitive',
      items: [{ value: 'One' }, { value: { name: 'Two' } }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe('items.1.value');
  });

  it('rejects a string value inside an object list', () => {
    const result = parseListDocument({
      title: 'Mismatched',
      kind: 'object',
      items: [{ value: { name: 'One' } }, { value: 'Two' }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe('items.1.value');
  });

  it('rejects a sort field on a primitive list', () => {
    const result = parseListDocument({
      title: 'Simple',
      kind: 'primitive',
      sortField: 'name',
      items: [{ value: 'One' }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe('sortField');
  });

  it('rejects an empty item list', () => {
    const result = parseListDocument({ title: 'Empty', kind: 'primitive', items: [] });

    expect(result.ok).toBe(false);
  });

  it('rejects duplicate item ids', () => {
    const result = parseListDocument({
      title: 'Dupes',
      kind: 'primitive',
      items: [
        { id: 'a', value: 'One' },
        { id: 'a', value: 'Two' },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/duplicate/i);
  });

  it('rejects a null payload without throwing', () => {
    const result = parseListDocument(null);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('coerceToListDocument', () => {
  it('turns a bare array of strings into a primitive document', () => {
    const result = coerceToListDocument(['Tacos', 'Ramen'], { title: 'Dinners' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('primitive');
    expect(result.data.title).toBe('Dinners');
    expect(result.data.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('turns a bare array of objects into an object document', () => {
    const result = coerceToListDocument([{ title: 'Arrival', year: 2016 }, { title: 'Alien' }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('object');
    expect(result.data.items[0]?.value).toEqual({ title: 'Arrival', year: 2016 });
  });

  it('preselects an obvious scalar field as the sort field for bare object arrays', () => {
    const result = coerceToListDocument([{ title: 'Arrival', year: 2016 }, { title: 'Alien' }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sortField).toBe('title');
  });

  it('leaves the sort field unset when no obvious candidate exists', () => {
    const result = coerceToListDocument([
      { alpha: 'a', beta: 'b' },
      { alpha: 'c', beta: 'd' },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sortField).toBeUndefined();
  });

  it('rejects an array that mixes strings and objects', () => {
    const result = coerceToListDocument(['One', { title: 'Two' }]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/mix/i);
  });

  it('passes a canonical document through unchanged', () => {
    const result = coerceToListDocument({
      version: 1,
      title: 'Canonical',
      kind: 'primitive',
      items: [{ value: 'One' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Canonical');
  });
});
