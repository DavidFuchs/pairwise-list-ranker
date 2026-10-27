import { FlipChances, type FitEvidence } from '@/lib/ranking/bt/flips';

/**
 * How close the shown order is to the one the user's answers describe
 * (docs/ARCHITECTURE.md 6.12), as a few levels. It is read from the engine's own
 * strengths and uncertainties, never from anything the user could not have
 * told it. The levels are a guide, not a promise: tests/unit/sim/progressGate.test.ts
 * holds each one to the accuracy the simulation measured for it
 * (docs/engine-calibration.md, "Progress levels").
 */

/**
 * The chance a standard normal draw is below -|x| (Abramowitz and Stegun
 * 7.1.26 through erfc). Only the lower tail is used, so it is continuous at 0:
 * the two-sided form steps by about 1e-9 there, which is as much as the
 * picker's tie grid, and would let a gap of 0 and one of 1e-34 score apart.
 */
export function normalTail(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return 0.5 * poly * Math.exp(-z * z);
}

/** A pair this many standard deviations apart is taken to be in order: its chance of a flip is below 1e-9. */
const SURE_SDS = 6;

/** An item whose uncertainty is this many times the median is "wide": it is compared with everything, not just near neighbours. */
const WIDE_TIMES_MEDIAN = 4;

/**
 * The expected share of the list the shown order is off by: for every pair, the
 * chance that its order is the wrong way round given the two strengths and
 * uncertainties, summed over both items of each pair, over the list length
 * squared. 0 for a list with nothing left in doubt.
 *
 * Only pairs near each other in strength can flip, so each item is compared with
 * its neighbours until the gap is too wide. A few items can be far more
 * uncertain than the rest (one moved by hand has a wide prior), and a bound
 * that allowed for the widest of them would make every comparison reach
 * everywhere; those "wide" items are therefore handled apart, against the whole
 * list, and the rest are bounded by the widest of the rest. That keeps the cost
 * near linear in a settled list, which is when it is read.
 *
 * `cap` stops the work once the disorder is known to be at least that much:
 * the result is then somewhere from `cap` to the true value, which is all a
 * level above its highest boundary needs.
 *
 * `chance` gives a pair's chance of being the wrong way round, by index into
 * the arrays, the lower index first: the arrays are in displayed order, so it
 * is the item shown above. Without it, the Gaussian estimate from the two
 * uncertainties is used. The uncertainties still bound which pairs are looked
 * at.
 *
 * `onPair` hears every pair looked at, by index as for `chance`, with its
 * chance.
 */
export function expectedDisorder(
  strengths: readonly number[],
  uncertainties: readonly number[],
  cap = Infinity,
  chance?: (i: number, j: number) => number,
  onPair?: (i: number, j: number, chance: number) => void,
): number {
  const n = strengths.length;
  if (n < 2) return 0;

  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (strengths[b] as number) - (strengths[a] as number),
  );
  const s = order.map((i) => strengths[i] as number);
  const u = order.map((i) => uncertainties[i] as number);
  const median = [...u].sort((a, b) => a - b)[Math.floor(n / 2)] as number;
  const wideFrom = WIDE_TIMES_MEDIAN * median;

  // Positions in strength order, split by how uncertain the item is.
  const narrow: number[] = [];
  const wide: number[] = [];
  let narrowWidest = 0;
  for (let k = 0; k < n; k++) {
    if ((u[k] as number) > wideFrom) {
      wide.push(k);
    } else {
      narrow.push(k);
      narrowWidest = Math.max(narrowWidest, u[k] as number);
    }
  }
  const narrowStrengths = narrow.map((k) => s[k] as number);

  const limit = (cap * n * n) / 2;
  let flips = 0;
  const chanceAt = chance
    ? (i: number, j: number): number => {
        const a = order[i] as number;
        const b = order[j] as number;
        return a < b ? chance(a, b) : chance(b, a);
      }
    : (i: number, j: number): number =>
        normalTail(
          Math.abs((s[i] as number) - (s[j] as number)) / Math.sqrt((u[i] as number) + (u[j] as number)),
        );
  const flip = onPair
    ? (i: number, j: number): number => {
        const value = chanceAt(i, j);
        const a = order[i] as number;
        const b = order[j] as number;
        if (a < b) onPair(a, b, value);
        else onPair(b, a, value);
        return value;
      }
    : chanceAt;

  // Narrow against narrow: nearest neighbours down the order, until the gap is sure.
  for (let a = 0; a < narrow.length; a++) {
    const i = narrow[a] as number;
    const reach = SURE_SDS * Math.sqrt((u[i] as number) + narrowWidest);
    for (let b = a + 1; b < narrow.length; b++) {
      const j = narrow[b] as number;
      if ((s[i] as number) - (s[j] as number) > reach) break;
      flips += flip(i, j);
    }
    if (flips >= limit) return (2 * flips) / (n * n);
  }

  // Each wide item against the narrow ones near it, and against the other wide ones.
  for (let w = 0; w < wide.length; w++) {
    const i = wide[w] as number;
    const reach = SURE_SDS * Math.sqrt((u[i] as number) + narrowWidest);
    // The first narrow item at or below this one in strength (the strengths run downward).
    let low = 0;
    let high = narrow.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((narrowStrengths[mid] as number) > (s[i] as number)) low = mid + 1;
      else high = mid;
    }
    for (let b = low; b < narrow.length; b++) {
      const j = narrow[b] as number;
      if ((s[i] as number) - (s[j] as number) > reach) break;
      flips += flip(i, j);
    }
    for (let b = low - 1; b >= 0; b--) {
      const j = narrow[b] as number;
      if ((s[j] as number) - (s[i] as number) > reach) break;
      flips += flip(i, j);
    }
    for (let v = w + 1; v < wide.length; v++) flips += flip(i, wide[v] as number);
    if (flips >= limit) return (2 * flips) / (n * n);
  }
  return (2 * flips) / (n * n);
}

