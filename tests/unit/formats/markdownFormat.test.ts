import { describe, expect, it } from 'vitest';

import { parseMarkdown, serializeMarkdown } from '@/lib/formats/markdownFormat';
import type { ListDocument } from '@/types/workspace';

const primitiveDoc: ListDocument = {
  version: 1,
  title: 'Weeknight dinners',
  kind: 'primitive',
  items: [{ id: 'item-1', value: 'Tacos' }, { id: 'item-2', value: 'Ramen' }],
};

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

/** Markdown carries values and list metadata; item ids are assigned on import. */
function withoutIds(doc: ListDocument): ListDocument {
  return { ...doc, items: doc.items.map((item) => ({ value: item.value })) };
}

describe('serializeMarkdown', () => {
  it('writes the list title as a top-level heading', () => {
    expect(serializeMarkdown(primitiveDoc).split('\n')[0]).toBe('# Weeknight dinners');
  });

  it('writes a simple list as a bullet list', () => {
    const text = serializeMarkdown(primitiveDoc);

    expect(text).toContain('- Tacos\n- Ramen');
  });

  it('writes the description under the title', () => {
    expect(serializeMarkdown(objectDoc)).toContain('Personal ranking list');
  });

  it('writes the kind and sort field for object lists', () => {
    const text = serializeMarkdown(objectDoc);

    expect(text).toContain('Kind: object');
    expect(text).toContain('Sort field: title');
  });

  it('writes one yaml block per object item, labelled by the sort field', () => {
    const text = serializeMarkdown(objectDoc);

    expect(text).toContain('## Arrival\n\n```yaml\ntitle: Arrival\nyear: 2016');
  });

  it('escapes newlines in simple values so every item stays on one bullet', () => {
    const text = serializeMarkdown({
      ...primitiveDoc,
      items: [{ value: 'Line one\nLine two' }],
    });

    expect(text).toContain('- Line one\\nLine two');
  });

  it('lengthens the fence when an object value contains a code fence', () => {
    const text = serializeMarkdown({
      ...objectDoc,
      items: [{ value: { title: 'Snippet', body: 'see ```code``` here' } }],
    });

    expect(text).toContain('````yaml');
  });
});

describe('parseMarkdown', () => {
  it('parses a plain bullet list into a simple list', () => {
    const result = parseMarkdown('# Dinners\n\n- Tacos\n- Ramen\n');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('primitive');
    expect(result.data.title).toBe('Dinners');
    expect(result.data.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('accepts asterisk bullets as well as dashes', () => {
    const result = parseMarkdown('# Dinners\n\n* Tacos\n* Ramen\n');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('unescapes newlines in simple values', () => {
    const result = parseMarkdown('# Dinners\n\n- Line one\\nLine two\n');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]?.value).toBe('Line one\nLine two');
  });

  it('reads a paragraph under the title as the description', () => {
    const result = parseMarkdown('# Dinners\n\nWhat we actually cook.\n\n- Tacos\n');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.description).toBe('What we actually cook.');
  });

  it('parses object sections with yaml blocks', () => {
    const result = parseMarkdown(
      '# Films\n\nKind: object\nSort field: title\n\n## Arrival\n\n```yaml\ntitle: Arrival\nyear: 2016\n```\n',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('object');
    expect(result.data.sortField).toBe('title');
    expect(result.data.items[0]?.value).toEqual({ title: 'Arrival', year: 2016 });
  });

  it('infers an object list from yaml sections when the metadata is missing', () => {
    const result = parseMarkdown('# Films\n\n## Arrival\n\n```yaml\ntitle: Arrival\n```\n');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe('object');
  });

  it('rejects text with no title heading, pointing at the first line', () => {
    const result = parseMarkdown('Dinners\n\n- Tacos\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(1);
    expect(result.issues[0]?.message).toMatch(/# /);
  });

  it('rejects a section with no yaml block, pointing at the heading', () => {
    const result = parseMarkdown('# Films\n\n## Arrival\n\nNo block here.\n\n## Alien\n\n```yaml\ntitle: Alien\n```\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(3);
  });

  it('rejects a yaml block that is not a mapping', () => {
    const result = parseMarkdown('# Films\n\n## Arrival\n\n```yaml\n- just\n- a list\n```\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/object/i);
  });

  it('reports invalid yaml with a line number in the whole document', () => {
    const result = parseMarkdown('# Films\n\n## Arrival\n\n```yaml\ntitle: "unterminated\n```\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(6);
  });

  it('rejects a document that mixes bullets and object sections', () => {
    const result = parseMarkdown('# Films\n\n- Tacos\n\n## Arrival\n\n```yaml\ntitle: Arrival\n```\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/mix/i);
  });

  it('rejects a document with no items', () => {
    const result = parseMarkdown('# Films\n\nJust a description.\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/no items/i);
  });

  it('rejects empty input with a readable message', () => {
    const result = parseMarkdown('  \n\n');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/empty/i);
  });

  it('tolerates a byte order mark and CRLF line endings from pasted text', () => {
    const result = parseMarkdown('﻿# Dinners\r\n\r\n- Tacos\r\n');

    expect(result.ok).toBe(true);
  });
});

describe('markdown round-trip', () => {
  it('round-trips a simple list', () => {
    const result = parseMarkdown(serializeMarkdown(primitiveDoc));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(withoutIds(primitiveDoc));
  });

  it('round-trips an object list including fields that are not the sort field', () => {
    const result = parseMarkdown(serializeMarkdown(objectDoc));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(withoutIds(objectDoc));
  });

  it('round-trips a value containing a code fence', () => {
    const doc: ListDocument = {
      ...objectDoc,
      description: undefined,
      items: [{ value: { title: 'Snippet', body: 'see ```code``` here' } }],
    };

    const result = parseMarkdown(serializeMarkdown(doc));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]?.value).toEqual({ title: 'Snippet', body: 'see ```code``` here' });
  });
});
