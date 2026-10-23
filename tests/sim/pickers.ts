import { REPEAT_FACTOR } from '@/lib/ranking/bt/constants';
import { pairKey, type PickerInput } from '@/lib/ranking/bt/picker';

/**
 * The simpler picker that docs/ARCHITECTURE.md 6.7's required check compares the real one
 * with. A pair is two neighbours in displayed order, scored by u_A + u_B and
 * the same repeat discount as the real picker, never the previous pair. Ties
 * go to the higher-ranked position. Like the real picker it returns slots
 * (entries of `input.order`), not positions.
 *
 * It reads its constants through the constants module, so SIM_OVERRIDES reach
 * it as they reach the engine. tests/sim/setup.ts puts it in the engine's place
 * when SIM_PICKER=adjacent.
 */

/** Positions p and p + 1 in `order` of the best neighbours, or null if no pair can be asked. */
function bestNeighbours(input: PickerInput): number | null {
  const { order, uncertainty, shown, previousPair } = input;
  let best: number | null = null;
  let bestScore = -Infinity;
  for (let p = 0; p + 1 < order.length; p++) {
    const a = order[p] as number;
    const b = order[p + 1] as number;
    const key = pairKey(a, b);
    if (previousPair !== undefined && key === previousPair) continue;
    const times = shown.get(key) ?? 0;
    const score = ((uncertainty[a] ?? 0) + (uncertainty[b] ?? 0)) * REPEAT_FACTOR ** times;
    // Strictly greater, so the first (higher-ranked) of equal scores is kept.
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

function pickPair(input: PickerInput): [number, number] | null {
  const p = bestNeighbours(input);
  return p === null ? null : [input.order[p] as number, input.order[p + 1] as number];
}

export const adjacentPicker = { pickPair };
