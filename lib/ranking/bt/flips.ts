import { K } from '@/lib/ranking/bt/constants';
import type { PairTerm } from '@/lib/ranking/bt/evidence';

/**
 * What a fit leaves for reading how sure it is of each pair's order: the
 * fitted strengths, each slot's prior, its uncertainty (u = 1 / H_ii) and the
 * answered pairs, all by slot. Copies, so a state keeps its own after the
 * session moves on.
 */
export interface FitEvidence {
  strengths: Float64Array;
  uncertainty: Float64Array;
  priorMean: Float64Array;
  priorVar: Float64Array;
  pairs: readonly PairTerm[];
}

/** log(sigmoid(d)) without overflow for large |d|. */
function logSigmoid(d: number): number {
  return d >= 0 ? -Math.log1p(Math.exp(-d)) : d - Math.log1p(Math.exp(d));
}

/** A bound on the steps one side takes; with the growing steps below, the curve has always run out well before it. */
const MAX_STEPS = 600;

/** The curve is followed until it is this far (in log terms) below its peak: e^-25 is about 1e-11. */
const TAIL_DROP = 25;

/** Steps per standard deviation of the Gaussian estimate near the peak. */
const STEPS_PER_SD = 12;

/** Past this many steps from the peak, each step is longer by this factor, so a long flat tail is crossed quickly. */
const STEADY_STEPS = 48;
const STEP_GROWTH = 1.08;

/**
 * The chance that a pair's shown order is the wrong way round (docs/ARCHITECTURE.md 6.12).
 *
 * The Gaussian the fit's curvature describes is symmetric, and the evidence
 * often is not: an item that has won every answer is surely above the ones it
 * beat, and only unsure how far. The Gaussian puts as much weight below as
 * above, so it reads such a pair as doubtful (a 23% chance against an exact 1%
 * on one six-item list; docs/engine-calibration.md, "Flip chances"). Instead
 * this follows the true posterior along the pair's gap, with every other item
 * held where the fit put it, and integrates it on both sides of zero.
 *
 * The two items move against each other in proportion to their own
 * uncertainties, so an item the answers pin down barely moves and a loose one
 * takes most of the change; for a Gaussian posterior this gives the same
 * chance as the Gaussian estimate.
 */
export class FlipChances {
  private readonly evidence: FitEvidence;
  /** Each slot's pair terms: other slot, weight, and +1 for a win or -1 for a loss. */
  private readonly other: Int32Array;
  private readonly weight: Float64Array;
  private readonly sign: Int8Array;
  private readonly start: Int32Array;

  constructor(evidence: FitEvidence) {
    this.evidence = evidence;
    const size = evidence.strengths.length;
    const counts = new Int32Array(size + 1);
    for (const pair of evidence.pairs) {
      counts[pair.winner + 1] = (counts[pair.winner + 1] as number) + 1;
      counts[pair.loser + 1] = (counts[pair.loser + 1] as number) + 1;
    }
    for (let i = 0; i < size; i++) counts[i + 1] = (counts[i + 1] as number) + (counts[i] as number);
    this.start = counts.slice();
    const fill = counts.slice(0, size);
    const total = evidence.pairs.length * 2;
    this.other = new Int32Array(total);
    this.weight = new Float64Array(total);
    this.sign = new Int8Array(total);
    for (const pair of evidence.pairs) {
      const w = fill[pair.winner] as number;
      this.other[w] = pair.loser;
      this.weight[w] = pair.weight;
      this.sign[w] = 1;
      fill[pair.winner] = w + 1;
      const l = fill[pair.loser] as number;
      this.other[l] = pair.winner;
      this.weight[l] = pair.weight;
      this.sign[l] = -1;
      fill[pair.loser] = l + 1;
    }
  }

