/**
 * Candidate "how close is this ranking" signals, computed from what the app
 * could know at a point in a run (the shown order and the engine's strengths
 * and uncertainties), for comparison against the truth in signals.sim.ts.
 */

/** The standard normal CDF (Abramowitz and Stegun 7.1.26 through erf). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * The engine's belief about each item's displacement, from its strengths and
 * uncertainties: item i's expected number of places off is the sum, over the
 * other items, of the chance that the pair's order is the wrong way round,
 * `Phi(-|s_i - s_j| / sqrt(scale * (u_i + u_j)))`. `scale` inflates the
 * uncertainties, which the engine documents as understated.
 */
export function expectedDisplacements(
  strengths: readonly number[],
  uncertainties: readonly number[],
  scale: number,
): number[] {
  const n = strengths.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sd = Math.sqrt(scale * ((uncertainties[i] as number) + (uncertainties[j] as number)));
      const flip = normalCdf(-Math.abs((strengths[i] as number) - (strengths[j] as number)) / sd);
      out[i] = (out[i] as number) + flip;
      out[j] = (out[j] as number) + flip;
    }
  }
  return out;
}

/** The share of items whose expected displacement is within `limit` places. */
export function predictedWithin(expected: readonly number[], limit: number): number {
  return expected.length === 0 ? 1 : expected.filter((d) => d <= limit).length / expected.length;
}

/** Mean absolute change of place between two shown orders of the same items, over the list length. */
export function meanMovement(previous: ReadonlyMap<string, number>, shown: readonly string[]): number {
  if (shown.length === 0) return 0;
  let total = 0;
  shown.forEach((id, place) => {
    total += Math.abs(place - (previous.get(id) ?? place));
  });
  return total / shown.length / shown.length;
}
