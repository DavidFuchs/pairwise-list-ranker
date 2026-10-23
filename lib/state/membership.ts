/**
 * Who is in a list, worked out from its history (docs/ARCHITECTURE.md 6.9). Items store no
 * flag of their own: every item of the import is in the list until a removal
 * event takes it out, and only undo brings it back, so the screens, the
 * export and the engine can never disagree about which items are there.
 */
import type { ListItem } from '@/types/list';
import type { RankingEvent } from '@/types/rankingEvents';
/** What membership is read from: a list's items, its history and its import. */
type Members = {
  items: readonly ListItem[];
  events: readonly RankingEvent[];
  originalItemIds: readonly string[];
};

const removedCache = new WeakMap<readonly RankingEvent[], ReadonlySet<string>>();

/** The items removal events took out, kept while the history is unchanged. */
export function removedIds(events: readonly RankingEvent[]): ReadonlySet<string> {
  let removed = removedCache.get(events);
  if (removed !== undefined) return removed;
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind !== 'removal') continue;
    for (const id of event.itemIds) ids.add(id);
  }
  removed = ids;
  removedCache.set(events, removed);
  return removed;
}

/** Whether the list holds this item, it is one of the import, and it has not been removed. */
export function isItemActive(list: Members, itemId: string): boolean {
  return (
    !removedIds(list.events).has(itemId) &&
    list.items.some((item) => item.id === itemId) &&
    list.originalItemIds.includes(itemId)
  );
}

const activeCache = new WeakMap<readonly ListItem[], WeakMap<readonly RankingEvent[], ListItem[]>>();

/** The list's items of the import that have not been removed, in the items array's order. */
export function activeItems(list: Members): ListItem[] {
  let byEvents = activeCache.get(list.items);
  if (byEvents === undefined) {
    byEvents = new WeakMap();
    activeCache.set(list.items, byEvents);
  }
  let active = byEvents.get(list.events);
  if (active === undefined) {
    const removed = removedIds(list.events);
    const original = new Set(list.originalItemIds);
    active = list.items.filter((item) => !removed.has(item.id) && original.has(item.id));
    byEvents.set(list.events, active);
  }
  return active;
}

/** The list's removed items, in the items array's order. */
export function removedItemsOf(list: Members): ListItem[] {
  const removed = removedIds(list.events);
  return list.items.filter((item) => removed.has(item.id));
}

/** How many of the list's items were removed. */
export function removedCount(list: Members): number {
  return removedItemsOf(list).length;
}
