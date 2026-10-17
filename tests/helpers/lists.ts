import { activeList } from '@/lib/state/lists';
import type { ListStore } from '@/lib/state/useListStore';
import type { RankedList } from '@/types/source';

/** The list a store has open. Fails the test when nothing is loaded. */
export function openList(store: ListStore): RankedList {
  const { workspace } = store.getState();
  if (workspace === null) throw new Error('Expected a workspace to be loaded.');
  return activeList(workspace);
}

/** A list the store has opened at some point, by its path; undefined if never. */
export function listAtPath(store: ListStore, path: string[]): RankedList | undefined {
  const { workspace } = store.getState();
  return workspace === null ? undefined : workspace.lists[path.join('\u0000')];
}
