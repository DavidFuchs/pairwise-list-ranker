import { describe, expect, it } from 'vitest';

import { exportFilename, extensionFor, mimeTypeFor, slugify } from '@/lib/export/filenames';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Favorite Sci-Fi Films')).toBe('favorite-sci-fi-films');
  });

  it('strips punctuation and collapses runs', () => {
    expect(slugify('  Best!! films???  ')).toBe('best-films');
  });

  it('falls back for a name with nothing usable', () => {
    expect(slugify('!!!')).toBe('list');
  });
});

describe('exportFilename', () => {
  it('joins slug, date, and extension', () => {
    expect(exportFilename('Sci-fi films', 'yaml', new Date('2026-08-16T12:00:00.000Z'))).toBe(
      'sci-fi-films-2026-08-16.yaml',
    );
  });

  it('uses txt for a plain list', () => {
    expect(exportFilename('Sci-fi films', 'list', new Date('2026-08-16T12:00:00.000Z'))).toBe(
      'sci-fi-films-2026-08-16.txt',
    );
  });
});

describe('extensionFor and mimeTypeFor', () => {
  it('maps every format', () => {
    expect(extensionFor('json')).toBe('json');
    expect(extensionFor('yaml')).toBe('yaml');
    expect(extensionFor('list')).toBe('txt');
    expect(mimeTypeFor('json')).toBe('application/json');
    expect(mimeTypeFor('yaml')).toBe('application/yaml');
    expect(mimeTypeFor('list')).toBe('text/plain');
  });
});
