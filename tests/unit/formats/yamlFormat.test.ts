import { describe, expect, it } from 'vitest';

import { parseYaml, serializeYaml } from '@/lib/formats/yamlFormat';
import type { ListDocument } from '@/types/workspace';

const objectDoc: ListDocument = {
  version: 1,
  title: 'Favorite sci-fi films',
  kind: 'object',
  sortField: 'title',
  items: [
    { id: 'item-1', value: { title: 'Arrival', year: 2016 } },
    { id: 'item-2', value: { title: 'Alien', year: 1979 } },
  ],
};

describe('serializeYaml', () => {
  it('emits the canonical keys in a readable order', () => {
    const text = serializeYaml(objectDoc);

    expect(text.split('\n')[0]).toBe('version: 1');
    expect(text).toContain('title: Favorite sci-fi films');
    expect(text).toContain('sortField: title');
  });
});

describe('parseYaml', () => {
  it('round-trips an object document', () => {
    const result = parseYaml(serializeYaml(objectDoc));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(objectDoc);
  });

  it('accepts a bare sequence of strings as a simple list', () => {
    const result = parseYaml('- Tacos\n- Ramen\n', { title: 'Dinners' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('primitive');
    expect(result.data.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('accepts a bare sequence of mappings as an object list', () => {
    const result = parseYaml('- title: Arrival\n  year: 2016\n- title: Alien\n');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('object');
    expect(result.data.items[0]?.value).toEqual({ title: 'Arrival', year: 2016 });
  });

  it('reports a syntax error with the line it happened on', () => {
    const result = parseYaml('title: Broken\nitems:\n  - value: "unterminated\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBeGreaterThan(0);
  });

  it('rejects empty input with a readable message', () => {
    const result = parseYaml('\n\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/empty/i);
  });

  it('tolerates a byte order mark and CRLF line endings from pasted text', () => {
    const result = parseYaml('﻿- Tacos\r\n- Ramen\r\n');

    expect(result.ok).toBe(true);
  });
});
