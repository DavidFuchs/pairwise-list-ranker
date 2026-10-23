import { describe, expect, it } from 'vitest';

import { detectPositionFields, preferredPositionField } from '@/lib/import/positionField';

const ranked = [
  { title: 'Alien', year: 1979, order: 2 },
  { title: 'Arrival', year: 2016, order: 1 },
];

describe('detectPositionFields', () => {
  it('offers every field that is numeric everywhere it appears', () => {
    expect(detectPositionFields(ranked).map((entry) => entry.field)).toEqual(['year', 'order']);
  });

  it('leaves out text fields', () => {
    expect(detectPositionFields(ranked).some((entry) => entry.field === 'title')).toBe(false);
  });

  it('leaves out fields that are numeric in only some entries', () => {
    expect(detectPositionFields([{ rank: 1 }, { rank: 'first' }])).toEqual([]);
  });

  it('offers a field only some entries carry, as long as it is always numeric', () => {
    const partial = [{ title: 'Alien', order: 2 }, { title: 'Arrival' }];

    expect(detectPositionFields(partial).map((entry) => entry.field)).toEqual(['order']);
  });

  it('marks well-known ordering names as suggested', () => {
    const byField = new Map(detectPositionFields(ranked).map((entry) => [entry.field, entry]));

    expect(byField.get('order')?.suggested).toBe(true);
    expect(byField.get('year')?.suggested).toBe(false);
  });

  it('recognises rank, position, index, sort, priority, seq, and sequence', () => {
    const entries = [
      { rank: 1, position: 1, index: 1, sort: 1, priority: 1, seq: 1, sequence: 1 },
      { rank: 2, position: 2, index: 2, sort: 2, priority: 2, seq: 2, sequence: 2 },
    ];

    expect(detectPositionFields(entries).every((entry) => entry.suggested)).toBe(true);
  });

  it('offers nothing for scalar entries, which have nowhere to write', () => {
    expect(detectPositionFields(['Alien', 'Arrival'])).toEqual([]);
  });
});

describe('preferredPositionField', () => {
  it('picks a suggested field', () => {
    expect(preferredPositionField(ranked)).toBe('order');
  });

  it('picks nothing when no name looks like an ordering', () => {
    expect(preferredPositionField([{ year: 1979 }, { year: 2016 }])).toBeUndefined();
  });
});
