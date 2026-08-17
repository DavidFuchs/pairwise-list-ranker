import { describe, expect, it } from 'vitest';

import { entriesAtPath, findArrayCandidates, formatPath } from '@/lib/import/arrayCandidates';

const nested = {
  version: 3,
  owner: 'david',
  movies: [
    { title: 'Alien', year: 1979, tags: ['horror', 'space'] },
    { title: 'Arrival', year: 2016, tags: ['drama'] },
  ],
  actors: ['Sigourney Weaver', 'Amy Adams'],
};

describe('findArrayCandidates', () => {
  it('finds arrays of objects', () => {
    const { candidates } = findArrayCandidates(nested);
    const movies = candidates.find((entry) => entry.path.join('.') === 'movies');

    expect(movies).toMatchObject({ count: 2, entryKind: 'object' });
  });

  it('finds arrays of scalars', () => {
    const { candidates } = findArrayCandidates(nested);
    const actors = candidates.find((entry) => entry.path.join('.') === 'actors');

    expect(actors).toMatchObject({ count: 2, entryKind: 'scalar' });
  });

  it('never descends into array elements', () => {
    const { candidates } = findArrayCandidates(nested);

    expect(candidates.map((entry) => entry.path.join('.'))).toEqual(['movies', 'actors']);
  });

  it('finds arrays nested inside plain objects', () => {
    const { candidates } = findArrayCandidates({ data: { results: [{ a: 1 }, { a: 2 }] } });

    expect(candidates[0]?.path).toEqual(['data', 'results']);
  });

  it('treats a bare array document as the only candidate, with an empty path', () => {
    const { candidates } = findArrayCandidates(['Alien', 'Arrival']);

    expect(candidates).toEqual([
      { path: [], count: 2, entryKind: 'scalar', samples: ['Alien', 'Arrival'] },
    ]);
  });

  it('skips arrays with fewer than two entries', () => {
    expect(findArrayCandidates({ only: [{ a: 1 }] }).candidates).toEqual([]);
  });

  it('skips arrays that mix scalars and objects, and says why', () => {
    const { candidates, warnings } = findArrayCandidates({
      mixed: ['Alien', { title: 'Arrival' }],
    });

    expect(candidates).toEqual([]);
    expect(warnings[0]).toMatch(/mixed/);
    expect(warnings[0]).toMatch(/mixes text and objects/i);
  });

  it('stops descending past five levels', () => {
    const deep = { a: { b: { c: { d: { e: { f: [1, 2] } } } } } };

    expect(findArrayCandidates(deep).candidates).toEqual([]);
  });

  it('samples up to three entries for the preview', () => {
    const { candidates } = findArrayCandidates({ many: ['a', 'b', 'c', 'd', 'e'] });

    expect(candidates[0]?.samples).toEqual(['a', 'b', 'c']);
  });

  it('samples an object entry by its first text field', () => {
    const { candidates } = findArrayCandidates(nested);
    const movies = candidates.find((entry) => entry.path.join('.') === 'movies');

    expect(movies?.samples).toEqual(['Alien', 'Arrival']);
  });

  it('finds nothing in a document with no arrays', () => {
    expect(findArrayCandidates({ owner: 'david' }).candidates).toEqual([]);
  });
});

describe('entriesAtPath', () => {
  it('reads a nested array', () => {
    expect(entriesAtPath(nested, ['movies'])).toHaveLength(2);
  });

  it('reads the document itself for an empty path', () => {
    expect(entriesAtPath(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('returns nothing when the path misses', () => {
    expect(entriesAtPath(nested, ['nope'])).toEqual([]);
  });
});

describe('formatPath', () => {
  it('names a nested path', () => {
    expect(formatPath(['data', 'results'])).toBe('data.results');
  });

  it('names the document itself', () => {
    expect(formatPath([])).toBe('the list');
  });
});
