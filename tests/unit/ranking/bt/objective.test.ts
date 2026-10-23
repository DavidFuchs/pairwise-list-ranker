import { describe, expect, it } from 'vitest';

import type { PairTerm } from '@/lib/ranking/bt/evidence';
import { K } from '@/lib/ranking/bt/constants';
import {
  compile,
  curvatureAt,
  emptyCurvature,
  evaluate,
  gradient,
  hessianDiagonal,
  hessianTimes,
  hessianTimesCached,
  type Problem,
  value,
} from '@/lib/ranking/bt/objective';

function pairTerm(winner: number, loser: number, weight: number): PairTerm {
  return { winner, loser, weight, eventIndex: 0 };
}

function problem(
  n: number,
  pairs: PairTerm[],
  free: number[] = Array.from({ length: n }, (_, i) => i),
): Problem {
  return {
    free: Int32Array.from(free),
    priorMean: Float64Array.from({ length: n }, (_, i) => 0.3 * i - 0.8),
    priorVar: Float64Array.from({ length: n }, (_, i) => 4 + i),
    pairs,
  };
}

/**
 * A fixed, irregular problem: 6 slots, 13 pairs with mixed weights, some of
 * them repeated or contradicted.
 */
const mixed = problem(6, [
  pairTerm(0, 1, 1),
  pairTerm(2, 4, 1.75),
  pairTerm(4, 2, 0.25),
  pairTerm(5, 3, 1),
  pairTerm(1, 5, 0.25),
  pairTerm(3, 0, 1),
  pairTerm(0, 5, 1),
  pairTerm(5, 1, 1),
  pairTerm(1, 2, 1),
  pairTerm(4, 2, 1.75),
  pairTerm(2, 1, 1.75),
  pairTerm(1, 0, 1.75),
  pairTerm(0, 3, 1.75),
]);
const at = Float64Array.from([0.9, -1.3, 2.1, 0.4, -0.6, 1.7]);

function grad(p: Problem, s: Float64Array): Float64Array {
  const out = new Float64Array(s.length);
  gradient(p, s, out);
  return out;
}

function diag(p: Problem, s: Float64Array): Float64Array {
  const out = new Float64Array(s.length);
  hessianDiagonal(p, s, out);
  return out;
}

function hv(p: Problem, s: Float64Array, v: Float64Array): Float64Array {
  const out = new Float64Array(s.length);
  hessianTimes(p, s, v, out);
  return out;
}

function shifted(s: Float64Array, i: number, h: number): Float64Array {
  const copy = Float64Array.from(s);
  copy[i] = (copy[i] ?? 0) + h;
  return copy;
}

