import { parseWorkspaceSnapshot, WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { activeList, allLists } from '@/lib/state/lists';
import type { Workspace } from '@/types/source';

/**
 * Everything needed to carry on somewhere else, in one file: the document as
 * imported, and every list opened in it with its setup, items, comparisons,
 * placements and removals. It is the same snapshot this browser keeps,
 * labelled so a file can say what it is.
 */
export const SESSION_FILE_KIND = 'pairwise-list-ranker-session';
export const SESSION_FILE_VERSION = 1;

export interface SessionFile {
  kind: typeof SESSION_FILE_KIND;
  version: typeof SESSION_FILE_VERSION;
  savedAt: string;
  session: WorkspaceSnapshot;
}

export function buildSessionFile(session: WorkspaceSnapshot, savedAt: string): SessionFile {
  return { kind: SESSION_FILE_KIND, version: SESSION_FILE_VERSION, savedAt, session };
}

/** What a chosen or dropped file turned out to be. */
export type SavedFile =
  | { type: 'session'; session: WorkspaceSnapshot; savedAt: string }
  /** One of this app's files that cannot be read - with why, for the user. */
  | { type: 'unreadable'; reason: string }
  /** Not one of this app's files at all: for the setup screen, a list to import. */
  | { type: 'other' };

/**
 * Tells this app's own files apart from a list to import, by the `kind` each
 * one writes. Anything without it - including any ordinary JSON document - is
 * left alone as 'other', so importing a list never gets mistaken for this.
 */
export function readSavedFile(text: string): SavedFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { type: 'other' };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { type: 'other' };
  const kind = (json as { kind?: unknown }).kind;

  if (kind !== SESSION_FILE_KIND) return { type: 'other' };

  const file = json as Partial<SessionFile> & { session?: { version?: unknown } };
  if (file.version !== SESSION_FILE_VERSION || file.session?.version !== WORKSPACE_VERSION) {
    return { type: 'unreadable', reason: 'That session was saved by a different version of this app.' };
  }
  const session = parseWorkspaceSnapshot(file.session);
  if (session === null)
    return { type: 'unreadable', reason: 'That session file is damaged and cannot be opened.' };
  return { type: 'session', session, savedAt: typeof file.savedAt === 'string' ? file.savedAt : '' };
}

/** One line on what a session holds, for confirming before it replaces anything. */
export function describeSession(session: WorkspaceSnapshot): string {
  const lists = allLists(session.workspace);
  const decisions = lists.reduce((sum, list) => sum + list.comparisonEvents.length, 0);
  const items = activeList(session.workspace).items.filter((item) => item.active).length;
  const parts = [
    `${items} ${items === 1 ? 'item' : 'items'}`,
    ...(lists.length > 1 ? [`${lists.length} lists`] : []),
    `${decisions} ${decisions === 1 ? 'decision' : 'decisions'}`,
  ];
  return parts.join(' · ');
}

/** Whether replacing what is loaded would lose any choice or placement. */
export function hasDecisions(workspace: Workspace | null): boolean {
  return workspace !== null && allLists(workspace).some((list) => list.comparisonEvents.length > 0);
}

/** Asked before a session replaces decisions that would otherwise be lost. */
export function confirmOpenSession(session: WorkspaceSnapshot): string {
  return `Open this session (${describeSession(session)})? It replaces the list you are ranking now, and its progress is gone unless you saved it.`;
}
