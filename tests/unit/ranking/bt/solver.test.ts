import { describe, expect, it } from 'vitest';

import type { PairTerm } from '@/lib/ranking/bt/evidence';
import { gradient, hessianDiagonal, hessianTimes, type Problem } from '@/lib/ranking/bt/objective';
import { solve } from '@/lib/ranking/bt/solver';
import { seededRandom, shuffled } from '@/tests/helpers/random';

const WEIGHTS = [1, 1.75, 0.25];

function distinctSlots(n: number, count: number, random: () => number): number[] {
  const slots: number[] = [];
  while (slots.length < count) {
    const slot = Math.floor(random() * n);
    if (!slots.includes(slot)) slots.push(slot);
  }
  return slots;
}

/**
 * A seeded problem: n items with varied priors and mixed pair weights.
 * Slots listed in fixed are left out of the free set.
 */
function randomProblem(n: number, pairCount: number, seed: number, fixed: number[] = []): Problem {
  const random = seededRandom(seed);
  const pairs: PairTerm[] = [];
  for (let e = 0; e < pairCount; e++) {
    const [winner, loser] = distinctSlots(n, 2, random) as [number, number];
    pairs.push({ winner, loser, weight: WEIGHTS[e % WEIGHTS.length] ?? 1, eventIndex: e });
  }
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !fixed.includes(i));
  return {
    free: Int32Array.from(free),
    priorMean: Float64Array.from({ length: n }, () => 20 * random() - 10),
    priorVar: Float64Array.from({ length: n }, () => 25 + 600 * random()),
    pairs,
  };
}

/** Strengths starting at the prior means (fixed slots keep their prior mean as their strength). */
function fromPriors(p: Problem): Float64Array {
  return Float64Array.from(p.priorMean);
}

function maxDifference(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  return max;
}

/**
 * The exact Newton step at s, by dense Cholesky of the reference Hessian: near
 * the optimum its largest entry is the strength error. Small problems only.
 */
function trueError(p: Problem, s: Float64Array): number {
  const n = s.length;
  const g = new Float64Array(n);
  gradient(p, s, g);
  const h: Float64Array[] = [];
  const unit = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    unit.fill(0);
    unit[j] = 1;
    const column = new Float64Array(n);
    hessianTimes(p, s, unit, column);
    h.push(column);
  }
  const entry = (i: number, j: number): number => h[i]?.[j] ?? NaN;
  for (let j = 0; j < n; j++) {
    let pivot = entry(j, j);
    for (let k = 0; k < j; k++) pivot -= entry(j, k) * entry(j, k);
    const root = Math.sqrt(pivot);
    (h[j] as Float64Array)[j] = root;
    for (let i = j + 1; i < n; i++) {
      let sum = entry(i, j);
      for (let k = 0; k < j; k++) sum -= entry(i, k) * entry(j, k);
      (h[i] as Float64Array)[j] = sum / root;
    }
  }
  const y = Array.from(g);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < i; k++) y[i] = (y[i] ?? NaN) - entry(i, k) * (y[k] ?? NaN);
    y[i] = (y[i] ?? NaN) / entry(i, i);
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let k = i + 1; k < n; k++) y[i] = (y[i] ?? NaN) - entry(k, i) * (y[k] ?? NaN);
    y[i] = (y[i] ?? NaN) / entry(i, i);
  }
  return Math.max(...y.map(Math.abs));
}

/** A chain: each item compared repeatedly with its neighbour only, as the picker's offset 1 does. */
function chainProblem(n: number, repeats: number, seed: number): Problem {
  const random = seededRandom(seed);
  const pairs: PairTerm[] = [];
  for (let i = 0; i + 1 < n; i++) {
    for (let k = 0; k < repeats; k++) {
      const upper = random() < 0.6;
      pairs.push({
        winner: upper ? i : i + 1,
        loser: upper ? i + 1 : i,
        weight: 1,
        eventIndex: pairs.length,
      });
    }
  }
  return {
    free: Int32Array.from({ length: n }, (_, i) => i),
    priorMean: new Float64Array(n),
    priorVar: new Float64Array(n).fill(625),
    pairs,
  };
}

