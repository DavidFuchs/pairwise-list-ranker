import { describe, expect, it } from 'vitest';

import { K } from '@/lib/ranking/bt/constants';
import { replay } from '@/lib/ranking/bt/engine';
import { type FitEvidence, FlipChances } from '@/lib/ranking/bt/flips';
import { normalTail } from '@/lib/ranking/bt/progress';
import type { PairOutcome, RankingEvent } from '@/types/rankingEvents';

function evidence(overrides: Partial<FitEvidence>): FitEvidence {
  return {
    strengths: Float64Array.from([0, 0]),
    uncertainty: Float64Array.from([1, 1]),
    priorMean: Float64Array.from([0, 0]),
    priorVar: Float64Array.from([1, 1]),
    pairs: [],
    ...overrides,
  };
}

function pair(index: number, left: string, right: string, outcome: PairOutcome = 'left'): RankingEvent {
  return {
    id: `e${index}`,
    listId: 'flips',
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    kind: 'pair',
    leftItemId: left,
    rightItemId: right,
    outcome,
  };
}

/** The same line integral with tiny even steps, written apart from FlipChances. */
function bruteForce(fit: FitEvidence, above: number, below: number): number {
  const logSigmoid = (d: number) => (d >= 0 ? -Math.log1p(Math.exp(-d)) : d - Math.log1p(Math.exp(d)));
  const s = fit.strengths;
  const uA = fit.uncertainty[above] as number;
  const uB = fit.uncertainty[below] as number;
  const curve = (t: number): number => {
    const moved = Float64Array.from(s);
    moved[above] = (moved[above] as number) + (t * uA) / (uA + uB);
    moved[below] = (moved[below] as number) - (t * uB) / (uA + uB);
    let total = 0;
    for (const slot of [above, below]) {
      const d = (moved[slot] as number) - (fit.priorMean[slot] as number);
      total -= (d * d) / (2 * (fit.priorVar[slot] as number));
    }
    for (const { winner, loser, weight } of fit.pairs) {
      if (winner !== above && winner !== below && loser !== above && loser !== below) continue;
      total += weight * logSigmoid(((moved[winner] as number) - (moved[loser] as number)) / K);
    }
    return total;
  };
  const gap = (s[above] as number) - (s[below] as number);
  const peak = curve(0);
  let wrong = 0;
  let all = 0;
  for (let t = -400; t < 400; t += 0.005) {
    const w = Math.exp(curve(t) - peak);
    all += w;
    if (gap + t < 0) wrong += w;
  }
  return wrong / all;
}

describe('FlipChances', () => {
  it('equals the Gaussian estimate when the posterior is Gaussian (priors only)', () => {
    const fit = evidence({ strengths: Float64Array.from([2, 0]), priorMean: Float64Array.from([2, 0]) });
    expect(new FlipChances(fit).chance(0, 1)).toBeCloseTo(normalTail(2 / Math.SQRT2), 3);
  });

  it('gives an even chance to a pair tied on equal evidence', () => {
    const fit = evidence({ uncertainty: Float64Array.from([3, 3]), priorVar: Float64Array.from([3, 3]) });
    expect(new FlipChances(fit).chance(0, 1)).toBeCloseTo(0.5, 6);
  });

  it('matches a brute-force integral along the same line', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const events = [
      pair(0, 'a', 'b'),
      pair(1, 'b', 'c'),
      pair(2, 'c', 'a', 'right'),
      pair(3, 'd', 'c', 'right'),
      pair(4, 'e', 'd', 'right_strong'),
      pair(5, 'b', 'd', 'draw'),
    ];
    const state = replay({ originalItemIds: ids, startingOrder: 'unordered', events });
    const flips = new FlipChances(state.fit);
    const slot = (id: string) => state.slots.get(id) as number;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const above = slot(state.ranked[i] as string);
        const below = slot(state.ranked[j] as string);
        expect(flips.chance(above, below), `${state.ranked[i]} over ${state.ranked[j]}`).toBeCloseTo(
          bruteForce(state.fit, above, below),
          3,
        );
      }
    }
  });

  it('is sure of an item that has beaten the other directly, where the Gaussian estimate doubts it', () => {
    // a wins every answer; b, c and d each win one and lose one in a loop.
    const events = [
      pair(0, 'a', 'b'),
      pair(1, 'a', 'c'),
      pair(2, 'a', 'd'),
      pair(3, 'b', 'c'),
      pair(4, 'c', 'd'),
      pair(5, 'd', 'b'),
      pair(6, 'a', 'b'),
    ];
    const state = replay({ originalItemIds: ['a', 'b', 'c', 'd'], startingOrder: 'unordered', events });
    const a = state.slots.get('a') as number;
    const b = state.slots.get('b') as number;
    const { strengths, uncertainty } = state.fit;
    const gaussian = normalTail(
      ((strengths[a] as number) - (strengths[b] as number)) /
        Math.sqrt((uncertainty[a] as number) + (uncertainty[b] as number)),
    );
    const exact = new FlipChances(state.fit).chance(a, b);
    expect(gaussian).toBeGreaterThan(0.1);
    expect(exact).toBeLessThan(gaussian / 5);
  });
});
