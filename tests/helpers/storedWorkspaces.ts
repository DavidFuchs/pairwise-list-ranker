import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import type { RankingEvent } from '@/types/rankingEvents';
import type { RankedList } from '@/types/source';
import { recorded } from '@/tests/helpers/snapshots';

export const AT = '2026-08-16T00:00:00.000Z';

/** localStorage's shape: key enumeration as well as get, set and remove. */
export function enumerableBackend() {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

export type Backend = ReturnType<typeof enumerableBackend>;

/** A one-list snapshot with `count` items and `answers` pair answers between neighbours. */
export function ranked(answers: number, count = 8): WorkspaceSnapshot {
  const document = Array.from({ length: count }, (_, i) => `Item ${i}`);
  const ids = document.map((_, i) => `item-${i}`);
  const events = Array.from({ length: answers }, (_, i): RankingEvent => ({
    id: `event-${i}`,
    listId: 'list-1',
    createdAt: AT,
    kind: 'pair',
    leftItemId: ids[i % count]!,
    rightItemId: ids[(i + 1) % count]!,
    outcome: 'left',
  }));
  return {
    version: WORKSPACE_VERSION,
    workspace: {
      source: { format: 'list', document, arrayPath: [] },
      listDefaults: { roles: {}, startingOrder: 'unordered' },
      lists: {
        '': {
          id: 'list-1',
          arrayPath: [],
          roles: {},
          initialStartingOrder: 'unordered',
          configuredExplicitly: true,
          originalItemIds: ids,
          items: ids.map((id, i) => ({
            id,
            listId: 'list-1',
            value: document[i]!,
            createdAt: AT,
            updatedAt: AT,
          })),
          events: recorded(events),
          createdAt: AT,
          updatedAt: AT,
        },
      },
      createdAt: AT,
      updatedAt: AT,
    },
    ui: { previewTab: 'ranked' },
  };
}

/** The same snapshot with its open list changed. */
export function withList(snapshot: WorkspaceSnapshot, change: Partial<RankedList>): WorkspaceSnapshot {
  const list = { ...snapshot.workspace.lists['']!, ...change };
  return { ...snapshot, workspace: { ...snapshot.workspace, lists: { '': list } } };
}

/** One more answer on the end, sharing every earlier event with `snapshot` as a store's next state does. */
export function answered(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const list = snapshot.workspace.lists['']!;
  const event: RankingEvent = {
    id: `event-${list.events.length}`,
    listId: 'list-1',
    createdAt: AT,
    kind: 'pair',
    leftItemId: 'item-0',
    rightItemId: 'item-1',
    outcome: 'right',
  };
  return withList(snapshot, { events: [...list.events, ...recorded([event])] });
}
