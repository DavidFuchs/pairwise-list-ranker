import { describe, expect, it } from 'vitest';

import { parseJson, serializeJson } from '@/lib/formats/jsonFormat';
import type { ListDocument } from '@/types/workspace';

const objectDoc: ListDocument = {
  version: 1,
  title: 'Favorite sci-fi films',
  description: 'Personal ranking list',
  kind: 'object',
  sortField: 'title',
  items: [
    { id: 'item-1', value: { title: 'Arrival', year: 2016, director: 'Denis Villeneuve' } },
    { id: 'item-2', value: { title: 'Alien', year: 1979 } },
  ],
};

describe('serializeJson', () => {
  it('emits indented, human-editable JSON', () => {
    const text = serializeJson(objectDoc);

    expect(text).toContain('\n  "title": "Favorite sci-fi films"');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('parseJson', () => {
  it('round-trips an object document without losing hidden fields', () => {
    const result = parseJson(serializeJson(objectDoc));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(objectDoc);
  });

  it('accepts a bare array of strings as a simple list', () => {
    const result = parseJson('["Tacos", "Ramen"]', { title: 'Dinners' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('primitive');
    expect(result.data.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('accepts a bare array of objects as an object list', () => {
    const result = parseJson('[{"title":"Arrival"},{"title":"Alien"}]');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('object');
    expect(result.data.sortField).toBe('title');
  });

  it('reports a syntax error with the line it happened on', () => {
    const result = parseJson('{\n  "title": "Broken",\n  items: []\n}');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(3);
  });

  it('reports a schema error rather than throwing', () => {
    const result = parseJson('{"kind":"primitive","items":[{"value":"One"}]}');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path)).toContain('title');
  });

  it('rejects empty input with a readable message', () => {
    const result = parseJson('   ');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/empty/i);
  });

  it('tolerates a byte order mark and CRLF line endings from pasted text', () => {
    const result = parseJson('﻿{\r\n"title":"T",\r\n"kind":"primitive",\r\n"items":[{"value":"One"}]\r\n}');

    expect(result.ok).toBe(true);
  });
});
