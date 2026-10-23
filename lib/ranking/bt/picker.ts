import { K, PICKER_OFFSETS, REPEAT_FACTOR, SCORE_GRID } from '@/lib/ranking/bt/constants';

export interface PickerInput {
  /** Offerable slots (visible) in displayed order. */
  order: readonly number[];
  strengths: Float64Array;
  uncertainty: Float64Array; // u = 1 / H_ii
  /** Times each unordered pair has been shown, keyed by pairKey. */
  shown: ReadonlyMap<number, number>;
  /** pairKey of the immediately previous pair question, if any. */
  previousPair?: number;
}

/**
 * Order-independent key for an unordered pair of slots: the pair's index in
 * the triangle of all pairs, so it is unique without knowing how many slots
 * there are. A number keeps the picker's many lookups free of string building.
 */
export function pairKey(a: number, b: number): number {
  const high = a > b ? a : b;
  const low = a > b ? b : a;
  return (high * (high + 1)) / 2 + low;
}

/** Spec 6.5 score of showing slots a and b, including the repeat discount. */
function pairScore(input: PickerInput, a: number, b: number): number {
  const { strengths, uncertainty, shown } = input;
  const uA = uncertainty[a] ?? 0;
  const uB = uncertainty[b] ?? 0;
  const c2 = K * K + uA + uB;
  const p = 1 / (1 + Math.exp(-((strengths[a] ?? 0) - (strengths[b] ?? 0)) / Math.sqrt(c2)));
  const info = (p * (1 - p)) / c2;
  const score = (uA * uA * info) / (1 + uA * info) + (uB * uB * info) / (1 + uB * info);
  // Skip the lookup when nothing has been shown (the common cold start).
  const times = shown.size === 0 ? 0 : (shown.get(pairKey(a, b)) ?? 0);
  return times === 0 ? score : score * REPEAT_FACTOR ** times;
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

/** Best pair as positions in `order`, scanning positions then offsets ascending. */
function bestPairPositions(input: PickerInput): [number, number] | null {
  const { order, previousPair } = input;
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
      scores[count] = pairScore(input, a, b);
      first[count] = p;
      second[count] = q;
      count++;
    }
  }
  const pick = firstOnBestGrid(scores, count);
  return pick < 0 ? null : [first[pick] as number, second[pick] as number];
}

export function pickPair(input: PickerInput): [number, number] | null {
  const positions = bestPairPositions(input);
  if (!positions) return null;
  return [input.order[positions[0]] as number, input.order[positions[1]] as number];
}
