/**
 * Accuracy measures for a shown order against a (possibly tied) truth.
 * Places are 1-based and relative to the shown set.
 */

export interface Truth {
  /** The inclusive range of places the item may occupy (equal ends for a strict order). */
  span(id: string): [number, number];
}

export interface Measures {
  /** Mean displacement, in places. */
  mean: number;
  median: number;
  /** Mean displacement of the worst tenth of items, in places. */
  worstDecile: number;
  /** Share of items within max(1, 5% of n) places of their span. */
  within5: number;
  /** Share of items within max(1, 1% of n) places of their span. */
  within1: number;
  /** Share of truth-ordered pairs that the shown order has the right way round. */
  kendall: number;
  /** Share of the shown top min(20, n) that could be in the true top min(20, n). */
  top20: number;
}

function displacement(place: number, [lo, hi]: [number, number]): number {
  if (place < lo) return lo - place;
  if (place > hi) return place - hi;
  return 0;
}

export function measure(shown: readonly string[], truth: Truth): Measures {
  const n = shown.length;
  const spans = shown.map((id) => truth.span(id));
  const disp = spans.map((span, i) => displacement(i + 1, span));
  const share = (limit: number): number => (n === 0 ? 1 : disp.filter((d) => d <= limit).length / n);

  const sorted = [...disp].sort((a, b) => a - b);
  const mean = n === 0 ? 0 : disp.reduce((sum, d) => sum + d, 0) / n;
  const median = n === 0 ? 0 : n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  const tail = sorted.slice(n - Math.ceil(n / 10));
  const worstDecile = tail.length === 0 ? 0 : tail.reduce((sum, d) => sum + d, 0) / tail.length;

  let ordered = 0;
  let agree = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = spans[i]!;
      const b = spans[j]!;
      if (a[1] < b[0]) {
        ordered++;
        agree++;
      } else if (b[1] < a[0]) {
        ordered++;
      }
    }
  }

  const k = Math.min(20, n);
  const top20 = k === 0 ? 1 : spans.slice(0, k).filter(([lo]) => lo <= k).length / k;

  return {
    mean,
    median,
    worstDecile,
    within5: share(Math.max(1, 0.05 * n)),
    within1: share(Math.max(1, 0.01 * n)),
    kendall: ordered === 0 ? 1 : agree / ordered,
    top20,
  };
}

/** The answers count of the first sample at or above `threshold`, or null if none gets there. */
export function answersToThreshold(
  samples: readonly { answers: number; within5: number }[],
  threshold: number,
): number | null {
  return samples.find((s) => s.within5 >= threshold)?.answers ?? null;
}
