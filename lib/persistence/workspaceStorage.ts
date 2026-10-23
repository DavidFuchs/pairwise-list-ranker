import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { pathKey } from '@/lib/import/paths';
import {
  isCount,
  isIds,
  isRecord,
  readEvents,
  readUndoStep,
  readListConfig,
  readListSetup,
  readPreviewTab,
  readSourceHead,
  readStoredItems,
} from '@/lib/persistence/storedShapes';
import type { ListSetup } from '@/lib/persistence/storedShapes';
import { compactItems, expandItems, WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot, WorkspaceUiState } from '@/lib/persistence/workspaceSnapshot';
import type { ListItem } from '@/types/list';
import type { RecordedEvent } from '@/types/rankingEvents';
import type { ListConfig, RankedList, SourceFormat, UndoStep, Workspace } from '@/types/source';

/**
 * The manifest, which names the pieces of the saved workspace. Writing it is
 * what commits a save: until it is written, the previous save is still the one
 * a reload reads.
 */
export const WORKSPACE_STORAGE_KEY = 'pairwise-list-ranker:workspace:v3';

/** Keys from shapes we can no longer read. Deleted on first load. */
export const LEGACY_STORAGE_KEYS = [
  'pairwise-list-ranker:workspace:v1',
  'pairwise-list-ranker:workspace:v2',
] as const;

/**
 * Below the usual 5MB localStorage budget, with room for the browser's own
 * overhead. The document is stored once, with items pointing into it, so this
 * is roughly the size of the imported data plus the comparison history. It
 * counts every piece of a save and the manifest together. A save normally
 * writes its new pieces before it removes the ones they replace, so a save that
 * replaces most of a workspace needs room for the old and the new together;
 * when that room is not there it falls back to freeing the old pieces first
 * (see tightSave), which holds up to this limit with the quota to itself.
 */
export const MAX_SNAPSHOT_BYTES = 4_000_000;

/**
 * Events in one piece of the history. A save rewrites the piece the history
 * has grown or shrunk in, so this sets what an answer costs to store: half a
 * piece on average, however long the history is.
 */
export const EVENTS_PER_PIECE = 256;

/**
 * How old a piece no manifest names must be before a load takes it for one a
 * crash left behind. A younger one may be another tab's save in progress.
 */
const ORPHAN_AGE_MS = 60_000;

/**
 * How long a save leaves the pieces it replaced in place after committing. A
 * tab that read the manifest just before the commit may still name them in its
 * own commit a moment later; this is far longer than that moment.
 */
const RETIRE_GRACE_MS = 10_000;

const PROBE_KEY = 'pairwise-list-ranker:probe';
const PIECE_PREFIX = `${WORKSPACE_STORAGE_KEY}:`;

/** The slice of the Web Storage API we depend on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveOutcome = 'saved' | 'too-large' | 'unavailable';

export interface WorkspaceStorage {
  /** False in private modes, SSR/static rendering, or when storage is blocked. */
  readonly available: boolean;
  load(): WorkspaceSnapshot | null;
  save(snapshot: WorkspaceSnapshot): SaveOutcome;
  clear(): void;
  /**
   * Calls `onChange` when another tab commits or clears the workspace, never
   * for this tab's own writes (the browser does not report those). Returns
   * the way to stop listening.
   */
  watch(onChange: () => void): () => void;
}

/** localStorage when the browser allows it, otherwise null (memory-only mode). */
export function defaultBackend(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Some browsers throw on property access when storage is disabled.
    return null;
  }
}

/** Web Storage's enumeration, which StorageLike leaves out. */
interface Enumerable {
  readonly length: number;
  key(index: number): string | null;
}

