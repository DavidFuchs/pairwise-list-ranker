import { describe, expect, it } from 'vitest';

import {
  collectLabelFieldCandidates,
  describeObjectSchema,
  isUsableLabelField,
  preferredLabelField,
} from '@/lib/import/labelField';

const films = [
  { title: 'Arrival', year: 2016, director: 'Denis Villeneuve', cast: ['Amy Adams'] },
  { title: 'Alien', year: 1979, director: 'Ridley Scott', cast: ['Sigourney Weaver'] },
];

describe('collectLabelFieldCandidates', () => {
  it('offers the scalar fields as label candidates', () => {
    expect(collectLabelFieldCandidates(films).map((entry) => entry.field)).toEqual([
      'title',
      'year',
      'director',
    ]);
  });

  it('leaves out arrays and nested objects, which make poor labels', () => {
    const withNested = [{ title: 'Arrival', crew: { director: 'Villeneuve' } }];

    expect(collectLabelFieldCandidates(withNested).map((entry) => entry.field)).toEqual(['title']);
  });

  it('reports full coverage when every item has the field', () => {
    const title = collectLabelFieldCandidates(films).find((entry) => entry.field === 'title');

    expect(title?.coverage).toBe(1);
  });

  it('reports partial coverage when some items lack the field', () => {
    const patchy = [{ title: 'Arrival', year: 2016 }, { title: 'Alien' }];
    const year = collectLabelFieldCandidates(patchy).find((entry) => entry.field === 'year');

    expect(year?.coverage).toBe(0.5);
  });

  it('shows example values so the user can see the resulting labels', () => {
    const title = collectLabelFieldCandidates(films).find((entry) => entry.field === 'title');

    expect(title?.samples).toEqual(['Arrival', 'Alien']);
  });

  it('reports how distinct a field is, since repeated labels rank poorly', () => {
    const repeated = [
      { title: 'Arrival', genre: 'Sci-fi' },
      { title: 'Alien', genre: 'Sci-fi' },
    ];
    const candidates = collectLabelFieldCandidates(repeated);

    expect(candidates.find((entry) => entry.field === 'title')?.uniqueness).toBe(1);
    expect(candidates.find((entry) => entry.field === 'genre')?.uniqueness).toBe(0.5);
  });

  it('has nothing to offer for an empty list', () => {
    expect(collectLabelFieldCandidates([])).toEqual([]);
  });

  it('includes fields that only later items introduce', () => {
    const uneven = [{ title: 'Arrival' }, { title: 'Alien', tagline: 'In space...' }];

    expect(collectLabelFieldCandidates(uneven).map((entry) => entry.field)).toEqual([
      'title',
      'tagline',
    ]);
  });
});

describe('preferredLabelField', () => {
  it('preselects a well-known label field', () => {
    expect(preferredLabelField(collectLabelFieldCandidates(films))).toBe('title');
  });

  it('prefers title over name when both exist', () => {
    const both = [{ name: 'a', title: 'b' }, { name: 'c', title: 'd' }];

    expect(preferredLabelField(collectLabelFieldCandidates(both))).toBe('title');
  });

  it('ignores a well-known field that only some items have', () => {
    const patchy = [{ title: 'Arrival', ref: 'a' }, { ref: 'b' }];

    expect(preferredLabelField(collectLabelFieldCandidates(patchy))).toBe('ref');
  });

  it('ignores a well-known field that is not text', () => {
    const numeric = [{ name: 1, code: 'a' }, { name: 2, code: 'b' }];

    expect(preferredLabelField(collectLabelFieldCandidates(numeric))).toBe('code');
  });

  it('falls back to the only text field that every item has', () => {
    const single = [{ code: 'a', year: 2016 }, { code: 'b', year: 1979 }];

    expect(preferredLabelField(collectLabelFieldCandidates(single))).toBe('code');
  });

  it('asks the user to choose when several text fields compete', () => {
    const ambiguous = [{ alpha: 'a', beta: 'b' }, { alpha: 'c', beta: 'd' }];

    expect(preferredLabelField(collectLabelFieldCandidates(ambiguous))).toBeUndefined();
  });

  it('asks the user to choose when only numbers are available', () => {
    const numeric = [{ year: 2016, rank: 1 }, { year: 1979, rank: 2 }];

    expect(preferredLabelField(collectLabelFieldCandidates(numeric))).toBeUndefined();
  });
});

describe('isUsableLabelField', () => {
  it('accepts a field that at least one item has', () => {
    expect(isUsableLabelField('year', collectLabelFieldCandidates(films))).toBe(true);
  });

  it('rejects a field no item has', () => {
    expect(isUsableLabelField('runtime', collectLabelFieldCandidates(films))).toBe(false);
  });

  it('rejects an undefined choice', () => {
    expect(isUsableLabelField(undefined, collectLabelFieldCandidates(films))).toBe(false);
  });
});

describe('describeObjectSchema', () => {
  it('describes every field, including ones that cannot be labels', () => {
    const schema = describeObjectSchema(films);

    expect(schema.fields.map((entry) => entry.field)).toEqual([
      'title',
      'year',
      'director',
      'cast',
    ]);
  });

  it('records the types seen for each field', () => {
    const mixed = [{ ref: 'a' }, { ref: 2 }];

    expect(describeObjectSchema(mixed).fields[0]?.types).toEqual(['string', 'number']);
  });

  it('marks which fields can serve as a label', () => {
    const schema = describeObjectSchema(films);

    expect(schema.fields.find((entry) => entry.field === 'cast')?.labelCandidate).toBe(false);
    expect(schema.fields.find((entry) => entry.field === 'title')?.labelCandidate).toBe(true);
  });
});