describe('solve', () => {
  it('two items, one win', () => {
    const p: Problem = {
      free: Int32Array.from([0, 1]),
      priorMean: Float64Array.from([0, 0]),
      priorVar: Float64Array.from([625, 625]),
      pairs: [{ winner: 0, loser: 1, weight: 1, eventIndex: 0 }],
    };
    const s = fromPriors(p);
    const result = solve(p, s);
    expect(result.converged).toBe(true);
    const g = new Float64Array(2);
    gradient(p, s, g);
    expect(Math.abs(g[0] ?? NaN)).toBeLessThan(1e-9);
    expect(Math.abs(g[1] ?? NaN)).toBeLessThan(1e-9);
    expect(s[0]).toBeGreaterThan(0);
    expect(s[0]).toBeCloseTo(-(s[1] ?? NaN), 12);
  });

  it('the objective never decreases', () => {
    const p = randomProblem(40, 230, 1);
    const values: number[] = [];
    const result = solve(p, fromPriors(p), { onIteration: (v) => values.push(v) });
    expect(result.converged).toBe(true);
    expect(values.length).toBeGreaterThan(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] ?? Infinity);
    }
  });

  it('the same evidence in any order gives the same strengths', () => {
    const p = randomProblem(60, 460, 2, [5, 17]);
    const random = seededRandom(3);
    const reordered: Problem = { ...p, pairs: shuffled(p.pairs, random) };
    const a = fromPriors(p);
    const b = fromPriors(p);
    expect(solve(p, a).converged).toBe(true);
    expect(solve(reordered, b).converged).toBe(true);
    expect(maxDifference(a, b)).toBeLessThan(1e-10);
  });

  it('warm start and cold start agree', () => {
    const p = randomProblem(80, 600, 4);
    const cold = fromPriors(p);
    expect(solve(p, cold).converged).toBe(true);
    const warm = Float64Array.from(cold, (x, i) => x + (i % 2 === 0 ? 0.5 : -0.5));
    expect(solve(p, warm).converged).toBe(true);
    expect(maxDifference(cold, warm)).toBeLessThan(1e-10);
  });

  it('convergence quality', () => {
    const p = randomProblem(200, 2100, 5, [0, 99, 150]);
    const s = fromPriors(p);
    expect(solve(p, s).converged).toBe(true);
    const continued = Float64Array.from(s);
    solve(p, continued, { maxIterations: 500 });
    expect(maxDifference(s, continued)).toBeLessThan(1e-10);
  });

  it('only free slots change', () => {
    const p = randomProblem(30, 160, 6, [3, 4, 20]);
    const s = fromPriors(p);
    solve(p, s);
    expect(s[3]).toBe(p.priorMean[3]);
    expect(s[4]).toBe(p.priorMean[4]);
    expect(s[20]).toBe(p.priorMean[20]);
  });

  it('a contradicted ranked seed stays finite and converges', () => {
    const n = 100;
    const random = seededRandom(7);
    const pairs: PairTerm[] = [];
    for (let e = 0; e < 400; e++) {
      const [a, b] = distinctSlots(n, 2, random) as [number, number];
      // The seed puts the lower slot on top; every answer says otherwise.
      pairs.push({ winner: Math.max(a, b), loser: Math.min(a, b), weight: 1, eventIndex: e });
    }
    const p: Problem = {
      free: Int32Array.from({ length: n }, (_, i) => i),
      priorMean: Float64Array.from({ length: n }, (_, i) => 40 - (80 * i) / (n - 1)),
      priorVar: new Float64Array(n).fill(2.4 * 2.4),
      pairs,
    };
    const s = fromPriors(p);
    const result = solve(p, s);
    expect(result.converged).toBe(true);
    for (const x of s) expect(Number.isFinite(x)).toBe(true);
  });

  it('a non-finite strength stops the solve unconverged', () => {
    const p = randomProblem(10, 28, 8);
    const s = fromPriors(p);
    s[3] = NaN;
    expect(solve(p, s)).toEqual({ iterations: 0, converged: false });
  });

  it('stays accurate on stiff chain-shaped evidence', () => {
    const base = chainProblem(400, 20, 9);
    const s = fromPriors(base);
    expect(solve(base, s).converged).toBe(true);
    expect(trueError(base, s)).toBeLessThan(1e-11);
    const p: Problem = {
      ...base,
      pairs: [...base.pairs, { winner: 399, loser: 0, weight: 1, eventIndex: base.pairs.length }],
    };
    const warm = Float64Array.from(s);
    const cold = fromPriors(p);
    expect(solve(p, warm).converged).toBe(true);
    expect(solve(p, cold).converged).toBe(true);
    expect(maxDifference(warm, cold)).toBeLessThan(1e-10);
    expect(trueError(p, warm)).toBeLessThan(1e-11);
    expect(trueError(p, cold)).toBeLessThan(1e-11);
  }, 120_000);

  it('a non-finite trial stops the solve unconverged', () => {
    // Slot 2 has an improper prior and no evidence: the start is finite, but its Newton step is not.
    const p: Problem = {
      free: Int32Array.from([0, 1, 2]),
      priorMean: Float64Array.from([0, 0, 0]),
      priorVar: Float64Array.from([625, 625, Infinity]),
      pairs: [{ winner: 0, loser: 1, weight: 1, eventIndex: 0 }],
    };
    expect(solve(p, Float64Array.from([0, 0, 0])).converged).toBe(false);
  });
});

