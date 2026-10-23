import { describe, expect, it } from 'vitest';

import type { PairTerm } from '@/lib/ranking/bt/evidence';
import type { Problem } from '@/lib/ranking/bt/objective';
import { solve } from '@/lib/ranking/bt/solver';
import { seededRandom } from '@/tests/helpers/random';

/**
 * Warm re-solve timings at 1,000 items and 10,000 terms (docs/ARCHITECTURE.md 6.5 speed gate,
 * unthrottled Node). Timing depends on the machine, so this runs only with
 * PERF=1: `PERF=1 npx vitest run tests/unit/ranking/bt/solver.perf.test.ts --silent=false`.
 */
const N = 1000;
const TERMS = 10000;
const ROUNDS = 40;

function distinctSlots(count: number, random: () => number): number[] {
  const slots: number[] = [];
  while (slots.length < count) {
    const slot = Math.floor(random() * N);
    if (!slots.includes(slot)) slots.push(slot);
  }
  return slots;
}

/**
 * Answers drawn from hidden true strengths, so the fit looks like a real
 * history. A draw is two terms of weight 0.25, one each way, so a large
 * drawShare gives the largest evidence set 10,000 answers can hold.
 */
function answers(seed: number, drawShare: number) {
  const random = seededRandom(seed);
  const truth = Array.from({ length: N }, () => 40 * random());
  const strength = (slot: number): number => truth[slot] ?? 0;
  let eventIndex = 0;
  const pair = (): PairTerm => {
    const [a, b] = distinctSlots(2, random) as [number, number];
    const aWins = random() < 1 / (1 + Math.exp(-(strength(a) - strength(b)) / Math.SQRT2));
    return { winner: aWins ? a : b, loser: aWins ? b : a, weight: 1, eventIndex: eventIndex++ };
  };
  const draw = (): PairTerm[] => {
    const [a, b] = distinctSlots(2, random) as [number, number];
    const at = eventIndex++;
    return [
      { winner: a, loser: b, weight: 0.25, eventIndex: at },
      { winner: b, loser: a, weight: 0.25, eventIndex: at },
    ];
  };
  const pairs: PairTerm[] = [];
  for (let e = 0; e < TERMS; e++) {
    if (random() < drawShare) pairs.push(...draw());
    else pairs.push(pair());
  }
  return { pairs, pair, draw };
}

function baseProblem(pairs: PairTerm[]): Problem {
  return {
    free: Int32Array.from({ length: N }, (_, i) => i),
    priorMean: new Float64Array(N),
    priorVar: new Float64Array(N).fill(625),
    pairs,
  };
}

function report(label: string, times: number[]): void {
  const sorted = times.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? NaN;
  const max = sorted[sorted.length - 1] ?? NaN;
  process.stderr.write(
    `${label}: median ${median.toFixed(2)} ms, max ${max.toFixed(2)} ms over ${times.length}\n`,
  );
}

/** Solves base, then times warm re-solves after appending one term at a time (each from the same optimum). */
function warmTimes(base: Problem, append: (p: Problem) => Problem): number[] {
  const s = new Float64Array(N);
  expect(solve(base, s).converged).toBe(true);
  const times: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const p = append(base);
    const warm = Float64Array.from(s);
    const start = performance.now();
    const result = solve(p, warm);
    times.push(performance.now() - start);
    expect(result.converged).toBe(true);
  }
  return times;
}

describe.runIf(process.env.PERF === '1')('solver timing', () => {
  it('warm re-solve after one appended pair (10,000 pairs)', () => {
    const { pairs, pair } = answers(11, 0);
    report(
      'pair',
      warmTimes(baseProblem(pairs), (p) => ({ ...p, pairs: [...p.pairs, pair()] })),
    );
  }, 120000);

  it('warm re-solve after one appended draw (80% draws)', () => {
    const { pairs, draw } = answers(12, 0.8);
    report(
      'draw',
      warmTimes(baseProblem(pairs), (p) => ({ ...p, pairs: [...p.pairs, ...draw()] })),
    );
  }, 120000);

  it('cold solve (80% draws)', () => {
    const { pairs } = answers(13, 0.8);
    const p = baseProblem(pairs);
    const times: number[] = [];
    for (let r = 0; r < 5; r++) {
      const s = new Float64Array(N);
      const start = performance.now();
      expect(solve(p, s).converged).toBe(true);
      times.push(performance.now() - start);
    }
    report('cold draw-heavy', times);
  }, 120000);
});
