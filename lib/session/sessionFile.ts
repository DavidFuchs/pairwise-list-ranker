import { parseWorkspaceSnapshot, WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import { parseProgressFile, PROGRESS_FILE_KIND } from '@/lib/progress/progressFile';
import type { ProgressFile } from '@/lib/progress/progressFile';

/**
 * Everything needed to carry on somewhere else, in one file: the document as
 * imported, every list's setup, items, comparisons, placements and removals,
 * and the lists parked while another is open. It is the same snapshot this
 * browser keeps, labelled so a file can say what it is.
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
  | { type: 'progress'; file: ProgressFile }
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

  if (kind === PROGRESS_FILE_KIND) {
    const parsed = parseProgressFile(text);
    return parsed.ok ? { type: 'progress', file: parsed.file } : { type: 'unreadable', reason: parsed.reason };
  }
  if (kind !== SESSION_FILE_KIND) return { type: 'other' };

  const file = json as Partial<SessionFile> & { session?: { version?: unknown } };
  if (file.version !== SESSION_FILE_VERSION || file.session?.version !== WORKSPACE_VERSION) {
    return { type: 'unreadable', reason: 'That session was saved by a different version of this app.' };
  }
  const session = parseWorkspaceSnapshot(file.session);
  if (session === null) return { type: 'unreadable', reason: 'That session file is damaged and cannot be opened.' };
  return { type: 'session', session, savedAt: typeof file.savedAt === 'string' ? file.savedAt : '' };
}

/** One line on what a session holds, for confirming before it replaces anything. */
export function describeSession(session: WorkspaceSnapshot): string {
  const lists = 1 + session.savedLists.length;
  const decisions =
    session.comparisonEvents.length + session.savedLists.reduce((sum, list) => sum + list.comparisonEvents.length, 0);
  const items = session.items.filter((item) => item.active).length;
  const parts = [
    `${items} ${items === 1 ? 'item' : 'items'}`,
    ...(lists > 1 ? [`${lists} lists`] : []),
    `${decisions} ${decisions === 1 ? 'decision' : 'decisions'}`,
  ];
  return parts.join(' · ');
}