  /**
   * The log posterior, up to a constant, with slot `a` moved by `da` and `b`
   * by `db` and every other slot at its fitted strength.
   */
  private logCurve(a: number, b: number, da: number, db: number): number {
    const { strengths, priorMean, priorVar } = this.evidence;
    const sa = (strengths[a] as number) + da;
    const sb = (strengths[b] as number) + db;
    const pa = sa - (priorMean[a] as number);
    const pb = sb - (priorMean[b] as number);
    let total = -(pa * pa) / (2 * (priorVar[a] as number)) - (pb * pb) / (2 * (priorVar[b] as number));
    for (let k = this.start[a] as number; k < (this.start[a + 1] as number); k++) {
      const c = this.other[k] as number;
      const sc = c === b ? sb : (strengths[c] as number);
      total += (this.weight[k] as number) * logSigmoid(((this.sign[k] as number) * (sa - sc)) / K);
    }
    for (let k = this.start[b] as number; k < (this.start[b + 1] as number); k++) {
      const c = this.other[k] as number;
      // Terms between a and b were counted with a.
      if (c === a) continue;
      total +=
        (this.weight[k] as number) *
        logSigmoid(((this.sign[k] as number) * (sb - (strengths[c] as number))) / K);
    }
    return total;
  }

  /**
   * The chance that slot `below`, shown under slot `above`, in fact belongs
   * above it. The caller says which is shown above, not the strengths: two
   * items tied to within the solver's tolerance are shown in tie order, and
   * the chance must not hang on which of them came out a hair stronger.
   */
  chance(above: number, below: number): number {
    const { strengths, uncertainty } = this.evidence;
    const high = above;
    const low = below;
    // Negative only for a pair shown in tie order against a hair's difference.
    const gap = (strengths[high] as number) - (strengths[low] as number);
    const uHigh = uncertainty[high] as number;
    const uLow = uncertainty[low] as number;
    const spread = uHigh + uLow;
    if (!(spread > 0)) return gap > 0 ? 0 : 0.5;
    const shareHigh = uHigh / spread;
    const shareLow = uLow / spread;
    const sd = Math.sqrt(spread);
    // The curve as a function of the change t in the gap: high moves up by its share, low down by its share.
    const peak = this.logCurve(high, low, 0, 0);
    const at = (t: number): number => Math.exp(this.logCurve(high, low, t * shareHigh, -t * shareLow) - peak);

    // Downward first: once the gap is closed every step is wrong-way weight.
    const down = this.side(at, -1, sd, gap);
    // Nothing measurable on the wrong side: no need to follow the other side.
    if (down.wrong === 0) return 0;
    const up = this.side(at, 1, sd, Infinity);
    const total = down.all + up.all;
    return total > 0 ? Math.min(0.5, down.wrong / total) : 0;
  }

  /**
   * Trapezoid sums of the curve from the peak out one side (direction -1 or
   * +1) until it has dropped TAIL_DROP below the peak. Going down, `gap` is
   * how far down the gap closes, and `wrong` is the part past it; going up,
   * pass Infinity. The steps sit where they would for any gap, and the step
   * the gap closes in is split at that point with one more look at the curve,
   * so the result moves smoothly with the strengths: the picker compares
   * scores to a part in 1e9, and a grid that shifted with the gap would not.
   */
  private side(
    at: (t: number) => number,
    direction: -1 | 1,
    sd: number,
    gap: number,
  ): { all: number; wrong: number } {
    const floor = Math.exp(-TAIL_DROP);
    let step = sd / STEPS_PER_SD;
    let distance = 0;
    let value = 1;
    let all = 0;
    // A gap of 0 or less is closed from the start.
    let wrong = 0;
    for (let i = 0; i < MAX_STEPS; i++) {
      const next = distance + step;
      const nextValue = at(direction * next);
      const area = ((value + nextValue) / 2) * step;
      all += area;
      if (distance >= gap) {
        wrong += area;
      } else if (next > gap) {
        const closing = at(direction * gap);
        wrong += ((closing + nextValue) / 2) * (next - gap);
      }
      distance = next;
      value = nextValue;
      if (value < floor) break;
      if (i + 1 >= STEADY_STEPS) step *= STEP_GROWTH;
    }
    return { all, wrong };
  }
}
