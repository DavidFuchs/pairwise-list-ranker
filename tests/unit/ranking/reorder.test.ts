import { describe, expect, it } from 'vitest';

import { dropIndexFor, moveItem } from '@/lib/ranking/reorder';
import type { RowOffset } from '@/lib/ranking/reorder';

const ids = ['a', 'b', 'c', 'd'];

describe('moveItem', () => {
  it('moves an item later', () => {
    expect(moveItem(ids, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier', () => {
    expect(moveItem(ids, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves an item to the front', () => {
    expect(moveItem(ids, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves an item to the end', () => {
    expect(moveItem(ids, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns an equal list when nothing moves', () => {
    expect(moveItem(ids, 2, 2)).toEqual(ids);
  });

  it('does not mutate the input', () => {
    const input = [...ids];
    moveItem(input, 0, 3);

    expect(input).toEqual(ids);
  });

  it('clamps indexes past the end', () => {
    expect(moveItem(ids, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('clamps negative indexes', () => {
    expect(moveItem(ids, 3, -5)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('ignores a source index that does not exist', () => {
    expect(moveItem(ids, 9, 0)).toEqual(ids);
  });
});

const offsets: RowOffset[] = [
  { y: 0, height: 40 },
  { y: 40, height: 40 },
  { y: 80, height: 60 },
  { y: 140, height: 40 },
];

describe('dropIndexFor', () => {
  it('lands on the first row above everything', () => {
    expect(dropIndexFor(offsets, -20)).toBe(0);
  });

  it('lands on the last row below everything', () => {
    expect(dropIndexFor(offsets, 999)).toBe(3);
  });

  it('stays on a row above its midpoint', () => {
    expect(dropIndexFor(offsets, 45)).toBe(1);
  });

  it('moves to the next row past a midpoint', () => {
    expect(dropIndexFor(offsets, 75)).toBe(2);
  });

  it('respects the midpoint of a taller row', () => {
    expect(dropIndexFor(offsets, 105)).toBe(2);
    expect(dropIndexFor(offsets, 115)).toBe(3);
  });

  it('returns 0 for an empty list', () => {
    expect(dropIndexFor([], 50)).toBe(0);
  });
});
