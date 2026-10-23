import {
  LOCAL_SCALE_FLOOR,
  PLACEMENT_SD_FRACTION,
  PLACEMENT_SD_MAX_PLACES,
  PLACEMENT_SD_MAX_STRENGTH,
  PLACEMENT_SD_MIN_PLACES,
  RANKED_SD_FRACTION,
  ROUGH_SD_FRACTION,
  SEED_SPAN,
  UNORDERED_SD,
} from '@/lib/ranking/bt/constants';
import type { StartingOrder } from '@/types/rankingEvents';

export interface Prior {
  mean: number;
  variance: number;
}

/** Spec 6.8. position is the arrivalIndex and count is originalItemIds.length. */
export function seedPrior(position: number, count: number, startingOrder: StartingOrder): Prior {
  if (startingOrder === 'unordered') return { mean: 0, variance: UNORDERED_SD ** 2 };
  const mean = count < 2 ? 0 : SEED_SPAN / 2 - (SEED_SPAN * position) / (count - 1);
  const fraction = startingOrder === 'rough' ? ROUGH_SD_FRACTION : RANKED_SD_FRACTION;
  return { mean, variance: (fraction * SEED_SPAN) ** 2 };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
}

/**
 * Spec 6.6 steps 3 to 5. visibleOrder is the displayed order of visible slots
 * without the moved item; at is the index in visibleOrder the item is inserted
 * before (0 = top, length = bottom).
 */
export function placementPrior(visibleOrder: readonly number[], strengths: Float64Array, at: number): Prior {
  const length = visibleOrder.length;
  const n = length + 1;
  const strengthAt = (i: number): number => strengths[visibleOrder[i] ?? -1] ?? 0;
  const gapAt = (i: number): number => Math.max(0, strengthAt(i) - strengthAt(i + 1));

  const reach = Math.max(5, Math.ceil(0.025 * n));
  const first = Math.max(0, at - reach);
  const last = Math.min(length - 1, at + reach);
  const localGaps: number[] = [];
  for (let i = first; i < last; i += 1) localGaps.push(gapAt(i));
  const allGaps: number[] = [];
  for (let i = 0; i + 1 < length; i += 1) allGaps.push(gapAt(i));

  const localScale =
    localGaps.length === 0
      ? LOCAL_SCALE_FLOOR
      : Math.max(median(localGaps), median(allGaps), LOCAL_SCALE_FLOOR);

  let mean: number;
  if (length === 0) mean = 0;
  else if (at <= 0) mean = strengthAt(0) + localScale;
  else if (at >= length) mean = strengthAt(length - 1) - localScale;
  else mean = (strengthAt(at - 1) + strengthAt(at)) / 2;

  const sdPlaces = Math.min(
    Math.max(PLACEMENT_SD_FRACTION * n, PLACEMENT_SD_MIN_PLACES),
    PLACEMENT_SD_MAX_PLACES,
  );
  const sd = Math.min(sdPlaces * localScale, PLACEMENT_SD_MAX_STRENGTH);
  return { mean, variance: sd ** 2 };
}
