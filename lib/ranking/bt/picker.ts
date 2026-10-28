import {
  K,
  MAX_SHOWINGS,
  PICKER_EXACT_CHECKS,
  PICKER_OFFSETS,
  REPEAT_FACTOR,
  SCORE_GRID,
} from '@/lib/ranking/bt/constants';
import { normalTail } from '@/lib/ranking/bt/progress';
import { pairKey } from '@/lib/ranking/bt/splitPairs';

export { pairKey } from '@/lib/ranking/bt/splitPairs';

export interface PickerInput {
  /** Offerable slots (visible) in displayed order. */
  order: readonly number[];
  strengths: Float64Array;
  uncertainty: Float64Array; // u = 1 / H_ii
  /** Times each unordered pair has been shown, keyed by pairKey. */
  shown: ReadonlyMap<number, number>;
  /** pairKey of the immediately previous pair question, if any. */
  previousPair?: number;
  /**
   * Each pair's chance of being the wrong way round, read from the answers
   * (flips.ts). Without it, the Gaussian estimate stands in.
   */
  flips?: { chance(a: number, b: number): number };
}

/**
 * How much one answer to the pair could settle its order (docs/ARCHITECTURE.md 6.7): the
 * answer's information about the gap, p (1 - p) / c2, times the gap's
 * uncertainty, so a pair the engine already knows the gap of scores little.
 */
function resolving(input: PickerInput, a: number, b: number): number {
  const { strengths, uncertainty } = input;
  const spread = (uncertainty[a] ?? 0) + (uncertainty[b] ?? 0);
  const c2 = K * K + spread;
  const p = 1 / (1 + Math.exp(-((strengths[a] ?? 0) - (strengths[b] ?? 0)) / Math.sqrt(c2)));
  return ((p * (1 - p)) / c2) * spread;
}

/** The Gaussian estimate of the pair's chance of being the wrong way round. */
function gaussianFlip(input: PickerInput, a: number, b: number): number {
  const { strengths, uncertainty } = input;
  const gap = Math.abs((strengths[a] ?? 0) - (strengths[b] ?? 0));
  const spread = (uncertainty[a] ?? 0) + (uncertainty[b] ?? 0);
  if (!(spread > 0)) return gap > 0 ? 0 : 0.5;
  return normalTail(gap / Math.sqrt(spread));
}

/** The discount for a pair shown `times` before: 0.3 per showing, and next to nothing from MAX_SHOWINGS on. */
function repeatDiscount(input: PickerInput, a: number, b: number): number {
  // Skip the lookup when nothing has been shown (the common cold start).
  const times = input.shown.size === 0 ? 0 : (input.shown.get(pairKey(a, b)) ?? 0);
  if (times === 0) return 1;
  return times >= MAX_SHOWINGS ? REPEAT_FACTOR ** times * SCORE_GRID : REPEAT_FACTOR ** times;
}

/**
 * Index of the first score, in scan order, that shares the best score's grid
 * value, or -1 when there are none. Scores are rounded to SCORE_GRID of the
 * best, so near-equal scores tie and the earliest (higher-ranked) wins. A best
 * of 0 or less cannot define a grid, so raw scores are compared instead.
 */
function firstOnBestGrid(scores: Float64Array, count: number): number {
  if (count === 0) return -1;
  let best = -Infinity;
  for (let i = 0; i < count; i++) {
    const s = scores[i] as number;
    if (s > best) best = s;
  }
  const step = best * SCORE_GRID;
  if (!(step > 0)) {
    for (let i = 0; i < count; i++) if (scores[i] === best) return i;
    return -1;
  }
  const target = Math.round(best / step);
  for (let i = 0; i < count; i++) {
    if (Math.round((scores[i] as number) / step) === target) return i;
  }
  return -1;
}

/**
 * The indices of the `size` best scores, best first, compared on the grid
 * (rounded to SCORE_GRID of the best) so near-equal scores keep scan order and
 * warm and fresh replays agree. A best of 0 or less cannot define a grid, so
 * raw scores are compared instead.
 */
function shortlist(scores: Float64Array, count: number, size: number): number[] {
  let best = -Infinity;
  for (let i = 0; i < count; i++) best = Math.max(best, scores[i] as number);
  const step = best * SCORE_GRID;
  const key = (i: number): number =>
    step > 0 ? Math.round((scores[i] as number) / step) : (scores[i] as number);
  const kept: number[] = [];
  const keys: number[] = [];
  for (let i = 0; i < count; i++) {
    const k = key(i);
    // Scanning in order, an equal key never displaces an earlier one.
    if (kept.length === size && k <= (keys[size - 1] as number)) continue;
    let at = kept.length;
    while (at > 0 && (keys[at - 1] as number) < k) at--;
    kept.splice(at, 0, i);
    keys.splice(at, 0, k);
    if (kept.length > size) {
      kept.pop();
      keys.pop();
    }
  }
  return kept;
}

/** `score` is below `bar` by more than SCORE_GRID of it, so a hair's difference never decides. */
function below(score: number, bar: number): boolean {
  return bar > 0 && score < bar * (1 - SCORE_GRID);
}

/**
 * Best pair as positions in `order`, scanning positions then offsets ascending.
 *
 * A pair scores its chance of being the wrong way round times how much an
 * answer could settle it, discounted for repeats. Every candidate is first
 * scored with the Gaussian chance, which is cheap; the exact chance (flips.ts)
 * then replaces it for the best PICKER_EXACT_CHECKS of them, taken best first,
 * until the next Gaussian score is below the best exact one. The Gaussian
 * chance is the higher of the two for the usual lopsided evidence (an item
 * that keeps winning), so a candidate left unchecked would rarely have won.
 */
function bestPairPositions(input: PickerInput): [number, number] | null {
  const { order, previousPair, flips } = input;
  const n = order.length;
  if (n < 2) return null;
  const capacity = n * PICKER_OFFSETS.length;
  const scores = new Float64Array(capacity);
  const first = new Int32Array(capacity);
  const second = new Int32Array(capacity);
  let count = 0;
  for (let p = 0; p < n; p++) {
    const a = order[p] as number;
    for (const offset of PICKER_OFFSETS) {
      const q = p + offset;
      if (q >= n) break;
      const b = order[q] as number;
      if (previousPair !== undefined && pairKey(a, b) === previousPair) continue;
      scores[count] = gaussianFlip(input, a, b) * resolving(input, a, b) * repeatDiscount(input, a, b);
      first[count] = p;
      second[count] = q;
      count++;
    }
  }
  if (flips && count > 0) {
    const exact = new Float64Array(count).fill(-Infinity);
    let bestExact = -Infinity;
    // Only the checked candidates compete: the rest scored below the best exact score, or past the checks.
    for (const i of shortlist(scores, count, PICKER_EXACT_CHECKS)) {
      if (below(scores[i] as number, bestExact)) break;
      const a = order[first[i] as number] as number;
      const b = order[second[i] as number] as number;
      exact[i] = flips.chance(a, b) * resolving(input, a, b) * repeatDiscount(input, a, b);
      bestExact = Math.max(bestExact, exact[i] as number);
    }
    const pick = firstOnBestGrid(exact, count);
    if (pick >= 0) return [first[pick] as number, second[pick] as number];
  }
  const pick = firstOnBestGrid(scores, count);
  return pick < 0 ? null : [first[pick] as number, second[pick] as number];
}

export function pickPair(input: PickerInput): [number, number] | null {
  const positions = bestPairPositions(input);
  if (!positions) return null;
  return [input.order[positions[0]] as number, input.order[positions[1]] as number];
}