describe('objective', () => {
  it('a pair term is the weighted Bradley-Terry log-likelihood', () => {
    const s = Float64Array.from([0.7, -0.2]);
    const weight = 1.75;
    const p = problem(2, [pairTerm(0, 1, weight)]);
    const withoutTerms = problem(2, []);
    const win = 1 / (1 + Math.exp(-(0.7 - -0.2) / K));
    expect(value(p, s) - value(withoutTerms, s)).toBeCloseTo(weight * Math.log(win), 14);
    const gp = grad(p, s);
    const g0 = grad(withoutTerms, s);
    expect((gp[0] ?? NaN) - (g0[0] ?? NaN)).toBeCloseTo((weight * (1 - win)) / K, 14);
    expect((gp[1] ?? NaN) - (g0[1] ?? NaN)).toBeCloseTo((-weight * (1 - win)) / K, 14);
    const dp = diag(p, s);
    const d0 = diag(withoutTerms, s);
    for (let i = 0; i < 2; i++) {
      expect((dp[i] ?? NaN) - (d0[i] ?? NaN)).toBeCloseTo((weight * win * (1 - win)) / (K * K), 14);
    }
  });

  it('gradient matches finite differences', () => {
    const h = 1e-6;
    const g = grad(mixed, at);
    for (let i = 0; i < at.length; i++) {
      const fd = (value(mixed, shifted(at, i, h)) - value(mixed, shifted(at, i, -h))) / (2 * h);
      expect(Math.abs((g[i] ?? NaN) - fd)).toBeLessThan(1e-6);
    }
  });

  it('hessianTimes matches finite differences of the gradient', () => {
    const h = 1e-6;
    const v = Float64Array.from([0.5, -1, 0.25, 2, -0.75, 1.5]);
    const out = hv(mixed, at, v);
    const plus = Float64Array.from(at, (x, i) => x + h * (v[i] ?? 0));
    const minus = Float64Array.from(at, (x, i) => x - h * (v[i] ?? 0));
    const gPlus = grad(mixed, plus);
    const gMinus = grad(mixed, minus);
    for (let i = 0; i < at.length; i++) {
      // Negative Hessian: minus the directional derivative of the gradient.
      const fd = -((gPlus[i] ?? 0) - (gMinus[i] ?? 0)) / (2 * h);
      expect(Math.abs((out[i] ?? NaN) - fd)).toBeLessThan(1e-5);
    }
  });

  it('hessianDiagonal equals hessianTimes on unit vectors', () => {
    const d = diag(mixed, at);
    for (let i = 0; i < at.length; i++) {
      const unit = new Float64Array(at.length);
      unit[i] = 1;
      expect(d[i]).toBeCloseTo(hv(mixed, at, unit)[i] ?? NaN, 14);
      expect(d[i]).toBeGreaterThan(0);
    }
  });

  it('with no evidence, the maximum is the prior mean', () => {
    const p = problem(6, []);
    const g = grad(p, p.priorMean);
    for (const x of g) expect(x).toBe(0);
  });

  it('extreme gaps stay finite', () => {
    const s = Float64Array.from([500, 0, -500, 250, -250]);
    const p = problem(5, [
      pairTerm(2, 0, 1),
      pairTerm(2, 4, 1),
      pairTerm(4, 1, 1),
      pairTerm(1, 3, 1),
      pairTerm(3, 0, 1),
      pairTerm(0, 3, 1),
      pairTerm(1, 4, 1),
      pairTerm(4, 2, 1),
    ]);
    expect(Number.isFinite(value(p, s))).toBe(true);
    for (const x of grad(p, s)) expect(Number.isFinite(x)).toBe(true);
    const d = diag(p, s);
    for (const x of d) expect(Number.isFinite(x)).toBe(true);
    for (const x of hv(p, s, Float64Array.from([1, -1, 1, -1, 1]))) expect(Number.isFinite(x)).toBe(true);
  });

  it('treats slots outside the free set as constants and writes 0 there', () => {
    // Slot 2 is fixed: it may appear in terms but never changes and gets no output.
    const p = problem(
      4,
      [pairTerm(2, 0, 1), pairTerm(1, 2, 1), pairTerm(2, 3, 1), pairTerm(3, 0, 1)],
      [3, 0, 1],
    );
    const s = Float64Array.from([0.4, -0.3, 1.2, 0.1]);
    const out = new Float64Array(4).fill(99);
    gradient(p, s, out);
    expect(out[2]).toBe(0);
    hessianDiagonal(p, s, out.fill(99));
    expect(out[2]).toBe(0);
    const v = Float64Array.from([0.5, -1, 0, 2]);
    const withJunk = Float64Array.from([0.5, -1, 7, 2]);
    const clean = hv(p, s, v);
    const junk = hv(p, s, withJunk);
    expect(Array.from(junk)).toEqual(Array.from(clean));
    expect(clean[2]).toBe(0);
    // The fixed slot's prior is not part of the objective.
    const moved = Float64Array.from(s);
    moved[2] = 50;
    const withoutTerms = problem(4, [], [3, 0, 1]);
    expect(value(withoutTerms, moved)).toBe(value(withoutTerms, s));
  });

  it('cached curvature reproduces hessianTimes and hessianDiagonal', () => {
    const fixed = problem(6, mixed.pairs.slice(), [5, 0, 2, 3, 1]);
    const extreme = Float64Array.from([500, 0, -500, 250, -250, 40]);
    const v = Float64Array.from([0.5, -1, 0.25, 2, -0.75, 1.5]);
    for (const p of [mixed, fixed]) {
      for (const s of [at, extreme]) {
        const c = curvatureAt(p, s);
        const cached = new Float64Array(6).fill(99);
        hessianTimesCached(c, v, cached);
        const reference = hv(p, s, v);
        const d = diag(p, s);
        for (let i = 0; i < 6; i++) {
          expect(Number.isFinite(cached[i])).toBe(true);
          expect(Math.abs((cached[i] ?? NaN) - (reference[i] ?? NaN))).toBeLessThan(1e-13);
          expect(Math.abs((c.diagonal[i] ?? NaN) - (d[i] ?? NaN))).toBeLessThan(1e-13);
        }
      }
    }
  });

  it('cached curvature keeps repeated couplings and drops fixed ones', () => {
    // Pair 0-1 three times; slot 3 is fixed and touched by three pairs.
    const p = problem(
      5,
      [
        pairTerm(0, 1, 1),
        pairTerm(1, 0, 1.75),
        pairTerm(3, 2, 1),
        pairTerm(1, 3, 1),
        pairTerm(0, 1, 0.25),
        pairTerm(3, 4, 1),
        pairTerm(0, 4, 1),
      ],
      [0, 1, 2, 4],
    );
    const s = Float64Array.from([0.3, -0.4, 1.1, 0.8, -1.5]);
    const v = Float64Array.from([0.5, -1, 0.25, 2, -0.75]);
    const cached = new Float64Array(5).fill(99);
    hessianTimesCached(curvatureAt(p, s), v, cached);
    const reference = hv(p, s, v);
    for (let i = 0; i < 5; i++)
      expect(Math.abs((cached[i] ?? NaN) - (reference[i] ?? NaN))).toBeLessThan(1e-14);
    expect(cached[3]).toBe(0);
  });

  it('evaluate matches value, gradient and the cached curvature in one pass', () => {
    const fixed = problem(6, mixed.pairs.slice(), [5, 0, 2, 3, 1]);
    // Moderate, extreme, and far below the strongest item (the shared shift falls back).
    const points = [
      at,
      Float64Array.from([500, 0, -500, 250, -250, 40]),
      Float64Array.from([2000, -1, 0.5, -2, 1, 0]),
    ];
    const v = Float64Array.from([0.5, -1, 0.25, 2, -0.75, 1.5]);
    for (const p of [mixed, fixed]) {
      for (const s of points) {
        const g = new Float64Array(6);
        const cp = compile(p, 6);
        const c = emptyCurvature(cp);
        const total = evaluate(cp, s, g, c);
        expect(Math.abs(total - value(p, s))).toBeLessThan(1e-12 * Math.max(1, Math.abs(total)));
        const reference = grad(p, s);
        const product = new Float64Array(6);
        hessianTimesCached(c, v, product);
        const referenceProduct = hv(p, s, v);
        for (let i = 0; i < 6; i++) {
          expect(Math.abs((g[i] ?? NaN) - (reference[i] ?? NaN))).toBeLessThan(1e-13);
          expect(Math.abs((product[i] ?? NaN) - (referenceProduct[i] ?? NaN))).toBeLessThan(1e-13);
        }
        const withoutCurvature = new Float64Array(6);
        expect(evaluate(cp, s, withoutCurvature, null)).toBe(total);
        expect(Array.from(withoutCurvature)).toEqual(Array.from(g));
      }
    }
  });

  it('compile recycles memory without stale entries', () => {
    const fewer = problem(6, [pairTerm(4, 1, 1), pairTerm(2, 0, 1), pairTerm(0, 5, 1)], [0, 1, 2, 4, 5]);
    const recycled = compile(fewer, 6, compile(mixed, 6));
    const fresh = compile(fewer, 6);
    const v = Float64Array.from([0.5, -1, 0.25, 2, -0.75, 1.5]);
    const results = [recycled, fresh].map((cp) => {
      const g = new Float64Array(6);
      const c = emptyCurvature(cp);
      const total = evaluate(cp, at, g, c);
      const product = new Float64Array(6);
      hessianTimesCached(c, v, product);
      return { total, g: Array.from(g), product: Array.from(product) };
    });
    expect(results[0]).toEqual(results[1]);
  });
});
