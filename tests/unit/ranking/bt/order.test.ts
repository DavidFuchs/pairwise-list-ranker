import { describe, expect, it } from 'vitest';

import { band, displayedOrder, TieOrder } from '@/lib/ranking/bt/order';

describe('band', () => {
  it('rounds to the 1e-6 grid', () => {
    expect(band(0.4e-6)).toBe(0);
    expect(band(0.6e-6)).toBe(1);
    expect(band(-0.6e-6)).toBe(-1);
  });
});

describe('displayedOrder', () => {
  it('evidence-free slots display in arrival order', () => {
    const tie = new TieOrder([0, 1, 2, 3]);
    expect(displayedOrder([3, 1, 0, 2], new Float64Array(4), tie)).toEqual([0, 1, 2, 3]);
  });

  it('head-to-head plays no part: equal strengths display by tie order only', () => {
    const tie = new TieOrder([0, 1, 2]);
    tie.splice(2, undefined, 0, new Float64Array(3));
    expect(displayedOrder([0, 1, 2], new Float64Array(3), tie)).toEqual([2, 0, 1]);
  });

  it('sorts higher bands first and does not mutate its input', () => {
    const input = [0, 1, 2];
    const result = displayedOrder(input, Float64Array.from([1, 3, 2]), new TieOrder([0, 1, 2]));
    expect(result).toEqual([1, 2, 0]);
    expect(input).toEqual([0, 1, 2]);
  });
});

describe('TieOrder', () => {
  it('starts in the order it is given, the import order', () => {
    const tie = new TieOrder([0, 1, 2, 3]);
    expect(displayedOrder([3, 2, 1, 0], new Float64Array(4), tie)).toEqual([0, 1, 2, 3]);
    expect(tie.position(3)).toBe(3);
  });

  it('clone is independent', () => {
    const tie = new TieOrder([0, 1, 2]);
    const copy = tie.clone();
    tie.splice(2, undefined, 0, new Float64Array(3));
    expect(copy.position(2)).toBe(2);
    expect(tie.position(2)).toBe(0);
  });

  it('does nothing when both neighbours are absent', () => {
    const tie = new TieOrder([0, 1, 2]);
    tie.splice(2, undefined, undefined, new Float64Array(3));
    expect(tie.position(2)).toBe(2);
  });
});

describe('tied placement (docs/ARCHITECTURE.md 11)', () => {
  const all = [0, 1, 2, 3, 4];
  const show = (tie: TieOrder, s: Float64Array) => displayedOrder(all, s, tie);

  /**
   * Drops `item` between `upper` and `lower` as a placement records it: the two
   * are adjacent in the display of the other rows first. Returns the new display.
   */
  function drop(
    tie: TieOrder,
    s: Float64Array,
    item: number,
    upper: number | undefined,
    lower: number | undefined,
  ): number[] {
    const others = displayedOrder(
      all.filter((slot) => slot !== item),
      s,
      tie,
    );
    if (upper !== undefined) expect(others[others.indexOf(upper) + 1]).toBe(lower);
    else expect(others[0]).toBe(lower);
    if (lower === undefined) expect(others[others.length - 1]).toBe(upper);

    tie.splice(item, upper, lower, s);
    const shown = show(tie, s);
    const at = shown.indexOf(item);
    expect(shown[at - 1]).toBe(upper);
    expect(shown[at + 1]).toBe(lower);
    return shown;
  }

  it('item sharing the upper neighbour band goes directly after it', () => {
    // Upper 2 is in the high band; lower 0 is lower and earlier in the tie order, so
    // "before the lower neighbour" would wrongly put the item above the upper one.
    const s = Float64Array.from([0, 0, 5, 0, 5]);
    expect(drop(new TieOrder(all), s, 4, 2, 0)).toEqual([2, 4, 0, 1, 3]);
  });

  it('item sharing only the lower neighbour band goes directly before it', () => {
    // Upper 3 is in the high band. Lower 1 leads its band in the tie order, so it sits
    // right below the upper one; "after the upper neighbour" would put the item last.
    const s = Float64Array.from([0, 0, 0, 5, 0]);
    expect(drop(new TieOrder([1, 0, 2, 3, 4]), s, 4, 3, 1)).toEqual([3, 4, 1, 0, 2]);
  });

  it('item in neither band is placed by strength between the neighbours', () => {
    const s = Float64Array.from([4, 0, 0, 0, 2]);
    expect(drop(new TieOrder(all), s, 4, 0, 1)).toEqual([0, 4, 1, 2, 3]);
  });

  it('top drop sits directly before the lower neighbour', () => {
    const s = new Float64Array(5);
    expect(drop(new TieOrder([2, 0, 1, 3, 4]), s, 4, undefined, 2)).toEqual([4, 2, 0, 1, 3]);
  });

  it('bottom drop sits directly after the upper neighbour', () => {
    const s = new Float64Array(5);
    expect(drop(new TieOrder(all), s, 0, 4, undefined)).toEqual([1, 2, 3, 4, 0]);
  });

  it('re-dropping an item removes it from its old position first', () => {
    const s = new Float64Array(5);
    const tie = new TieOrder(all);
    drop(tie, s, 4, 0, 1);
    expect(drop(tie, s, 4, 2, 3)).toEqual([0, 1, 2, 4, 3]);
  });
});

describe('strength bands (docs/ARCHITECTURE.md 11)', () => {
  it('three items pairwise within 1e-6 but spanning a grid line never reorder the two in different bands', () => {
    // Slots 0 and 2 share band 0; slot 1 is in band 1. Pairwise gaps are all under 1e-6.
    const s = Float64Array.from([0.45e-6, 0.55e-6, 0.4e-6]);
    expect([band(s[0] ?? 0), band(s[1] ?? 0), band(s[2] ?? 0)]).toEqual([0, 1, 0]);
    for (const arrival of [
      [0, 1, 2],
      [2, 1, 0],
      [1, 0, 2],
    ]) {
      const order = displayedOrder([0, 1, 2], s, new TieOrder(arrival));
      expect(order[0]).toBe(1);
    }
  });
});