/**
 * The disorder of the shown items from an engine state: null when the state
 * carries no fit (a view shown from a cached snapshot before its session
 * starts). Items without a strength, such as unrecognized ones, are left out.
 *
 * A list under 26 items reads each pair's chance from the answers themselves
 * (flips.ts). The Gaussian estimate doubts an item that has won or lost every
 * answer, and on a short list those items are a large share: it read six
 * items as "Taking shape" with only three of them in doubt. A longer list
 * keeps the Gaussian estimate, which means the same at every size from 26 up;
 * the exact chances did not (docs/engine-calibration.md, "Flip chances").
 */
export function disorderOfState(state: {
  ranked: readonly string[];
  fit?: FitEvidence;
  slots?: ReadonlyMap<string, number>;
}): number | null {
  return walkState(state, DISORDER_CAP);
}

/** A pair of shown items, the one shown above first, and its chance of being the wrong way round. */
export interface PairChance {
  above: string;
  below: string;
  chance: number;
}

/**
 * Every pair the disorder is summed over, with the chance the progress level
 * reads for it, uncapped: what the progress explainer ranks the doubts by.
 * Null without a fit, as for disorderOfState.
 */
export function pairChances(state: {
  ranked: readonly string[];
  fit?: FitEvidence;
  slots?: ReadonlyMap<string, number>;
}): PairChance[] | null {
  const pairs: PairChance[] = [];
  const found = walkState(state, Infinity, (above, below, chance) => pairs.push({ above, below, chance }));
  return found === null ? null : pairs;
}

/** disorderOfState's walk, with `longCap` as the cap for a long list, telling `onPair` each pair by id. */
function walkState(
  state: { ranked: readonly string[]; fit?: FitEvidence; slots?: ReadonlyMap<string, number> },
  longCap: number,
  onPair?: (above: string, below: string, chance: number) => void,
): number | null {
  const { fit, slots } = state;
  if (fit === undefined || slots === undefined) return null;
  const ids = state.ranked.filter((id) => slots.has(id));
  const fitted = ids.map((id) => slots.get(id) as number);
  const strengths = fitted.map((slot) => fit.strengths[slot] as number);
  const uncertainties = fitted.map((slot) => fit.uncertainty[slot] as number);
  const heard =
    onPair && ((i: number, j: number, chance: number) => onPair(ids[i] as string, ids[j] as string, chance));
  if (fitted.length >= MIN_ITEMS_FOR_PAIR_SCALE)
    return expectedDisorder(strengths, uncertainties, longCap, undefined, heard);
  const flips = new FlipChances(fit);
  return expectedDisorder(
    strengths,
    uncertainties,
    Infinity,
    (i, j) => flips.chance(fitted[i] as number, fitted[j] as number),
    heard,
  );
}

/**
 * Past this the level is the lowest whatever the exact disorder is (the lowest
 * level's boundary, 0.07, plus the margin a level must fall back by), so the
 * calculation stops once it is reached.
 */
const DISORDER_CAP = 0.1;

/** How far along the shown order is, lowest first. */
export type ProgressLevel = 0 | 1 | 2 | 3;

/**
 * Lists shorter than this read their levels in places, not in shares of the
 * list: the 5% window is a place or two, so the same disorder means a smaller
 * share of items out of place (docs/engine-calibration.md, "Progress levels").
 * They also read each pair's chance from the answers (disorderOfState).
 */
export const MIN_ITEMS_FOR_PAIR_SCALE = 26;

/**
 * Where each level begins, as the largest disorder it allows. The true share
 * of items within 5% of their place averaged about 40% at level 0, 80% at 1,
 * 96% at 2 and 99% at 3, for unordered and rough starts of 26 items and more.
 * "Close" began at 0.03 until the picker asked for flips (docs/engine-calibration.md,
 * "Flip chances").
 */
const LEVEL_CEILINGS: readonly number[] = [Infinity, 0.07, 0.025, 0.02];

/**
 * The same for a list under 26 items, in expected places out (the disorder
 * times the list length), read from the exact chances, which means the same
 * at every small size. Within a place of the true one: about 53% of items at
 * level 0, 85% at 1, 96% at 2 and 99.6% at 3.
 */
const SMALL_LEVEL_CEILINGS_IN_PLACES: readonly number[] = [Infinity, 1.0, 0.4, 0.25];

function ceilingsFor(n: number): readonly number[] {
  return n >= MIN_ITEMS_FOR_PAIR_SCALE
    ? LEVEL_CEILINGS
    : SMALL_LEVEL_CEILINGS_IN_PLACES.map((places) => places / n);
}

/** To fall back a level the disorder must pass the boundary by this much, so a level does not flicker. */
const FALL_BACK_MARGIN = 1.1;

/** The level a disorder is in for a list of `n` items, with no memory of the one before. */
export function levelOf(disorder: number, n: number): ProgressLevel {
  const ceilings = ceilingsFor(n);
  for (let level = 3; level > 0; level--) {
    if (disorder < (ceilings[level] as number)) return level as ProgressLevel;
  }
  return 0;
}

/**
 * The level to show now: it rises as soon as the disorder allows, and falls
 * only once the disorder has passed the boundary it stands on by a margin.
 */
export function settleLevel(previous: ProgressLevel | null, disorder: number, n: number): ProgressLevel {
  const now = levelOf(disorder, n);
  if (previous === null || now >= previous) return now;
  const holds = disorder < (ceilingsFor(n)[previous] as number) * FALL_BACK_MARGIN;
  return holds ? previous : now;
}
