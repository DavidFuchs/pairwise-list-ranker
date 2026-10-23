import { seededRandom } from '@/tests/helpers/random';
import { makeUser, STRONG_GAP, type UserModel } from '@/tests/helpers/simUser';
import type { World } from '@/tests/sim/truth';
import type { PairOutcome } from '@/types/rankingEvents';

/** How often a clear gap is reported as "much better". */
export type StrongUse = 'often' | 'rarely' | 'inconsistent';

export interface Behaviour {
  pair(a: string, b: string, allowDraw: boolean): PairOutcome;
  /** A random item dropped at a place off its true place by more than 10% of the list, or null under 10 items. */
  wrongMove(shown: readonly string[]): { itemId: string; aboveItemId?: string; belowItemId?: string } | null;
}

function plain(outcome: PairOutcome): PairOutcome {
  if (outcome === 'left_strong') return 'left';
  if (outcome === 'right_strong') return 'right';
  return outcome;
}

/** Salts that give each purpose its own substream of an answer. */
const PERCEPTION_SALT = 0x3c6ef372;
const STRONG_COIN_SALT = 0x6a09e667;
const WRONG_MOVE_SALT = 0xbb67ae85;

/** The murmur3 finalizer: a well-mixed 32-bit integer from any 32-bit integer. */
function fmix32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A seed for one purpose of one answer (or one wrong move), from the behaviour's seed. */
function substreamSeed(seed: number, index: number, salt: number): number {
  return fmix32((fmix32((seed ^ salt) >>> 0) + Math.imul(index + 1, 0x9e3779b9)) >>> 0);
}

/**
 * A user who answers as `model` says, behaving as `strong` says.
 *
 * Every answer (each `pair` call) draws
 * from its own substreams, seeded from (seed, answer index, purpose), with a
 * fresh simUser for its perception noise. So answer k of two runs with the same
 * seed sees the same noise and the same behaviour coins, whatever questions came
 * before, and runs under two pickers or two override values stay paired answer
 * by answer. Wrong moves keep their own count and substream.
 */
export function makeBehaviour(options: {
  model: UserModel;
  strong: StrongUse;
  seed: number;
  world: World;
}): Behaviour {
  const { model, strong, seed, world } = options;
  // makeUser perceives 1 - trueRank / n, so handing it (1 - value) * n makes it perceive the world's
  // value exactly, ties included (tied items get equal ranks and so equal perceived utility).
  const n = Math.max(1, world.ids.length);
  const trueRank = (id: string): number => (1 - world.value(id)) * n;
  let answers = 0;
  let wrongMoves = 0;

  /** The user for answer k, with that answer's perception noise. */
  const userFor = (k: number) => makeUser(model, substreamSeed(seed, k, PERCEPTION_SALT), trueRank, n);
  /** One uniform draw for answer k and one purpose. */
  const coin = (k: number, salt: number): number => seededRandom(substreamSeed(seed, k, salt))();

  return {
    pair(a, b, allowDraw) {
      const k = answers++;
      const outcome = userFor(k).pair(a, b, { allowDraw });
      if (strong === 'often' || (outcome !== 'left_strong' && outcome !== 'right_strong')) return outcome;
      if (strong === 'rarely') {
        // Twice simUser's "much better" gap, judged on the true values (the perception noise is under
        // 0.05, so this is the same call to within noise).
        return Math.abs(world.value(a) - world.value(b)) > 2 * STRONG_GAP ? outcome : plain(outcome);
      }
      return coin(k, STRONG_COIN_SALT) < 0.5 ? outcome : plain(outcome);
    },
    wrongMove(shown) {
      if (shown.length < 10) return null;
      const random = seededRandom(substreamSeed(seed, wrongMoves++, WRONG_MOVE_SALT));
      const itemId = shown[Math.floor(random() * shown.length)] as string;
      const others = shown.filter((id) => id !== itemId);
      const truePlace = others.filter((id) => world.trueRank(id) < world.trueRank(itemId)).length;
      const far: number[] = [];
      for (let target = 0; target <= others.length; target++) {
        if (Math.abs(target - truePlace) > 0.1 * shown.length) far.push(target);
      }
      const target = far[Math.floor(random() * far.length)] as number;
      const move: { itemId: string; aboveItemId?: string; belowItemId?: string } = { itemId };
      if (target > 0) move.aboveItemId = others[target - 1] as string;
      if (target < others.length) move.belowItemId = others[target] as string;
      return move;
    },
  };
}
