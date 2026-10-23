import { describe, expect, it } from 'vitest';

import { placementPrior, seedPrior } from '@/lib/ranking/bt/priors';

const sd = (variance: number) => Math.sqrt(variance);

/** Slots 0..n-1 displayed in order, with strengths built from descending gaps. */
function fromGaps(gaps: number[], top = 0) {
  const strengths = [top];
  for (const gap of gaps) strengths.push((strengths[strengths.length - 1] ?? 0) - gap);
  return { order: strengths.map((_, i) => i), strengths: Float64Array.from(strengths) };
}

function list(strengths: number[]) {
  return { order: strengths.map((_, i) => i), strengths: Float64Array.from(strengths) };
}

describe('seedPrior', () => {
  it('unordered is N(0, 25^2)', () => {
    expect(seedPrior(3, 10, 'unordered')).toEqual({ mean: 0, variance: 625 });
  });

  it('ranked runs from +40 to -40 with sd 2.4', () => {
    const top = seedPrior(0, 10, 'ranked');
    const bottom = seedPrior(9, 10, 'ranked');
    expect(top.mean).toBeCloseTo(40, 12);
    expect(bottom.mean).toBeCloseTo(-40, 12);
    expect(sd(top.variance)).toBeCloseTo(2.4, 12);
  });

  it('rough has sd 16', () => {
    expect(sd(seedPrior(4, 10, 'rough').variance)).toBeCloseTo(16, 12);
  });

  it('a one-item import is centred at 0', () => {
    expect(seedPrior(0, 1, 'ranked').mean).toBe(0);
    expect(seedPrior(0, 1, 'rough').mean).toBe(0);
  });
});

describe('placementPrior', () => {
  it("placement mean is the neighbours' midpoint", () => {
    const { order, strengths } = list([10, 6, 2, 0]);
    expect(placementPrior(order, strengths, 2).mean).toBeCloseTo(4, 12);
  });

  it('placement width uses the list median gap where the local gaps are smaller', () => {
    // 41 items; gaps 15..24 are 0.1 and the rest 2, so the window around 20 sees only 0.1.
    const gaps = Array.from({ length: 40 }, (_, i) => (i >= 15 && i <= 24 ? 0.1 : 2));
    const { order, strengths } = fromGaps(gaps);
    // n = 42 gives 0.1 * 42 = 4.2 places; scale is the whole-list median, 2, not the
    // local 0.1, so sd = 4.2 * 2 = 8.4.
    expect(sd(placementPrior(order, strengths, 20).variance)).toBeCloseTo(8.4, 9);
  });

  it('width is clamped to 1 place at the small end', () => {
    const { order, strengths } = list([3, 2, 1]);
    expect(sd(placementPrior(order, strengths, 1).variance)).toBeCloseTo(1, 12);
  });

  it('width is clamped to 25 places at the large end', () => {
    // n = 4001 gives 400 places at 0.1; clamped to 25. Every gap is 0.1.
    const { order, strengths } = fromGaps(Array.from({ length: 3999 }, () => 0.1));
    expect(sd(placementPrior(order, strengths, 2000).variance)).toBeCloseTo(2.5, 9);
  });

  it('caps the sd at 25 strength units', () => {
    const { order, strengths } = list([1000, 0]);
    expect(sd(placementPrior(order, strengths, 1).variance)).toBe(25);
  });

  it('a top drop is one local scale above the top item', () => {
    const { order, strengths } = list([9, 6, 3, 0]);
    expect(placementPrior(order, strengths, 0).mean).toBeCloseTo(12, 12);
  });

  it('a bottom drop is one local scale below the bottom item', () => {
    const { order, strengths } = list([9, 6, 3, 0]);
    expect(placementPrior(order, strengths, 4).mean).toBeCloseTo(-3, 12);
  });

  it('on an evidence-free list (all gaps 0) the local scale is 0.05', () => {
    const { order, strengths } = list([0, 0, 0, 0]);
    expect(placementPrior(order, strengths, 0).mean).toBeCloseTo(0.05, 12);
    expect(sd(placementPrior(order, strengths, 2).variance)).toBeCloseTo(0.05, 12);
  });

  it('with fewer than 2 visible items the scale is the floor', () => {
    const one = list([4]);
    expect(placementPrior(one.order, one.strengths, 0).mean).toBeCloseTo(4.05, 12);
    expect(placementPrior(one.order, one.strengths, 1).mean).toBeCloseTo(3.95, 12);
    expect(placementPrior([], new Float64Array(0), 0).mean).toBe(0);
  });
});
