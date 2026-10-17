import { pathKey } from '@/lib/import/paths';
import type { RankedList, Workspace } from '@/types/source';

/** The list open now. Every workspace holds it, so this never comes back empty. */
export function activeList(workspace: Workspace): RankedList {
  return workspace.lists[pathKey(workspace.source.arrayPath)]!;
}

/** The list at a path, if it has ever been opened. */
export function listAt(workspace: Workspace, path: string[]): RankedList | undefined {
  return workspace.lists[pathKey(path)];
}

/** The workspace with one list put in place, the open one or any other. */
export function withList(workspace: Workspace, list: RankedList): Workspace {
  return { ...workspace, lists: { ...workspace.lists, [pathKey(list.arrayPath)]: list } };
}

/** Every list opened so far, the open one included. */
export function allLists(workspace: Workspace): RankedList[] {
  return Object.values(workspace.lists);
}
