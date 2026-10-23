import { describe, expect, it } from 'vitest';

import {
  describeSort,
  detectSortFields,
  orderBySortField,
  parseSortValue,
  sortDirectionLabels,
} from '@/lib/import/sortField';

describe('parseSortValue', () => {
  it('passes finite numbers through for the number kind', () => {
    expect(parseSortValue(9.2, 'number')).toBe(9.2);
    expect(parseSortValue(0, 'number')).toBe(0);
  });

  it('reads numeric strings, allowing sign, decimals and surrounding space', () => {
    expect(parseSortValue('9.2', 'number')).toBe(9.2);
    expect(parseSortValue(' 7 ', 'number')).toBe(7);
    expect(parseSortValue('-3', 'number')).toBe(-3);
    expect(parseSortValue('+4', 'number')).toBe(4);
  });

  it('rejects thousands separators and other junk', () => {
    expect(parseSortValue('1,234', 'number')).toBeNull();
    expect(parseSortValue('', 'number')).toBeNull();
    expect(parseSortValue('   ', 'number')).toBeNull();
    expect(parseSortValue('abc', 'number')).toBeNull();
    expect(parseSortValue('12px', 'number')).toBeNull();
    expect(parseSortValue(true, 'number')).toBeNull();
    expect(parseSortValue([], 'number')).toBeNull();
    expect(parseSortValue({}, 'number')).toBeNull();
    expect(parseSortValue(null, 'number')).toBeNull();
    expect(parseSortValue(undefined, 'number')).toBeNull();
    expect(parseSortValue(NaN, 'number')).toBeNull();
    expect(parseSortValue(Infinity, 'number')).toBeNull();
  });

  it('reads ISO-style dates for the date kind', () => {
    expect(parseSortValue('2024-05-13', 'date')).toBe(Date.parse('2024-05-13'));
    expect(parseSortValue('2024-05-13T10:00:00Z', 'date')).toBe(Date.parse('2024-05-13T10:00:00Z'));
  });

  it('rejects non-ISO dates and impossible ones', () => {
    expect(parseSortValue('13/05/2024', 'date')).toBeNull();
    expect(parseSortValue('May 13, 2024', 'date')).toBeNull();
    expect(parseSortValue('2024-13-45', 'date')).toBeNull();
  });

  it('refuses dates that are not on the calendar', () => {
    expect(parseSortValue('2024-02-30', 'date')).toBeNull();
    expect(parseSortValue('2024-04-31', 'date')).toBeNull();
    expect(parseSortValue('2023-02-29', 'date')).toBeNull();
    expect(parseSortValue('2024-02-29', 'date')).toBe(Date.UTC(2024, 1, 29));
    expect(parseSortValue('2024-02-30T10:00', 'date')).toBeNull();
  });

  it('reads a time with no zone as UTC, like a date alone, whatever the device zone', () => {
    const evening = parseSortValue('2024-05-12T22:00', 'date');
    expect(evening).toBe(Date.UTC(2024, 4, 12, 22, 0));
    expect(parseSortValue('2024-05-12T22:00:30.5', 'date')).toBe(Date.UTC(2024, 4, 12, 22, 0, 30, 500));
    expect(evening!).toBeLessThan(parseSortValue('2024-05-13', 'date')!);
    expect(parseSortValue('2024-05-12T22:00+02:00', 'date')).toBe(Date.UTC(2024, 4, 12, 20, 0));
  });

  it('gives null for a value of the other kind', () => {
    expect(parseSortValue(5, 'date')).toBeNull();
    expect(parseSortValue('2024-05-13', 'number')).toBeNull();
    expect(parseSortValue(true, 'date')).toBeNull();
  });
});

describe('detectSortFields', () => {
  it('finds a number field', () => {
    const entries = [{ plays: 10 }, { plays: 3 }, { plays: 7 }];
    expect(detectSortFields(entries)).toEqual([{ field: 'plays', kind: 'number' }]);
  });

  it('finds a numeric-string field', () => {
    const entries = [{ score: '9.2' }, { score: '7' }, { score: ' 8.5 ' }];
    expect(detectSortFields(entries)).toEqual([{ field: 'score', kind: 'number' }]);
  });

  it('finds a date field', () => {
    const entries = [{ added: '2024-01-02' }, { added: '2023-05-06T10:00:00Z' }, { added: '2022-03-04' }];
    expect(detectSortFields(entries)).toEqual([{ field: 'added', kind: 'date' }]);
  });

  it('takes the kind of the first parsed value, so the other kind counts as missing', () => {
    const entries = [{ v: 5 }, { v: '2024-01-02' }, { v: 9 }];
    expect(detectSortFields(entries)).toEqual([{ field: 'v', kind: 'number' }]);
    const dates = [{ v: 'junk' }, { v: '2024-01-02' }, { v: 4 }, { v: '2025-01-02' }];
    expect(detectSortFields(dates)).toEqual([{ field: 'v', kind: 'date' }]);
  });

  it('rejects a text field', () => {
    expect(detectSortFields([{ t: 'a' }, { t: 'b' }, { t: 'c' }])).toEqual([]);
  });

  it('rejects a field whose parsed values are all equal', () => {
    expect(detectSortFields([{ n: 4 }, { n: '4' }, { n: 4 }])).toEqual([]);
  });

  it('accepts exactly half parsed and rejects one fewer', () => {
    const half = [{ n: 1 }, { n: 2 }, { n: 'x' }, {}];
    expect(detectSortFields(half)).toEqual([{ field: 'n', kind: 'number' }]);
    const fewer = [{ n: 1 }, { n: 2 }, { n: 'x' }, {}, {}];
    expect(detectSortFields(fewer)).toEqual([]);
  });

  it('counts non-object entries in the total but never reads them', () => {
    const entries = [{ n: 1 }, { n: 2 }, 'text', 7];
    expect(detectSortFields(entries)).toEqual([{ field: 'n', kind: 'number' }]);
    expect(detectSortFields([{ n: 1 }, { n: 2 }, 'a', 'b', 'c'])).toEqual([]);
  });

  it('lists fields in first-seen order', () => {
    const entries = [
      { b: 1, a: 1 },
      { b: 2, a: 2 },
    ];
    expect(detectSortFields(entries).map((c) => c.field)).toEqual(['b', 'a']);
  });

  it('gives nothing for an empty list', () => {
    expect(detectSortFields([])).toEqual([]);
  });
});

