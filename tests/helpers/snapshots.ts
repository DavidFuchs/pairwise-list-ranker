import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import type { ListItem } from '@/types/list';
import type { RankingEvent, RecordedEvent } from '@/types/rankingEvents';
import type { RankedList } from '@/types/source';

export const NOW = '2026-08-16T00:00:00.000Z';

export function listItem(id: string, listId: string, value: ListItem['value']): ListItem {
  return { id, listId, value, createdAt: NOW, updatedAt: NOW };
}

/** Events as a list's history holds them: each its own action, as a single click records it. */
export function recorded(events: readonly RankingEvent[]): RecordedEvent[] {
  return events.map((event) => ({ ...event, actionId: event.id }));
}

/** One of every event kind, over items a, b, c, d of the list `listId`. */
export function everyKindOfEvent(listId: string): RecordedEvent[] {
  const base = { listId, createdAt: NOW };
  return recorded([
    { ...base, id: 'e1', kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left_strong' },
    { ...base, id: 'e2', kind: 'pair', leftItemId: 'b', rightItemId: 'c', outcome: 'draw' },
    { ...base, id: 'e3', kind: 'pair', leftItemId: 'c', rightItemId: 'a', outcome: 'right' },
    { ...base, id: 'e4', kind: 'placement', itemId: 'd', aboveItemId: 'a' },
    { ...base, id: 'e5', kind: 'placement', itemId: 'c', aboveItemId: 'a', belowItemId: 'b' },
    { ...base, id: 'e8', kind: 'placement', itemId: 'a', belowItemId: 'b' },
    { ...base, id: 'e6', kind: 'unrecognized', itemIds: ['b'] },
    { ...base, id: 'e7', kind: 'removal', itemIds: ['d'] },
  ]);
}

export function rankedList(overrides: Partial<RankedList> = {}): RankedList {
  return {
    id: 'movies-1',
    arrayPath: ['movies'],
    roles: { labelField: 'title' },
    initialStartingOrder: 'unordered',
    configuredExplicitly: true,
    originalItemIds: ['item-1'],
    items: [listItem('item-1', 'movies-1', { title: 'Alien' })],
    events: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** A one-list snapshot over `document`, whose open list is at `arrayPath`. */
export function snapshotOf(list: RankedList, document: unknown): WorkspaceSnapshot {
  return {
    version: WORKSPACE_VERSION,
    workspace: {
      source: { format: 'yaml', document, arrayPath: list.arrayPath },
      listDefaults: { roles: list.roles, startingOrder: list.initialStartingOrder },
      lists: { [list.arrayPath.join('\u0000')]: list },
      createdAt: NOW,
      updatedAt: NOW,
    },
    ui: { previewTab: 'ranked' },
  };
}
