import { seededRandom } from '@/tests/helpers/random';
import type { PairOutcome } from '@/types/rankingEvents';

export type UserModel = 'careful' | 'typical' | 'fuzzy' | 'sloppy';

/**
 * Perception noise (sd on a 0..1 utility) and the share of careless taps: the
 * harness's own values.
 */
const USERS: Record<UserModel, { s: number; lapse: number }> = {
  careful: { s: 0.005, lapse: 0 },
  typical: { s: 0.0173, lapse: 0 },
  fuzzy: { s: 0.04, lapse: 0 },
  sloppy: { s: 0.0173, lapse: 0.05 },
};

/** A perceived gap above this reads as "much better". */
export const STRONG_GAP = 0.3;

/** A standard normal draw (Box-Muller). */
export function gaussian(random: () => number): number {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

export interface SimUser {
  /** Left versus right. With allowDraw, a perceived gap under the user's noise is a draw. */
  pair(a: string, b: string, options?: { allowDraw?: boolean }): PairOutcome;
}

/**
 * A simulated user. trueRank is 0 for the best item; each item's perceived
 * utility is 1 - trueRank / n plus Gaussian noise (Thurstone), as in the
 * bake-off script.
 */
export function makeUser(
  model: UserModel,
  seed: number,
  trueRank: (id: string) => number,
  n: number,
): SimUser {
  const { s, lapse } = USERS[model];
  const random = seededRandom(seed);
  const seen = (id: string): number => 1 - trueRank(id) / n + s * gaussian(random);
  return {
    pair(a, b, { allowDraw = false } = {}) {
      const pa = seen(a);
      const pb = seen(b);
      const gap = Math.abs(pa - pb);
      if (allowDraw && gap < s) return 'draw';
      let leftWins = pa > pb;
      if (random() < lapse) leftWins = random() < 0.5;
      const strong = gap > STRONG_GAP;
      if (leftWins) return strong ? 'left_strong' : 'left';
      return strong ? 'right_strong' : 'right';
    },
  };
}