describe('orderBySortField', () => {
  const entries = [{ n: 3 }, { n: 9 }, { n: 1 }, { n: 5 }];

  it('ranks high to low for desc and low to high for asc', () => {
    expect(orderBySortField(entries, { field: 'n', direction: 'desc' })).toEqual([1, 3, 0, 2]);
    expect(orderBySortField(entries, { field: 'n', direction: 'asc' })).toEqual([2, 0, 3, 1]);
  });

  it('keeps original order among ties in both directions', () => {
    const tied = [{ n: 2 }, { n: 5 }, { n: 2 }, { n: 5 }];
    expect(orderBySortField(tied, { field: 'n', direction: 'desc' })).toEqual([1, 3, 0, 2]);
    expect(orderBySortField(tied, { field: 'n', direction: 'asc' })).toEqual([0, 2, 1, 3]);
  });

  it('orders dates, newest first for desc', () => {
    const dated = [{ d: '2023-01-01' }, { d: '2025-01-01' }, { d: '2024-01-01' }];
    expect(orderBySortField(dated, { field: 'd', direction: 'desc' })).toEqual([1, 2, 0]);
    expect(orderBySortField(dated, { field: 'd', direction: 'asc' })).toEqual([0, 2, 1]);
  });

  it('puts the unparsed block after half of an even parsed count', () => {
    const list = [{ n: 1 }, {}, { n: 4 }, { n: 3 }, { n: 2 }, 'junk'];
    // parsed desc: 2 (4), 3 (3), 4 (2), 0 (1); block [1, 5] after two
    expect(orderBySortField(list, { field: 'n', direction: 'desc' })).toEqual([2, 3, 1, 5, 4, 0]);
  });

  it('puts the unparsed block after the floor of half of an odd parsed count', () => {
    const list = [{ n: 1 }, {}, { n: 3 }, { n: 2 }, { n: 'x' }];
    // parsed desc: 2, 3, 0; floor(3/2) = 1
    expect(orderBySortField(list, { field: 'n', direction: 'desc' })).toEqual([2, 1, 4, 3, 0]);
  });

  it('puts the block first when only one entry parses', () => {
    const list = [{ n: 1 }, {}, {}];
    expect(orderBySortField(list, { field: 'n', direction: 'desc' })).toEqual([1, 2, 0]);
  });

  it('returns the identity order when nothing parses', () => {
    const list = [{ n: 'a' }, {}, 'x'];
    expect(orderBySortField(list, { field: 'n', direction: 'desc' })).toEqual([0, 1, 2]);
    expect(orderBySortField(list, { field: 'missing', direction: 'asc' })).toEqual([0, 1, 2]);
  });

  it('handles a field absent from some entries and non-object entries', () => {
    const list = [{ n: 2 }, 'text', { other: 1 }, { n: 8 }];
    // parsed desc: 3, 0; floor(2/2) = 1; block [1, 2]
    expect(orderBySortField(list, { field: 'n', direction: 'desc' })).toEqual([3, 1, 2, 0]);
  });

  it('returns an empty order for an empty list', () => {
    expect(orderBySortField([], { field: 'n', direction: 'desc' })).toEqual([]);
  });

  it('lets the first parsed value set the kind, and counts a value of the other kind as unparsed', () => {
    const entries = [{ v: '2024-01-01' }, { v: 5 }, { v: '2025-01-01' }, { v: '2023-01-01' }];

    // Dates win; the number is unparsed and goes in the middle block.
    expect(orderBySortField(entries, { field: 'v', direction: 'desc' })).toEqual([2, 1, 0, 3]);
  });
});

describe('sortDirectionLabels and describeSort', () => {
  it('names the directions for numbers and dates', () => {
    expect(sortDirectionLabels('number')).toEqual({ desc: 'High to low', asc: 'Low to high' });
    expect(sortDirectionLabels('date')).toEqual({ desc: 'Newest first', asc: 'Oldest first' });
  });

  it('describes a sort in lower case', () => {
    expect(describeSort({ field: 'plays', direction: 'desc' }, 'number')).toBe(
      'sorted by plays, high to low',
    );
    expect(describeSort({ field: 'plays', direction: 'asc' }, 'number')).toBe('sorted by plays, low to high');
    expect(describeSort({ field: 'added', direction: 'desc' }, 'date')).toBe('sorted by added, newest first');
    expect(describeSort({ field: 'added', direction: 'asc' }, 'date')).toBe('sorted by added, oldest first');
  });
});
