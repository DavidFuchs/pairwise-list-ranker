import { gaussian } from '@/tests/helpers/simUser';
import { seededRandom, shuffled } from '@/tests/helpers/random';
import type { Truth } from '@/tests/sim/measures';
import type { StartingOrder } from '@/types/rankingEvents';

/** How the true values are shaped. */
export type TruthKind = 'uniform' | 'tied' | 'gaps';

/** How well the declared starting order matches the truth. */
export type ImportQuality = 'honest' | 'loose' | 'reversedSections';

/**
 * Starting-order noise as a fraction of the list length, in positions. This is
 * a copy of the numbers in drivenHistory (tests/helpers/engineCorpus.ts), which
 * keeps its own so that its seeded histories do not change.
 */
const RANKED_NOISE = 0.02;
const ROUGH_NOISE = 0.15;

/** The number of large steps in a `gaps` world. */
const GAP_STEPS = 4;

export interface World {
  /** Every item id, in import order (item `i<k>` is the k-th in the import). */
  ids: string[];
  /** The true utility on 0..1, best highest. */
  value(id: string): number;
  /** Each shown item's tie-aware span among the shown items only (places from 1). */
  truthOver(shown: readonly string[]): Truth;
  /** The strict rank, 0 for the best, with ties in value broken by id. */
  trueRank(id: string): number;
  /**
   * A change of heart: picks max(minItems, round(share * n)) items and gives
   * each the value of the next in a shuffled order (the last takes the
   * first's), so every picked item changes value and the set of values stays
   * the same. Every reading after it sees the new values. Returns the picked ids.
   */
  drift(share: number, minItems: number, random: () => number): string[];
}

/** Import position to true rank (0 is best), before any ties are applied. */
function orderFor(
  n: number,
  startingOrder: StartingOrder,
  quality: ImportQuality,
  random: () => number,
): number[] {
  const noisy = (noise: number): number[] => {
    const rank = new Array<number>(n);
    Array.from({ length: n }, (_, position) => ({ position, key: position + gaussian(random) * noise * n }))
      .sort((a, b) => a.key - b.key)
      .forEach(({ position }, r) => {
        rank[position] = r;
      });
    return rank;
  };
  if (quality === 'loose') return noisy(ROUGH_NOISE);
  if (quality === 'reversedSections') {
    const size = Math.max(1, Math.floor(n / 5));
    return Array.from({ length: n }, (_, p) => {
      const start = Math.floor(p / size) * size;
      const end = Math.min(n, start + size);
      return start + (end - 1 - p);
    });
  }
  if (startingOrder === 'unordered') {
    const rank = new Array<number>(n);
    shuffled(
      Array.from({ length: n }, (_, p) => p),
      random,
    ).forEach((position, r) => {
      rank[position] = r;
    });
    return rank;
  }
  return noisy(startingOrder === 'ranked' ? RANKED_NOISE : ROUGH_NOISE);
}

/** True values from true ranks (0 is best), shaped by `kind`. */
function valuesFor(n: number, kind: TruthKind, random: () => number): number[] {
  if (kind === 'uniform') return Array.from({ length: n }, (_, r) => 1 - r / n);
  if (kind === 'tied') {
    // Clusters of 2 to 6 consecutive ranks share the value of the cluster's best rank.
    const values: number[] = [];
    while (values.length < n) {
      let size = 2 + Math.floor(random() * 5);
      if (n - values.length - size < 2) size = n - values.length;
      const start = values.length;
      for (let k = 0; k < size; k++) values.push(1 - start / n);
    }
    return values;
  }
  // gaps: a few cuts, each adding a step of half the list's width among the unit steps.
  const cuts = new Set(
    shuffled(
      Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1),
      random,
    ).slice(0, GAP_STEPS),
  );
  const raw: number[] = [];
  let height = 0;
  for (let r = 0; r < n; r++) {
    if (cuts.has(r)) height += n / 2;
    raw.push(height + r);
  }
  const top = raw[n - 1] || 1;
  return raw.map((x) => 1 - x / (top + 1));
}

export function makeWorld(options: {
  n: number;
  kind: TruthKind;
  startingOrder: StartingOrder;
  quality: ImportQuality;
  seed: number;
}): World {
  const { n, kind, startingOrder, quality, seed } = options;
  const random = seededRandom(seed);
  const rank = orderFor(n, startingOrder, quality, random);
  const byRank = valuesFor(n, kind, random);
  const ids = Array.from({ length: n }, (_, k) => `i${k}`);
  const values = new Map<string, number>(ids.map((id, k) => [id, byRank[rank[k]!]!]));
  let strict: Map<string, number> | null = null;

  const strictRanks = (): Map<string, number> => {
    if (strict === null) {
      strict = new Map();
      [...values.keys()]
        .sort((a, b) => values.get(b)! - values.get(a)! || (a < b ? -1 : a > b ? 1 : 0))
        .forEach((id, r) => strict!.set(id, r));
    }
    return strict;
  };

  return {
    ids,
    value: (id) => values.get(id)!,
    trueRank: (id) => strictRanks().get(id)!,
    drift(share, minItems, random) {
      const count = Math.min(ids.length, Math.max(minItems, Math.round(share * ids.length)));
      const picked = shuffled(ids, random).slice(0, count);
      const old = picked.map((id) => values.get(id)!);
      picked.forEach((id, k) => values.set(id, old[(k + 1) % count]!));
      strict = null;
      return picked;
    },
    truthOver(shown) {
      const spans = new Map<string, [number, number]>();
      for (const id of shown) {
        const v = values.get(id)!;
        let above = 0;
        let equal = 0;
        for (const other of shown) {
          const w = values.get(other)!;
          if (w > v) above++;
          else if (w === v) equal++;
        }
        spans.set(id, [above + 1, above + equal]);
      }
      return { span: (id) => spans.get(id)! };
    },
  };
}
