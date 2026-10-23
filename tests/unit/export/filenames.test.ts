import { describe, expect, it } from 'vitest';

import { exportFilename, extensionFor, mimeTypeFor, sessionFilename } from '@/lib/export/filenames';

describe('exportFilename', () => {
  it('is pairwise, the date, and the extension', () => {
    expect(exportFilename('yaml', new Date('2026-08-16T12:00:00.000Z'))).toBe('pairwise-2026-08-16.yaml');
  });

  it('uses txt for a plain list', () => {
    expect(exportFilename('list', new Date('2026-08-16T12:00:00.000Z'))).toBe('pairwise-2026-08-16.txt');
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

describe('sessionFilename', () => {
  it('is pairwise-session and the date', () => {
    expect(sessionFilename(new Date('2026-08-16T12:00:00.000Z'))).toBe('pairwise-session-2026-08-16.json');
  });
});
