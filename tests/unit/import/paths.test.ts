import { describe, expect, it } from 'vitest';

import { pathKey, samePath } from '@/lib/import/paths';

describe('pathKey', () => {
  it('keeps a dotted key apart from the path it reads like', () => {
    expect(pathKey(['a.b'])).not.toBe(pathKey(['a', 'b']));
  });

  it('keys a one-segment path as the segment itself', () => {
    expect(pathKey(['movies'])).toBe('movies');
  });
});

describe('samePath', () => {
  it('compares segment by segment', () => {
    expect(samePath(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(samePath(['a.b'], ['a', 'b'])).toBe(false);
    expect(samePath([], [])).toBe(true);
    expect(samePath(['a'], ['a', 'b'])).toBe(false);
  });
});