/** The backend's keys that start with `prefix`, or null when it cannot list its keys. */
export function storedKeys(backend: StorageLike, prefix: string): string[] | null {
  const candidate = backend as Partial<Enumerable>;
  if (typeof candidate.key !== 'function' || typeof candidate.length !== 'number') return null;
  const keys: string[] = [];
  for (let i = 0; i < candidate.length; i++) {
    const key = candidate.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

/** A piece of the saved workspace: its key, and the length of its text as the manifest records it. */
interface Piece {
  key: string;
  chars: number;
}

/** A stretch of a list's history, and how many events it holds. */
interface EventPiece extends Piece {
  count: number;
}

/** What the manifest says of a list: its setup, and the pieces that hold its items and its history. */
type ManifestList = ListSetup & { items: Piece; events: EventPiece[] };

interface Manifest {
  version: number;
  ui: WorkspaceUiState;
  workspace: {
    source: { format: SourceFormat; arrayPath: string[]; document: Piece };
    listDefaults: ListConfig;
    lists: Record<string, ManifestList>;
    /** Held in the manifest itself: it is small. */
    lastAction?: UndoStep;
    createdAt: string;
    updatedAt: string;
  };
}

function readPiece(value: unknown): Piece | null {
  if (!isRecord(value)) return null;
  const { key, chars } = value;
  return typeof key === 'string' && key.length > 0 && isCount(chars) ? { key, chars } : null;
}

function readEventPiece(value: unknown): EventPiece | null {
  const piece = readPiece(value);
  const count = isRecord(value) ? value.count : undefined;
  return piece !== null && isCount(count) && count > 0 ? { ...piece, count } : null;
}

/** The manifest in `text`, or null if it is not one for this version of the app. */
function readManifest(text: string): Manifest | null {
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw) || raw.version !== WORKSPACE_VERSION) return null;
  const previewTab = isRecord(raw.ui) ? readPreviewTab(raw.ui.previewTab) : null;
  const workspace = raw.workspace;
  if (previewTab === null || !isRecord(workspace)) return null;

  const head = readSourceHead(workspace.source);
  const document = isRecord(workspace.source) ? readPiece(workspace.source.document) : null;
  const listDefaults = readListConfig(workspace.listDefaults);
  const { createdAt, updatedAt } = workspace;
  if (head === null || document === null || listDefaults === null || !isRecord(workspace.lists)) return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;

  const lists: [string, ManifestList][] = [];
  for (const [key, rawList] of Object.entries(workspace.lists)) {
    const setup = readListSetup(rawList);
    if (setup === null || !isRecord(rawList)) return null;
    // Each list is filed under its own path.
    if (key !== pathKey(setup.arrayPath)) return null;
    const items = readPiece(rawList.items);
    const pieces: unknown = rawList.events;
    if (items === null || !Array.isArray(pieces)) return null;
    const events = pieces.map(readEventPiece);
    if (events.some((piece) => piece === null)) return null;
    lists.push([key, { ...setup, items, events: events as EventPiece[] }]);
  }
  // ... and the open one is among them.
  if (!lists.some(([key]) => key === pathKey(head.arrayPath))) return null;
  const lastAction = readUndoStep(workspace.lastAction);
  if (lastAction === null) return null;

  return {
    version: WORKSPACE_VERSION,
    ui: { previewTab },
    workspace: {
      source: { ...head, document },
      listDefaults,
      lists: Object.fromEntries(lists),
      ...(lastAction === undefined ? {} : { lastAction }),
      createdAt,
      updatedAt,
    },
  };
}

/** The items piece: the items as readStoredItems describes them, and the ids the list began with. */
function readItemsPiece(text: string) {
  const raw: unknown = JSON.parse(text);
  const items = isRecord(raw) ? readStoredItems(raw.items) : null;
  const originalItemIds = isRecord(raw) ? raw.originalItemIds : undefined;
  if (items === null || !isIds(originalItemIds)) throw new Error('Not an items piece.');
  return { items, originalItemIds };
}

/** What a list's pieces were made from, so a save can tell which of them still hold. */
interface ListOnDisk {
  items: Piece;
  /** The items and original ids the items piece holds. Compared by identity: a store never changes either in place. */
  itemsFrom: { items: readonly ListItem[]; originalItemIds: readonly string[] };
  events: EventPiece[];
  /** The history the event pieces hold, in order. */
  eventsFrom: readonly RecordedEvent[];
}

/** What this storage knows it wrote or read last: which pieces, and what each was made from. */
interface Pieces {
  document: Piece;
  /** The document the document piece holds, compared by identity. */
  documentFrom: unknown;
  lists: Map<string, ListOnDisk>;
}

/** Pieces and the manifest that names them, exactly as stored. */
interface OnDisk extends Pieces {
  manifest: string;
}

