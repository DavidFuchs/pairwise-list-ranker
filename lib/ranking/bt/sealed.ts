import { validateSnapshot } from '@/lib/ranking/bt/engine';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';
import type { EngineList } from '@/types/rankingEvents';

/** The wrapper's own format, apart from the snapshot's engine version. */
const SEAL_VERSION = 1;

/**
 * FNV-1a, 32-bit, over the string's UTF-16 code units, as 8 hex digits. It is
 * a corruption guard, not a security one: the restore walk already rejects a
 * snapshot whose priors do not belong to its events.
 */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * The snapshot's fields in a fixed order, so the same snapshot always gives
 * the same JSON whatever order its keys were set or parsed in. Unknown keys
 * are dropped. Takes anything an opened seal holds.
 */
function canonical(value: Record<string, unknown>): Record<string, unknown> {
  const { displaced } = value;
  return {
    version: value.version,
    originalItemIds: value.originalItemIds,
    startingOrder: value.startingOrder,
    eventIds: value.eventIds,
    tieOrder: value.tieOrder,
    priorMean: value.priorMean,
    priorVar: value.priorVar,
    placedAt: value.placedAt,
    strengths: value.strengths,
    displaced:
      typeof displaced === 'object' && displaced !== null
        ? {
            priorMean: (displaced as Record<string, unknown>).priorMean,
            priorVar: (displaced as Record<string, unknown>).priorVar,
            tieIndex: (displaced as Record<string, unknown>).tieIndex,
          }
        : displaced,
  };
}

/**
 * What the session showed when the snapshot was taken: the displayed order and
 * the next question, as item ids. Sealed with the snapshot so an open that
 * finds both can show the list at once and start its session afterwards.
 */
export interface SealedView {
  ranked: string[];
  unrecognized: string[];
  nextPair: [string, string] | null;
}

function isStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (typeof value[i] !== 'string') return false;
  return true;
}

/** The view's fields in a fixed order, or null if `value` is not a view. */
function canonicalView(value: unknown): SealedView | null {
  if (typeof value !== 'object' || value === null) return null;
  const { ranked, unrecognized, nextPair } = value as Record<string, unknown>;
  if (!isStrings(ranked) || !isStrings(unrecognized)) return null;
  if (nextPair !== null && !(isStrings(nextPair) && nextPair.length === 2)) return null;
  return { ranked, unrecognized, nextPair: nextPair as SealedView['nextPair'] };
}

/**
 * A snapshot as text for storage, with a checksum of its canonical JSON:
 * `{"v":1,"sum":"<hex>","snapshot":{...}}`. A view, if given, follows with a
 * checksum of its own: `,"shown":{"sum":"<hex>","view":{...}}`. Its own, so a
 * damaged view costs the quick open and never the snapshot.
 */
export function sealSnapshot(snapshot: EngineSnapshot, view?: SealedView): string {
  const body = JSON.stringify(canonical(snapshot as unknown as Record<string, unknown>));
  const head = `{"v":${SEAL_VERSION},"sum":"${fnv1a(body)}","snapshot":${body}`;
  if (view === undefined) return `${head}}`;
  const shown = JSON.stringify({
    ranked: view.ranked,
    unrecognized: view.unrecognized,
    nextPair: view.nextPair,
  });
  return `${head},"shown":{"sum":"${fnv1a(shown)}","view":${shown}}}`;
}

/**
 * The stored snapshot, with the view sealed beside it if that holds too, when
 * the checksum holds and the engine would accept the snapshot for this list;
 * otherwise null: bad JSON, another wrapper version, a wrong checksum, or
 * anything validateSnapshot rejects. Takes anything (storage can hand back
 * stale or corrupted text) and never throws.
 */
export function openSealedEntry(
  list: EngineList,
  text: unknown,
): { snapshot: EngineSnapshot; shown: SealedView | null } | null {
  if (typeof text !== 'string') return null;
  try {
    const sealed: unknown = JSON.parse(text);
    if (typeof sealed !== 'object' || sealed === null) return null;
    const { v, sum, snapshot, shown } = sealed as Record<string, unknown>;
    if (v !== SEAL_VERSION || typeof sum !== 'string') return null;
    if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return null;
    const fields = canonical(snapshot as Record<string, unknown>);
    if (fnv1a(JSON.stringify(fields)) !== sum) return null;
    // A field left undefined (no `displaced`) is not there once written, so it is dropped to match what was checked.
    if (fields.displaced === undefined) delete fields.displaced;
    const accepted = validateSnapshot(list, fields);
    return accepted === null ? null : { snapshot: accepted, shown: openView(shown) };
  } catch {
    return null;
  }
}

/** The view beside a snapshot if its checksum holds and it is shaped like one, else null. */
function openView(shown: unknown): SealedView | null {
  if (typeof shown !== 'object' || shown === null) return null;
  const { sum, view } = shown as Record<string, unknown>;
  const fields = canonicalView(view);
  if (fields === null || typeof sum !== 'string' || fnv1a(JSON.stringify(fields)) !== sum) return null;
  return fields;
}

/** The stored snapshot alone; see openSealedEntry. */
export function openSealed(list: EngineList, text: unknown): EngineSnapshot | null {
  return openSealedEntry(list, text)?.snapshot ?? null;
}