describe('solve returns the diagonal at its final point', () => {
  /** The objective tests' fixed problem: 6 slots, 13 pairs. */
  const mixed: Problem = {
    free: Int32Array.from({ length: 6 }, (_, i) => i),
    priorMean: Float64Array.from({ length: 6 }, (_, i) => 0.3 * i - 0.8),
    priorVar: Float64Array.from({ length: 6 }, (_, i) => 4 + i),
    pairs: [
      [0, 1, 1],
      [2, 4, 1.75],
      [4, 2, 0.25],
      [5, 3, 1],
      [1, 5, 0.25],
      [3, 0, 1],
      [0, 5, 1],
      [5, 1, 1],
      [1, 2, 1],
      [4, 2, 1.75],
      [2, 1, 1.75],
      [1, 0, 1.75],
      [0, 3, 1.75],
    ].map(([winner, loser, weight]) => ({ winner, loser, weight, eventIndex: 0 }) as PairTerm),
  };

  /** Solves from s with the diagonal asked for, and checks it against hessianDiagonal at the result. */
  function expectFinalDiagonal(p: Problem, s: Float64Array): number {
    const result = solve(p, s, { wantDiagonal: true });
    expect(result.converged).toBe(true);
    const expected = new Float64Array(s.length);
    hessianDiagonal(p, s, expected);
    expect(result.diagonal).toBeDefined();
    expect(maxDifference(result.diagonal ?? new Float64Array(s.length), expected)).toBeLessThan(1e-12);
    return result.iterations;
  }

  it('on the objective test problem', () => {
    expectFinalDiagonal(mixed, fromPriors(mixed));
  });

  it('on a 200-item problem, cold, warm after tiny steps, and already converged', () => {
    const p = randomProblem(200, 2100, 5, [0, 99, 150]);
    const s = fromPriors(p);
    expect(expectFinalDiagonal(p, s)).toBeGreaterThan(0);
    // Steps this small reuse the curvature, so the last evaluate had none.
    const nudged = Float64Array.from(s, (x, i) => x + 1e-6 * Math.sin(i + 1));
    expect(expectFinalDiagonal(p, nudged)).toBeGreaterThan(0);
    expect(expectFinalDiagonal(p, s)).toBe(0);
  });

  it('is left out unless asked for, and when the solve stops on a non-finite value', () => {
    const p = randomProblem(10, 28, 8);
    expect(solve(p, fromPriors(p)).diagonal).toBeUndefined();
    const s = fromPriors(p);
    s[3] = NaN;
    expect(solve(p, s, { wantDiagonal: true }).diagonal).toBeUndefined();
  });
});
