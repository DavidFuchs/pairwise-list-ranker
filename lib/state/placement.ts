/**
 * Moves, as the engine records them (docs/ARCHITECTURE.md 6.8). A drag turns "this item now
 * sits between these rows" into a placement here.
 */
import type { RankingEvent } from '@/types/rankingEvents';

/** What a placement says: the item and the rows it was put between. */
export type Placement = Pick<
  Extract<RankingEvent, { kind: 'placement' }>,
  'itemId' | 'aboveItemId' | 'belowItemId'
>;

/**
 * The placement that puts `itemId` between `aboveItemId` and `belowItemId`, or
 * null when neither row is there to anchor it.
 */
export function placementBetween(
  itemId: string,
  aboveItemId: string | undefined,
  belowItemId: string | undefined,
): Placement | null {
  if (aboveItemId === undefined && belowItemId === undefined) return null;
  return {
    itemId,
    ...(aboveItemId === undefined ? {} : { aboveItemId }),
    ...(belowItemId === undefined ? {} : { belowItemId }),
  };
}

/**
 * Items marked "don't recognize" now, as the engine's timeline works them out:
 * a mark lasts until the item is placed (moved back into the ranking).
 */
export function unrecognizedIds(events: readonly RankingEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind === 'unrecognized') for (const id of event.itemIds) ids.add(id);
    else if (event.kind === 'placement') ids.delete(event.itemId);
  }
  return ids;
}
