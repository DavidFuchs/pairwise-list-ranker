import { describe, expect, it } from 'vitest';

import { replay } from '@/lib/ranking/bt/engine';
import {
  disorderOfState,
  expectedDisorder,
  levelOf,
  pairChances,
  settleLevel,
} from '@/lib/ranking/bt/progress';
import { seededRandom } from '@/tests/helpers/random';
import type { RankingEvent } from '@/types/rankingEvents';
import { normalCdf } from '@/tests/sim/signals';

/** Every pair, the way the neighbour search is meant to equal. */
function everyPair(strengths: number[], uncertainties: number[]): number {
  const n = strengths.length;
  let flips = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const gap = Math.abs((strengths[i] as number) - (strengths[j] as number));
      flips += normalCdf(-gap / Math.sqrt((uncertainties[i] as number) + (uncertainties[j] as number)));
    }
  }
  return (2 * flips) / (n * n);
}

describe('expectedDisorder', () => {
  it('is 0 for a list with nothing to order', () => {
    expect(expectedDisorder([], [])).toBe(0);
    expect(expectedDisorder([1], [0.5])).toBe(0);
  });

  it('equals the sum over every pair', () => {
    const random = seededRandom(7);
    for (const n of [2, 5, 40, 120]) {
      const strengths = Array.from({ length: n }, () => random() * 6 - 3);
      const uncertainties = Array.from({ length: n }, () => 0.05 + random() * 2);
      expect(expectedDisorder(strengths, uncertainties)).toBeCloseTo(everyPair(strengths, uncertainties), 8);
    }
  });

  it('equals the sum over every pair when a few items are far more uncertain than the rest', () => {
    const random = seededRandom(11);
    for (const n of [30, 150, 400]) {
      const strengths = Array.from({ length: n }, () => random() * 8 - 4);
      const uncertainties = Array.from({ length: n }, (_, i) =>
        i % 17 === 0 ? 8 + random() * 12 : 0.1 + random() * 0.8,
      );
      expect(expectedDisorder(strengths, uncertainties)).toBeCloseTo(everyPair(strengths, uncertainties), 8);
    }
  });

  it('stops early once the disorder is past the cap, at a value between the cap and the true disorder', () => {
    const random = seededRandom(5);
    const n = 200;
    const strengths = Array.from({ length: n }, () => random() * 2);
    const uncertainties = Array.from({ length: n }, () => 1 + random());
    const full = expectedDisorder(strengths, uncertainties);
    expect(full).toBeGreaterThan(0.1);
    const capped = expectedDisorder(strengths, uncertainties, 0.1);
    expect(capped).toBeGreaterThanOrEqual(0.1);
    expect(capped).toBeLessThanOrEqual(full + 1e-12);
  });

  it('is not changed by a cap it does not reach', () => {
    const strengths = Array.from({ length: 60 }, (_, i) => i * 0.5);
    const uncertainties = Array(60).fill(0.1);
    expect(expectedDisorder(strengths, uncertainties, 0.1)).toBe(expectedDisorder(strengths, uncertainties));
  });

  it('does not depend on the order the items are given in', () => {
    const strengths = [0.3, -1.2, 2.5, 0.31, -0.4];
    const uncertainties = [0.5, 1.5, 0.2, 0.9, 0.3];
    const flipped = [4, 3, 2, 1, 0];
    expect(
      expectedDisorder(
        flipped.map((i) => strengths[i]!),
        flipped.map((i) => uncertainties[i]!),
      ),
    ).toBeCloseTo(expectedDisorder(strengths, uncertainties), 12);
  });

  it('grows as the uncertainties grow, and falls as the items spread apart', () => {
    const strengths = Array.from({ length: 30 }, (_, i) => i * 0.2);
    const sure = expectedDisorder(strengths, Array(30).fill(0.05));
    const unsure = expectedDisorder(strengths, Array(30).fill(2));
    const spread = expectedDisorder(
      strengths.map((s) => s * 5),
      Array(30).fill(2),
    );
    expect(sure).toBeLessThan(unsure);
    expect(spread).toBeLessThan(unsure);
  });

  it('reads each pair from the given chance, with the item given first (shown above) first', () => {
    const strengths = [2, 0, 1];
    const uncertainties = [1, 1, 1];
    const asked: string[] = [];
    const disorder = expectedDisorder(strengths, uncertainties, Infinity, (i, j) => {
      asked.push(`${i}${j}`);
      return 0.25;
    });
    expect(asked.sort()).toEqual(['01', '02', '12']);
    expect(disorder).toBeCloseTo((2 * 3 * 0.25) / 9, 12);
  });

  it('stays near linear in the list on a long list', () => {
    const n = 20000;
    const strengths = Array.from({ length: n }, (_, i) => i * 0.01);
    const started = performance.now();
    expectedDisorder(strengths, Array(n).fill(0.05));
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('disorderOfState', () => {
  const pair = (index: number, left: string, right: string): RankingEvent => ({
    id: `e${index}`,
    listId: 'progress',
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    kind: 'pair',
    leftItemId: left,
    rightItemId: right,
    outcome: 'left',
  });

  it('is null without a fit, as for a view shown before its session starts', () => {
    expect(disorderOfState({ ranked: ['a', 'b'] })).toBeNull();
  });

  it('does not count an item that won every answer as in doubt, as the Gaussian estimate does', () => {
    // a beats everything; b, c and d go round in a loop, so only their order is in doubt.
    const events = [
      pair(0, 'a', 'b'),
      pair(1, 'a', 'c'),
      pair(2, 'a', 'd'),
      pair(3, 'b', 'c'),
      pair(4, 'c', 'd'),
      pair(5, 'd', 'b'),
    ];
    const state = replay({ originalItemIds: ['a', 'b', 'c', 'd'], startingOrder: 'unordered', events });
    const gaussian = expectedDisorder(
      state.ranked.map((id) => state.strengths.get(id) as number),
      state.ranked.map((id) => state.uncertainty.get(id) as number),
    );
    const disorder = disorderOfState(state) as number;
    // The loop alone: three pairs at about an even chance, over 4 items squared, twice.
    expect(disorder).toBeGreaterThan((2 * 3 * 0.4) / 16);
    expect(disorder).toBeLessThan(gaussian);
  });

  it('keeps the Gaussian estimate from 26 items', () => {
    const ids = Array.from({ length: 30 }, (_, k) => `i${k}`);
    const events = ids.slice(1).map((id, k) => pair(k, ids[k] as string, id));
    const state = replay({ originalItemIds: ids, startingOrder: 'unordered', events });
    const gaussian = expectedDisorder(
      state.ranked.map((id) => state.strengths.get(id) as number),
      state.ranked.map((id) => state.uncertainty.get(id) as number),
      0.1,
    );
    expect(disorderOfState(state)).toBe(gaussian);
  });
});

describe('pairChances', () => {
  const pair = (index: number, left: string, right: string): RankingEvent => ({
    id: `e${index}`,
    listId: 'progress',
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    kind: 'pair',
    leftItemId: left,
    rightItemId: right,
    outcome: 'left',
  });

  it('is null without a fit', () => {
    expect(pairChances({ ranked: ['a', 'b'] })).toBeNull();
  });

  it('gives every pair the disorder sums, the one shown above first', () => {
    const events = [pair(0, 'a', 'b'), pair(1, 'b', 'c'), pair(2, 'c', 'a'), pair(3, 'a', 'd')];
    const state = replay({ originalItemIds: ['a', 'b', 'c', 'd'], startingOrder: 'unordered', events });
    const pairs = pairChances(state) as NonNullable<ReturnType<typeof pairChances>>;
    for (const { above, below } of pairs) {
      expect(state.ranked.indexOf(above)).toBeLessThan(state.ranked.indexOf(below));
    }
    const sum = pairs.reduce((total, { chance }) => total + chance, 0);
    expect((2 * sum) / 16).toBeCloseTo(disorderOfState(state) as number, 12);
  });
});

describe('levelOf', () => {
  it('reads the four levels off the disorder', () => {
    expect(levelOf(0.5, 60)).toBe(0);
    expect(levelOf(0.07, 60)).toBe(0);
    expect(levelOf(0.0699, 60)).toBe(1);
    expect(levelOf(0.025, 60)).toBe(1);
    expect(levelOf(0.0249, 60)).toBe(2);
    expect(levelOf(0.02, 60)).toBe(2);
    expect(levelOf(0.0199, 60)).toBe(3);
    expect(levelOf(0, 60)).toBe(3);
  });
});

describe('levelOf for a list under 26 items', () => {
  it('reads the disorder in expected places out, the same at every small size', () => {
    for (const n of [5, 10, 20]) {
      expect(levelOf(1.1 / n, n), `n ${n}`).toBe(0);
      expect(levelOf(0.9 / n, n), `n ${n}`).toBe(1);
      expect(levelOf(0.3 / n, n), `n ${n}`).toBe(2);
      expect(levelOf(0.2 / n, n), `n ${n}`).toBe(3);
    }
  });

  it('keeps the per-list scale from 26 items', () => {
    expect(levelOf(0.06, 26)).toBe(1);
    expect(levelOf(0.06, 25)).toBe(0);
  });

  it('holds a level just past its boundary, with the same margin', () => {
    expect(settleLevel(3, 0.27 / 10, 10)).toBe(3);
    expect(settleLevel(3, 0.3 / 10, 10)).toBe(2);
  });
});

describe('settleLevel', () => {
  it('starts at the level the disorder is in', () => {
    expect(settleLevel(null, 0.01, 60)).toBe(3);
  });

  it('rises at once', () => {
    expect(settleLevel(1, 0.022, 60)).toBe(2);
    expect(settleLevel(0, 0.01, 60)).toBe(3);
  });

  it('holds a level just past its boundary, and falls once well past it', () => {
    expect(settleLevel(3, 0.021, 60)).toBe(3);
    expect(settleLevel(3, 0.0219, 60)).toBe(3);
    expect(settleLevel(3, 0.023, 60)).toBe(2);
    expect(settleLevel(2, 0.027, 60)).toBe(2);
    expect(settleLevel(2, 0.028, 60)).toBe(1);
  });

  it('can fall more than one level when the disorder jumps', () => {
    expect(settleLevel(3, 0.2, 60)).toBe(0);
  });
});
