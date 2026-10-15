import { describe, expect, it } from 'vitest';

import {
  dragInsertIndex,
  gapMovesRow,
  insertIndexFor,
  insertIndexForUniform,
  moveItem,
  targetIndexForGap,
} from '@/lib/ranking/reorder';
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

describe('insertIndexFor', () => {
  it('puts the line above everything when the pointer is above the list', () => {
    expect(insertIndexFor(offsets, -20)).toBe(0);
  });

  it('puts the line below everything when the pointer is past the end', () => {
    expect(insertIndexFor(offsets, 999)).toBe(4);
  });

  it('keeps the line above a row until the pointer passes its midpoint', () => {
    expect(insertIndexFor(offsets, 15)).toBe(0);
    expect(insertIndexFor(offsets, 25)).toBe(1);
  });

  it('respects the midpoint of a taller row', () => {
    expect(insertIndexFor(offsets, 105)).toBe(2);
    expect(insertIndexFor(offsets, 115)).toBe(3);
  });

  it('has one gap for an empty list', () => {
    expect(insertIndexFor([], 50)).toBe(0);
  });
});

describe('dragInsertIndex', () => {
  // Either gap touching the row means "no move"; gapMovesRow rejects both.
  it('reports a gap touching the row before the pointer has moved', () => {
    const gap = dragInsertIndex(offsets, 0, 0);

    expect(gapMovesRow(0, gap)).toBe(false);
  });

  it('moves down as the pointer passes each midpoint', () => {
    // Row 0's centre starts at 20; +45 puts it at 65, past row 1's midpoint of 60.
    expect(dragInsertIndex(offsets, 0, 45)).toBe(2);
  });

  it('moves up when dragged back', () => {
    expect(dragInsertIndex(offsets, 3, -80)).toBe(2);
  });

  it('reaches the end on a long drag down', () => {
    expect(dragInsertIndex(offsets, 0, 500)).toBe(4);
  });

  it('reaches the start on a long drag up', () => {
    expect(dragInsertIndex(offsets, 3, -500)).toBe(0);
  });

  /**
   * The bug this guards: rows are measured in content space, pointers report
   * viewport space. Feeding a raw viewport y in sent every drag to the end.
   */
  it('is driven by the delta, not by an absolute pointer position', () => {
    expect(dragInsertIndex(offsets, 0, 0)).not.toBe(offsets.length);
  });

  it('leaves an unknown row where it is', () => {
    expect(dragInsertIndex(offsets, 9, 100)).toBe(9);
  });
});

describe('targetIndexForGap', () => {
  it('keeps the gap when moving up', () => {
    expect(targetIndexForGap(3, 1)).toBe(1);
  });

  it('closes the hole the row leaves when moving down', () => {
    expect(targetIndexForGap(0, 3)).toBe(2);
  });

  it('moves a row to the end', () => {
    expect(targetIndexForGap(0, 4)).toBe(3);
  });
});

describe('gapMovesRow', () => {
  it('ignores the gaps either side of the row itself', () => {
    expect(gapMovesRow(1, 1)).toBe(false);
    expect(gapMovesRow(1, 2)).toBe(false);
  });

  it('reports a real move', () => {
    expect(gapMovesRow(1, 0)).toBe(true);
    expect(gapMovesRow(1, 3)).toBe(true);
  });
});

describe('insertIndexForUniform', () => {
  const H = 56;
  const pitch = 60;

  it('agrees with measuring every row', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ y: 10 + i * pitch, height: H }));
    for (const pointer of [-50, 0, 37, 38, 39, 300, 1234, 5990, 6100, 9999]) {
      // Only rows 40..60 are "mounted"; the first of them is measured.
      expect(insertIndexForUniform(100, 40, rows[40]!.y, H, pitch, pointer)).toBe(
        insertIndexFor(rows, pointer),
      );
    }
  });
});
