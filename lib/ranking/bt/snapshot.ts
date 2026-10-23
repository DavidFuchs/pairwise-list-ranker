import type { EngineSession } from '@/lib/ranking/bt/engine';
import type { Prior } from '@/lib/ranking/bt/priors';
import type { EngineList, StartingOrder } from '@/types/rankingEvents';

/**
 * Bump whenever replay semantics or the snapshot's shape change. A snapshot
 * from another version is ignored, so a stale cache can never change a result.
 */
export const ENGINE_SNAPSHOT_VERSION = 4;

/**
 * A JSON-safe copy of the engine's fitted state at the end of a history
 * (docs/ARCHITECTURE.md 6.5 item 8). It keeps only what a fit decided: strengths, priors and
 * the tie order. Removals, marks, evidence and what was shown are rebuilt
 * from the covered events on restore, which needs no fit and keeps the
 * snapshot small.
 * Arrays other than the ids are indexed by slot (arrival sequence, docs/ARCHITECTURE.md 6.9).
 */
export interface EngineSnapshot {
  version: number;
  originalItemIds: string[];
  startingOrder: StartingOrder;
  /** The covered events, in order. Never empty. */
  eventIds: string[];
  /** Slots in tie order (docs/ARCHITECTURE.md 6.6). */
  tieOrder: number[];
  priorMean: number[];
  priorVar: number[];
  /**
   * The index of the covered event whose placement set each slot's prior, or
   * -1 for a seed prior. A restore checks it against the covered events, so
   * priors from a longer history are never paired with a shorter one.
   */
  placedAt: number[];
  strengths: number[];
  /**
   * When the last covered event is an applied placement: the placed item's
   * prior and tie-order index from just before it, which the placement
   * overwrote. With them a session opened from the snapshot can step back one
   * event and so undo it with no replay (ruling W2). Absent otherwise, and
   * also when the exporting session did not know them (it was opened from a
   * snapshot and undone onto a placement); such a snapshot still restores.
   */
  displaced?: DisplacedPrior;
}

export interface DisplacedPrior {
  priorMean: number;
  priorVar: number;
  tieIndex: number;
}

/** The session's state at the end of its history, or null when it has no events. */
export function exportSnapshot(session: EngineSession): EngineSnapshot | null {
  return session.exportSnapshot();
}

/** Checks every index, holes included (`every` would skip them). */
function allOf(value: unknown, test: (entry: unknown) => boolean): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (!test(value[i])) return false;
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return allOf(value, (entry) => typeof entry === 'string');
}

function isFiniteArray(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    allOf(value, (entry) => typeof entry === 'number' && Number.isFinite(entry))
  );
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Every slot exactly once. */
function isPermutation(value: unknown, size: number): value is number[] {
  if (!Array.isArray(value) || value.length !== size) return false;
  const seen = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const slot: unknown = value[i];
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= size || seen[slot] === 1)
      return false;
    seen[slot] = 1;
  }
  return true;
}

type SnapshotFields = Partial<Record<keyof EngineSnapshot, unknown>>;

/**
 * The checks that need no walk of the events: the version, the list's items
 * and starting order, and a non-empty prefix of its event ids (export never
 * writes an empty one). Takes anything and never throws. Only the engine's
 * restore, which walks the covered events, can accept a snapshot.
 */
export function coversPrefixOf(
  list: EngineList,
  value: unknown,
): value is SnapshotFields & { eventIds: string[] } {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as SnapshotFields;
  if (s.version !== ENGINE_SNAPSHOT_VERSION) return false;
  if (!isStringArray(s.originalItemIds) || !sameIds(s.originalItemIds, list.originalItemIds)) return false;
  if (s.startingOrder !== list.startingOrder) return false;
  if (!isStringArray(s.eventIds) || s.eventIds.length === 0 || s.eventIds.length > list.events.length)
    return false;
  return s.eventIds.every((id, i) => id === list.events[i]?.id);
}

/**
 * The per-slot checks against what the walk of the covered events found: the
 * slot count, each slot's placement, and seed priors equal to what replay
 * would give them (they come from the same function, so exactly). Indexed by
 * slot like the snapshot's arrays.
 */
export function matchesSlots(
  s: SnapshotFields,
  placedAt: readonly number[],
  seedPriors: readonly Prior[],
): s is EngineSnapshot {
  const size = placedAt.length;
  if (!isPermutation(s.tieOrder, size)) return false;
  if (!isFiniteArray(s.strengths, size) || !isFiniteArray(s.priorMean, size)) return false;
  if (!isFiniteArray(s.priorVar, size) || !s.priorVar.every((variance) => variance > 0)) return false;
  if (!isFiniteArray(s.placedAt, size)) return false;
  for (let slot = 0; slot < size; slot++) {
    if (s.placedAt[slot] !== placedAt[slot]) return false;
    const seed = seedPriors[slot];
    if (placedAt[slot] === -1 && (s.priorMean[slot] !== seed?.mean || s.priorVar[slot] !== seed?.variance))
      return false;
  }
  return true;
}

/**
 * The displaced-prior check against what the walk found. `placed` is the
 * item and its earlier placement index (-1 for a seed prior) when the last
 * covered event was an applied placement. The record may be missing then
 * (see EngineSnapshot.displaced) but never present otherwise. A seed prior
 * must equal the derived one; an earlier placement's prior came from a fit,
 * so it is only checked to be a prior.
 */
export function matchesDisplaced(
  s: SnapshotFields,
  placed: { item: number; previousPlacedAt: number } | undefined,
  seedPriors: readonly Prior[],
  size: number,
): boolean {
  if (s.displaced === undefined) return true;
  if (placed === undefined || typeof s.displaced !== 'object' || s.displaced === null) return false;
  const { priorMean, priorVar, tieIndex } = s.displaced as Partial<Record<keyof DisplacedPrior, unknown>>;
  if (typeof priorMean !== 'number' || !Number.isFinite(priorMean)) return false;
  if (typeof priorVar !== 'number' || !Number.isFinite(priorVar) || priorVar <= 0) return false;
  if (typeof tieIndex !== 'number' || !Number.isInteger(tieIndex) || tieIndex < 0 || tieIndex >= size)
    return false;
  if (placed.previousPlacedAt !== -1) return true;
  const seed = seedPriors[placed.item];
  return priorMean === seed?.mean && priorVar === seed.variance;
}