/** A piece to write: its key and text. */
interface Write extends Piece {
  text: string;
}

/** Every piece key a manifest's text holds, so a manifest the schema refuses can still be tidied up after. */
function keysIn(manifestText: string): string[] {
  const keys = manifestText.match(new RegExp(`${PIECE_PREFIX}[0-9a-z.]+`, 'g'));
  return keys === null ? [] : [...new Set(keys)];
}

function keysOf(pieces: Pieces): string[] {
  const keys = [pieces.document.key];
  for (const list of pieces.lists.values())
    keys.push(list.items.key, ...list.events.map((piece) => piece.key));
  return keys;
}

/**
 * The manifest and its pieces, read and checked whole: a workspace with any
 * piece missing, cut short, or not what it should be is refused, never half
 * restored. Throws for anything unreadable.
 */
function readWorkspace(
  backend: StorageLike,
  manifestText: string,
): { snapshot: WorkspaceSnapshot; onDisk: OnDisk } {
  const manifest = readManifest(manifestText);
  if (manifest === null) throw new Error('Unreadable manifest.');

  const text = (piece: Piece): string => {
    const stored = backend.getItem(piece.key);
    if (stored === null || stored.length !== piece.chars) throw new Error('A piece is missing or cut short.');
    return stored;
  };
  const { source } = manifest.workspace;
  const document: unknown = JSON.parse(text(source.document));

  const lists: [string, RankedList][] = [];
  const onDisk: OnDisk = {
    manifest: manifestText,
    document: source.document,
    documentFrom: document,
    lists: new Map(),
  };
  for (const [key, { items: itemsPiece, events: eventPieces, ...setup }] of Object.entries(
    manifest.workspace.lists,
  )) {
    const stored = readItemsPiece(text(itemsPiece));
    const items = expandItems(stored.items, entriesAtPath(document, setup.arrayPath));
    if (items === null) throw new Error('An item names an entry the document does not hold.');
    const events: RecordedEvent[] = [];
    for (const piece of eventPieces) {
      const history = readEvents(JSON.parse(text(piece)));
      if (history === null || history.length !== piece.count) throw new Error('Not a history.');
      for (const event of history) events.push(event);
    }
    lists.push([key, { ...setup, originalItemIds: stored.originalItemIds, items, events }]);
    onDisk.lists.set(key, {
      items: itemsPiece,
      itemsFrom: { items, originalItemIds: stored.originalItemIds },
      events: eventPieces,
      eventsFrom: events,
    });
  }

  const workspace: Workspace = {
    source: { format: source.format, document, arrayPath: source.arrayPath },
    listDefaults: manifest.workspace.listDefaults,
    lists: Object.fromEntries(lists),
    ...(manifest.workspace.lastAction === undefined ? {} : { lastAction: manifest.workspace.lastAction }),
    createdAt: manifest.workspace.createdAt,
    updatedAt: manifest.workspace.updatedAt,
  };
  return { snapshot: { version: manifest.version, workspace, ui: manifest.ui }, onDisk };
}

/** The document as text. JSON has none for a missing one, which is stored as null. */
function textOf(document: unknown): string {
  const text: string | undefined = JSON.stringify(document);
  return text ?? 'null';
}

function removeQuietly(backend: StorageLike, key: string): void {
  try {
    backend.removeItem(key);
  } catch {
    // A piece left behind is named by no manifest, and a later load tidies it up.
  }
}

