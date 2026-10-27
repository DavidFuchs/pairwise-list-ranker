import { describe, expect, it } from 'vitest';

import { pairKey, pickPair, type PickerInput } from '@/lib/ranking/bt/picker';

function input(n: number, overrides: Partial<PickerInput> = {}): PickerInput {
  return {
    order: Array.from({ length: n }, (_, i) => i),
    strengths: new Float64Array(n),
    uncertainty: new Float64Array(n).fill(1),
    shown: new Map(),
    ...overrides,
  };
}

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey(3, 7)).toBe(pairKey(7, 3));
    expect(pairKey(3, 7)).not.toBe(pairKey(3, 8));
  });
});

describe('pickPair', () => {
  it('two items give that pair', () => {
    expect(pickPair(input(2))).toEqual([0, 1]);
  });

  it('one item gives null', () => {
    expect(pickPair(input(1))).toBeNull();
    expect(pickPair(input(0))).toBeNull();
  });

  it('returns null when the only pair is the previous pair', () => {
    expect(pickPair(input(2, { previousPair: pairKey(0, 1) }))).toBeNull();
  });

  it('never offers the previous pair', () => {
    expect(pickPair(input(3))).toEqual([0, 1]);
    const next = pickPair(input(3, { previousPair: pairKey(0, 1) }));
    expect(next).not.toBeNull();
    expect(pairKey(next![0], next![1])).not.toBe(pairKey(0, 1));
  });

  it('prefers uncertain, close pairs', () => {
    const strengths = Float64Array.from([0, 0.1, 30, 60]);
    const uncertainty = Float64Array.from([5, 5, 0.01, 0.01]);
    // Displayed order is slots 3, 2, 1, 0: (3,2) is far apart and certain, (1,0) close and uncertain.
    expect(pickPair(input(4, { order: [3, 2, 1, 0], strengths, uncertainty }))).toEqual([1, 0]);
  });

  it('repeats are discounted by 0.3 per showing', () => {
    // Slots 0 and 1 tie in strength; slot 2 is 1.7 above. With every u at 1, the
    // tied pair (0,1) scores about 5.2x the pair (0,2). A factor of 0.3 keeps
    // (0,1) ahead after one showing (0.3 x 5.2 = 1.6) and puts it behind after
    // two (0.09 x 5.2 = 0.47). Only factors between about 0.2 and 0.45 do both.
    const strengths = Float64Array.from([0, 0, 1.7]);
    const at = (times: number) => pickPair(input(3, { strengths, shown: new Map([[pairKey(0, 1), times]]) }));
    expect(at(0)).toEqual([0, 1]);
    expect(at(1)).toEqual([0, 1]);
    expect(at(2)).toEqual([0, 2]);
  });

  it('a pair shown three times is asked again only when nothing else can be', () => {
    // (0,2) is all but certain, so (0,1) wins at every discount until the cap.
    const strengths = Float64Array.from([0, 0, 6]);
    const at = (times: number) => pickPair(input(3, { strengths, shown: new Map([[pairKey(0, 1), times]]) }));
    expect(at(2)).toEqual([0, 1]);
    expect(at(3)).toEqual([0, 2]);
    // With only one pair to ask, it is asked however often it was shown.
    expect(pickPair(input(2, { shown: new Map([[pairKey(0, 1), 5]]) }))).toEqual([0, 1]);
  });

  it('skips a pair the answers have settled, even when the Gaussian estimate doubts it', () => {
    // Every pair is tied for the Gaussian estimate; the answers say (0,1) is settled.
    const flips = { chance: (a: number, b: number) => (a + b === 1 ? 0 : 0.5) };
    expect(pickPair(input(3, { flips }))).toEqual([0, 2]);
  });

  it('ties go to the higher-ranked pair', () => {
    expect(pickPair(input(6, { order: [4, 2, 5, 0, 3, 1] }))).toEqual([4, 2]);
  });

  it('is deterministic', () => {
    const a = input(8, { strengths: Float64Array.from([3, 1, 4, 1, 5, 9, 2, 6]) });
    expect(pickPair(a)).toEqual(pickPair(a));
  });

  it('copes with zero uncertainty (best score 0)', () => {
    expect(pickPair(input(4, { uncertainty: new Float64Array(4) }))).toEqual([0, 1]);
  });
});
