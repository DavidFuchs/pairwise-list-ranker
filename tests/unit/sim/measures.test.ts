import { describe, expect, it } from 'vitest';

import { answersToThreshold, measure, type Truth } from '@/tests/sim/measures';

/** A strict truth: the order of `ids` is the true order, places from 1. */
function strict(ids: readonly string[]): Truth {
  return {
    span: (id) => {
      const place = ids.indexOf(id) + 1;
      return [place, place];
    },
  };
}

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `i${i}`);

describe('measure', () => {
  it('scores a perfect order as perfect', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    const m = measure(order, strict(order));
    expect(m.mean).toBe(0);
    expect(m.within5).toBe(1);
    expect(m.within1).toBe(1);
    expect(m.kendall).toBe(1);
    expect(m.top20).toBe(1);
  });

  it('scores a reversed order as fully discordant', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    const m = measure([...order].reverse(), strict(order));
    expect(m.kendall).toBe(0);
    expect(m.mean).toBeGreaterThan(0);
  });

  it('gives a tied group zero displacement in any order and counts tied pairs as agreeing', () => {
    const truth: Truth = {
      span: (id) => (['a', 'b', 'c'].includes(id) ? [1, 3] : id === 'd' ? [4, 4] : [5, 5]),
    };
    for (const shown of [
      ['a', 'b', 'c', 'd', 'e'],
      ['c', 'a', 'b', 'd', 'e'],
      ['b', 'c', 'a', 'd', 'e'],
    ]) {
      const m = measure(shown, truth);
      expect(m.mean).toBe(0);
      expect(m.kendall).toBe(1);
    }
  });

  it('measures displacement to the nearest end of the span', () => {
    // x shown at place 4 against span 1..2 (2 off); z at place 2 against place 4 (2 off).
    const truth: Truth = {
      span: (id) => (id === 'x' ? [1, 2] : id === 'y' ? [3, 3] : id === 'z' ? [4, 4] : [1, 1]),
    };
    const m = measure(['w', 'z', 'y', 'x'], truth);
    expect(m.mean).toBe((0 + 2 + 0 + 2) / 4);
  });

  it('counts items more than 5 places off against within5 but not within1 separately', () => {
    const order = ids(100);
    const shown = [...order];
    // Swap i with i + 6 for i in 0..4: ten items each 6 places off.
    for (let i = 0; i < 5; i++) {
      [shown[i], shown[i + 6]] = [shown[i + 6]!, shown[i]!];
    }
    const m = measure(shown, strict(order));
    expect(m.within5).toBeCloseTo(0.9, 10);
    expect(m.within1).toBeCloseTo(0.9, 10);
    expect(m.worstDecile).toBeGreaterThanOrEqual(6);
  });

  it('computes within1 as the share within one place', () => {
    const order = ids(100);
    const shown = [...order];
    [shown[10], shown[11]] = [shown[11]!, shown[10]!];
    [shown[20], shown[22]] = [shown[22]!, shown[20]!];
    const m = measure(shown, strict(order));
    // Two adjacent swaps are within 1; the 20/22 swap is 2 off for two items.
    expect(m.within1).toBeCloseTo(0.98, 10);
    expect(m.within5).toBe(1);
  });

  it('scores top20 as the share of the true top 20 found in the shown top 20', () => {
    const order = ids(50);
    const shown = [...order];
    // Move true item 0 to the bottom and item 30 to the top-20 area.
    [shown[0], shown[30]] = [shown[30]!, shown[0]!];
    const m = measure(shown, strict(order));
    expect(m.top20).toBeCloseTo(19 / 20, 10);
  });

  it('uses min(20, n) for top20 on short lists', () => {
    const order = ids(5);
    expect(measure(order, strict(order)).top20).toBe(1);
    expect(measure([...order].reverse(), strict(order)).top20).toBe(1);
  });

  it('gives kendall 1 for fewer than two items', () => {
    expect(measure(['a'], strict(['a'])).kendall).toBe(1);
    expect(measure([], strict([])).kendall).toBe(1);
  });
});

describe('answersToThreshold', () => {
  const samples = [
    { answers: 10, within5: 0.5 },
    { answers: 20, within5: 0.85 },
    { answers: 30, within5: 0.92 },
    { answers: 40, within5: 0.95 },
  ];

  it('returns the answers of the first sample at or above the threshold', () => {
    expect(answersToThreshold(samples, 0.9)).toBe(30);
    expect(answersToThreshold(samples, 0.85)).toBe(20);
  });

  it('returns null when no sample reaches the threshold', () => {
    expect(answersToThreshold(samples, 0.99)).toBeNull();
    expect(answersToThreshold([], 0.9)).toBeNull();
  });
});