export function createWorkspaceStorage(backend: StorageLike | null = defaultBackend()): WorkspaceStorage {
  const available = backend !== null && probe(backend);
  const nonce = Math.random().toString(36).slice(2, 6);
  let made = 0;
  /** What the last load or save left in storage; null when that is not known. */
  let disk: OnDisk | null = null;
  /** Pieces this storage has replaced and not yet removed, and when it replaced them. */
  let retired: { key: string; at: number }[] = [];

  /** A key no piece has had. It carries the time, so a piece a crash left behind can tell its age. */
  function newKey(): string {
    return `${PIECE_PREFIX}${Date.now().toString(36)}.${nonce}${(made++).toString(36)}`;
  }

  /**
   * Removes pieces no manifest names that are old enough to be left over from
   * a crash. Not possible on a backend that cannot list its keys, where only
   * the pieces a save replaces are removed.
   */
  function tidy(store: StorageLike, named: readonly string[]): void {
    const keys = storedKeys(store, PIECE_PREFIX);
    if (keys === null) return;
    const keep = new Set(named);
    const now = Date.now();
    for (const key of keys) {
      if (keep.has(key)) continue;
      const stamp = Number.parseInt(key.slice(PIECE_PREFIX.length), 36);
      if (Number.isNaN(stamp) || now - stamp > ORPHAN_AGE_MS) removeQuietly(store, key);
    }
  }

  /** The history as pieces: those of `before` that still hold its start are kept, and the rest written afresh. */
  function planEvents(
    events: readonly RecordedEvent[],
    before: ListOnDisk | undefined,
    write: (text: string) => Piece,
  ): EventPiece[] {
    let same = 0;
    if (before !== undefined) {
      const limit = Math.min(before.eventsFrom.length, events.length);
      while (same < limit && before.eventsFrom[same] === events[same]) same++;
    }
    const pieces: EventPiece[] = [];
    let start = 0;
    for (const piece of before?.events ?? []) {
      const end = start + piece.count;
      // Kept when every event in it is unchanged, and it is full or is the end of the history.
      const whole = piece.count === EVENTS_PER_PIECE || end === events.length;
      if (end > same || !whole) break;
      pieces.push(piece);
      start = end;
    }
    for (; start < events.length; start += EVENTS_PER_PIECE) {
      const slice = events.slice(start, start + EVENTS_PER_PIECE);
      pieces.push({ ...write(JSON.stringify(slice)), count: slice.length });
    }
    return pieces;
  }

  /** The pieces a save of `snapshot` needs over those `before` holds, with the manifest that names them all. */
  function plan(snapshot: WorkspaceSnapshot, before: OnDisk | null) {
    const writes: Write[] = [];
    const write = (text: string): Piece => {
      const piece = { key: newKey(), chars: text.length };
      writes.push({ ...piece, text });
      return piece;
    };
    const { workspace } = snapshot;
    const { document } = workspace.source;

    const sameDocument = before !== null && before.documentFrom === document;
    const documentPiece = sameDocument ? before.document : write(textOf(document));

    const lists = new Map<string, ListOnDisk>();
    const manifestLists: [string, ManifestList][] = [];
    for (const [key, list] of Object.entries(workspace.lists)) {
      const previous = before?.lists.get(key);
      // An item names its entry in the document, so a new document means new items pieces.
      const items =
        sameDocument &&
        previous !== undefined &&
        previous.itemsFrom.items === list.items &&
        previous.itemsFrom.originalItemIds === list.originalItemIds
          ? previous.items
          : write(
              JSON.stringify({ originalItemIds: list.originalItemIds, items: compactItems(list, document) }),
            );
      const events = planEvents(list.events, previous, write);
      lists.set(key, {
        items,
        itemsFrom: { items: list.items, originalItemIds: list.originalItemIds },
        events,
        eventsFrom: list.events,
      });
      const { originalItemIds: _ids, items: _items, events: _events, ...setup } = list;
      manifestLists.push([key, { ...setup, items, events }]);
    }

    const manifest: Manifest = {
      version: snapshot.version,
      ui: snapshot.ui,
      workspace: {
        source: {
          format: workspace.source.format,
          arrayPath: workspace.source.arrayPath,
          document: documentPiece,
        },
        listDefaults: workspace.listDefaults,
        lists: Object.fromEntries(manifestLists),
        ...(workspace.lastAction === undefined ? {} : { lastAction: workspace.lastAction }),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    };
    const next: Pieces = { document: documentPiece, documentFrom: document, lists };
    return { writes, manifest: JSON.stringify(manifest), next };
  }

  /**
   * Removes replaced pieces that have been left the grace (all of them when
   * `all`), except any that the manifest in storage names: another tab may
   * have committed one that still uses a piece this tab replaced.
   */
  function sweepRetired(store: StorageLike, all: boolean): void {
    if (retired.length === 0) return;
    const now = Date.now();
    const due = retired.filter((piece) => all || now - piece.at >= RETIRE_GRACE_MS);
    if (due.length === 0) return;
    let named: Set<string>;
    try {
      named = new Set(keysIn(store.getItem(WORKSPACE_STORAGE_KEY) ?? ''));
    } catch {
      return;
    }
    const gone = new Set(due);
    retired = retired.filter((piece) => !gone.has(piece));
    for (const { key } of due) if (!named.has(key)) removeQuietly(store, key);
  }

  type Commit = 'saved' | 'conflict' | 'full' | 'too-large';

  /**
   * One try at saving `snapshot` over `before` (what this storage knows is in
   * storage, if it still stands), which is `current` as read. New pieces first,
   * then a look at the manifest again, then the manifest: if another tab
   * committed since `current` was read, this try's pieces may name ones it
   * replaced, so it gives up ('conflict') for a try over nothing known.
   */
  function commit(
    store: StorageLike,
    snapshot: WorkspaceSnapshot,
    before: OnDisk | null,
    current: string | null,
  ): Commit {
    const { writes, manifest, next } = plan(snapshot, before);
    if (before !== null && manifest === before.manifest) {
      sweepRetired(store, false);
      return 'saved';
    }

    const pieces = [next.document, ...[...next.lists.values()].flatMap((l) => [l.items, ...l.events])];
    const total = pieces.reduce((sum, piece) => sum + piece.chars, manifest.length);
    // Checking first keeps a previous good save intact rather than letting a
    // quota error replace it with nothing.
    if (total > MAX_SNAPSHOT_BYTES) return 'too-large';

    const written: string[] = [];
    try {
      for (const piece of writes) {
        store.setItem(piece.key, piece.text);
        written.push(piece.key);
      }
      // A kept piece that has gone missing (or been cut short) is not repaired by naming it
      // again; the retry rewrites everything.
      const intact = pieces.every(
        (piece) => written.includes(piece.key) || store.getItem(piece.key)?.length === piece.chars,
      );
      if (!intact || store.getItem(WORKSPACE_STORAGE_KEY) !== current) {
        for (const key of written) removeQuietly(store, key);
        return 'conflict';
      }
      store.setItem(WORKSPACE_STORAGE_KEY, manifest);
    } catch {
      // Out of quota or storage revoked mid-save: the manifest still names the previous save's pieces.
      for (const key of written) removeQuietly(store, key);
      return 'full';
    }

    const replaced = before !== null ? keysOf(before) : current === null ? [] : keysIn(current);
    disk = { manifest, ...next };
    const kept = new Set(keysOf(next));
    const at = Date.now();
    for (const key of replaced) if (!kept.has(key)) retired.push({ key, at });
    sweepRetired(store, false);
    return 'saved';
  }

  /**
   * The last resort when the old and new pieces do not fit together: the
   * pieces the new save replaces are removed first, their text kept in memory
   * so a failure puts them back. Until the manifest is written the manifest in
   * storage names pieces that are not there, so a crash, or another tab loading,
   * in that moment finds no workspace; this runs only when the ordinary save has
   * failed for room.
   */
  function tightSave(store: StorageLike, snapshot: WorkspaceSnapshot): SaveOutcome {
    let current: string | null;
    try {
      current = store.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return 'too-large';
    }
    const before = disk !== null && disk.manifest === current ? disk : null;
    const { writes, manifest, next } = plan(snapshot, before);
    if (before !== null && manifest === before.manifest) return 'saved';
    const pieces = [next.document, ...[...next.lists.values()].flatMap((l) => [l.items, ...l.events])];
    if (pieces.reduce((sum, piece) => sum + piece.chars, manifest.length) > MAX_SNAPSHOT_BYTES) {
      return 'too-large';
    }

    // Storage that takes no writes at all (revoked, not full) is not worth emptying.
    if (!probe(store)) return 'too-large';

    const kept = new Set(keysOf(next));
    const old = before !== null ? keysOf(before) : current === null ? [] : keysIn(current);
    const victims = old.filter((key) => !kept.has(key));
    const saved: [string, string][] = [];
    try {
      for (const key of victims) {
        const text = store.getItem(key);
        if (text !== null) saved.push([key, text]);
      }
    } catch {
      return 'too-large';
    }
    for (const [key] of saved) removeQuietly(store, key);

    const written: string[] = [];
    try {
      for (const piece of writes) {
        store.setItem(piece.key, piece.text);
        written.push(piece.key);
      }
      // Another tab may have committed while the old pieces were out; its commit is not overwritten.
      if (store.getItem(WORKSPACE_STORAGE_KEY) !== current) throw new Error('Another tab committed.');
      store.setItem(WORKSPACE_STORAGE_KEY, manifest);
    } catch {
      for (const key of written) removeQuietly(store, key);
      for (const [key, text] of saved) {
        try {
          store.setItem(key, text);
        } catch {
          // Nothing more to do: the room just freed is what the writes above could not fit in.
        }
      }
      return 'too-large';
    }
    disk = { manifest, ...next };
    return 'saved';
  }

  return {
    available,

    load() {
      if (!available || backend === null) return null;

      for (const key of LEGACY_STORAGE_KEYS) removeQuietly(backend, key);

      let raw: string | null = null;
      try {
        raw = backend.getItem(WORKSPACE_STORAGE_KEY);
        for (let attempt = 0; ; attempt++) {
          if (raw === null) {
            tidy(backend, []);
            return null;
          }
          try {
            const { snapshot, onDisk } = readWorkspace(backend, raw);
            disk = onDisk;
            tidy(backend, keysOf(onDisk));
            return snapshot;
          } catch (error) {
            // A piece gone while the manifest has changed means another tab committed
            // in the middle of this read: read the new manifest, a couple of times at most.
            const latest = backend.getItem(WORKSPACE_STORAGE_KEY);
            if (latest === raw || attempt >= 2) throw error;
            raw = latest;
          }
        }
      } catch {
        disk = null;
        if (raw !== null) tidy(backend, keysIn(raw));
        return null;
      }
    },

    save(snapshot: WorkspaceSnapshot) {
      if (!available || backend === null) return 'unavailable';

      const read = (): string | null | undefined => {
        try {
          return backend.getItem(WORKSPACE_STORAGE_KEY);
        } catch {
          // Storage revoked mid-session: keep working in memory.
          return undefined;
        }
      };
      // What this storage last wrote only stands for as long as nothing else has changed the manifest.
      const known = (current: string | null) => (disk !== null && disk.manifest === current ? disk : null);

      let current = read();
      if (current === undefined) return 'too-large';
      let outcome = commit(backend, snapshot, known(current), current);
      for (let tries = 0; outcome === 'conflict' && tries < 3; tries++) {
        // Another tab saved in the meantime: this save starts over from what is there now, naming only its own pieces.
        current = read();
        if (current === undefined) return 'too-large';
        outcome = commit(backend, snapshot, null, current);
      }
      if (outcome === 'full') {
        // No room: the pieces replaced earlier are the first to go, then the save is tried once more.
        sweepRetired(backend, true);
        current = read();
        if (current === undefined) return 'too-large';
        outcome = commit(backend, snapshot, known(current), current);
        if (outcome === 'full') return tightSave(backend, snapshot);
      }
      return outcome === 'saved' ? 'saved' : 'too-large';
    },

    clear() {
      if (!available || backend === null) return;
      try {
        const current = backend.getItem(WORKSPACE_STORAGE_KEY);
        const keys = new Set([
          ...retired.map((piece) => piece.key),
          ...(disk === null ? [] : keysOf(disk)),
          ...(current === null ? [] : keysIn(current)),
          ...(storedKeys(backend, PIECE_PREFIX) ?? []),
        ]);
        for (const key of keys) removeQuietly(backend, key);
        backend.removeItem(WORKSPACE_STORAGE_KEY);
      } catch {
        // The in-memory workspace is still authoritative.
      }
      disk = null;
      retired = [];
    },

    watch(onChange) {
      if (!available || backend === null || typeof globalThis.addEventListener !== 'function') {
        return () => {};
      }
      // Only the manifest decides what the workspace is, and a null key means the area was cleared.
      const listener = (event: Event) => {
        const { key, storageArea } = event as StorageEvent;
        if (storageArea === backend && (key === WORKSPACE_STORAGE_KEY || key === null)) onChange();
      };
      globalThis.addEventListener('storage', listener);
      return () => globalThis.removeEventListener('storage', listener);
    },
  };
}

function probe(backend: StorageLike): boolean {
  try {
    backend.setItem(PROBE_KEY, '1');
    backend.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
