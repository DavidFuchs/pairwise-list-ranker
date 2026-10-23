import type { EngineList } from '@/types/rankingEvents';
import type { RankedList } from '@/types/source';

/** What the engine replays from a list: its original items, starting order and history. */
export function toEngineList(list: RankedList): EngineList {
  return {
    originalItemIds: list.originalItemIds,
    startingOrder: list.initialStartingOrder,
    events: list.events,
  };
}
