import { describe, expect, it } from 'vitest';

import {
  TEXT_FORMATS,
  exportFilename,
  mimeTypeFor,
  parseDocument,
  serializeDocument,
} from '@/lib/formats';
import type { TextFormat } from '@/types/list';
import type { ListDocument } from '@/types/workspace';

const doc: ListDocument = {
  version: 1,
  title: 'Favorite sci-fi films',
  kind: 'object',
  sortField: 'title',
  items: [{ value: { title: 'Arrival', year: 2016 } }, { value: { title: 'Alien', year: 1979 } }],
};

describe('serializeDocument', () => {
  it('produces output for every exportable format', () => {
    for (const format of TEXT_FORMATS) {
      expect(serializeDocument(doc, format).length).toBeGreaterThan(0);
    }
  });

  it('dispatches to the format the caller asked for', () => {
    expect(serializeDocument(doc, 'json').startsWith('{')).toBe(true);
    expect(serializeDocument(doc, 'yaml').startsWith('version:')).toBe(true);
    expect(serializeDocument(doc, 'markdown').startsWith('# ')).toBe(true);
  });
});

describe('parseDocument', () => {
  it('round-trips values through every exportable format', () => {
    for (const format of TEXT_FORMATS) {
      const result = parseDocument(serializeDocument(doc, format), format);

      expect(result.ok, `${format} should round-trip`).toBe(true);
      if (!result.ok) continue;
      expect(result.data.items.map((item) => item.value)).toEqual(
        doc.items.map((item) => item.value),
      );
      expect(result.data.sortField).toBe('title');
    }
  });

  it('reports issues instead of throwing for malformed text', () => {
    for (const format of TEXT_FORMATS) {
      const result = parseDocument('%%% not a list %%%', format);

      expect(result.ok, `${format} should reject junk`).toBe(false);
    }
  });
});

describe('exportFilename', () => {
  it('includes the list slug, the date, and the format extension', () => {
    expect(exportFilename(doc, 'yaml', new Date('2026-08-15T12:00:00Z'))).toBe(
      'favorite-sci-fi-films-2026-08-15.yaml',
    );
  });

  it('uses the md extension for Markdown', () => {
    expect(exportFilename(doc, 'markdown', new Date('2026-08-15T12:00:00Z'))).toBe(
      'favorite-sci-fi-films-2026-08-15.md',
    );
  });

  it('collapses punctuation and spacing in the title', () => {
    const messy = { ...doc, title: '  Films: the *best* ones!!  ' };

    expect(exportFilename(messy, 'json', new Date('2026-08-15T12:00:00Z'))).toBe(
      'films-the-best-ones-2026-08-15.json',
    );
  });

  it('falls back to a generic slug when the title has no usable characters', () => {
    const unnamed = { ...doc, title: '!!!' };

    expect(exportFilename(unnamed, 'json', new Date('2026-08-15T12:00:00Z'))).toBe(
      'list-2026-08-15.json',
    );
  });
});

describe('mimeTypeFor', () => {
  it('maps each format to a download-friendly type', () => {
    const types: Record<TextFormat, string> = {
      json: 'application/json',
      yaml: 'application/yaml',
      markdown: 'text/markdown',
    };

    for (const format of TEXT_FORMATS) {
      expect(mimeTypeFor(format)).toBe(types[format]);
    }
  });
});
