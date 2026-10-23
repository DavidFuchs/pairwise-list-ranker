import { isPlainObject } from '@/lib/import/shape';
import type { SortSpec } from '@/types/source';

/**
 * Sort by a field: the setup screen can order a list's starting prior by a
 * field whose values are numbers, numeric strings or ISO-style dates.
 */

export type SortKind = 'number' | 'date';

export interface SortFieldCandidate {
  field: string;
  kind: SortKind;
}

const NUMERIC_STRING = /^[+-]?\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** A sortable number for the value in the given kind, or null when it is not one. */
export function parseSortValue(value: unknown, kind: SortKind): number | null {
  if (kind === 'number') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!NUMERIC_STRING.test(text)) return null;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!ISO_DATE.test(text)) return null;
  // Date.parse rolls 2024-02-30 over to 1 March; a date that is not on the calendar is not a date.
  const [year, month, day] = [Number(text.slice(0, 4)), Number(text.slice(5, 7)), Number(text.slice(8, 10))];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return null;
  // A time with no zone would read as local time, a date alone as UTC: the
  // order of two entries would then depend on the device. Read both as UTC.
  const time = text.slice(10);
  const zoned = time === '' || /(Z|[+-]\d{2}:?\d{2})$/.test(time);
  const parsed = Date.parse(zoned ? text : `${text}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function kindOf(value: unknown): SortKind | null {
  if (parseSortValue(value, 'number') !== null) return 'number';
  if (parseSortValue(value, 'date') !== null) return 'date';
  return null;
}

/**
 * A field qualifies when at least half of all entries carry a value that
 * parses and those values are not all equal. Its kind is that of its first
 * parsed value; a value of the other kind then counts as missing.
 */
export function detectSortFields(entries: unknown[]): SortFieldCandidate[] {
  const objects = entries.filter(isPlainObject);
  const fields = new Set<string>();
  for (const entry of objects) {
    for (const field of Object.keys(entry)) fields.add(field);
  }

  const candidates: SortFieldCandidate[] = [];
  for (const field of fields) {
    let kind: SortKind | null = null;
    for (const entry of objects) {
      kind = kindOf(entry[field]);
      if (kind) break;
    }
    if (!kind) continue;

    const parsed: number[] = [];
    for (const entry of objects) {
      const value = parseSortValue(entry[field], kind);
      if (value !== null) parsed.push(value);
    }
    if (parsed.length * 2 < entries.length) continue;
    if (parsed.every((value) => value === parsed[0])) continue;
    candidates.push({ field, kind });
  }
  return candidates;
}

/** The kind a field sorts as, from its first parsed value, or null when none parses. */
function kindForField(entries: unknown[], field: string): SortKind | null {
  for (const entry of entries) {
    if (!isPlainObject(entry)) continue;
    const kind = kindOf(entry[field]);
    if (kind) return kind;
  }
  return null;
}

/**
 * The entry indexes in starting order. Parsed entries are ranked by value in
 * the chosen direction, ties by original index. Entries that did not parse form
 * one block, in original order, after the first half of the parsed ones (the
 * middle of the prior, since nothing is known about them).
 */
export function orderBySortField(entries: unknown[], spec: SortSpec): number[] {
  const identity = entries.map((_, index) => index);
  const kind = kindForField(entries, spec.field);
  if (!kind) return identity;

  const parsed: { index: number; value: number }[] = [];
  const unparsed: number[] = [];
  entries.forEach((entry, index) => {
    const value = isPlainObject(entry) ? parseSortValue(entry[spec.field], kind) : null;
    if (value === null) unparsed.push(index);
    else parsed.push({ index, value });
  });

  const sign = spec.direction === 'desc' ? -1 : 1;
  parsed.sort((a, b) => sign * (a.value - b.value) || a.index - b.index);

  const ranked = parsed.map((entry) => entry.index);
  const cut = Math.floor(ranked.length / 2);
  return [...ranked.slice(0, cut), ...unparsed, ...ranked.slice(cut)];
}

export function sortDirectionLabels(kind: SortKind): { desc: string; asc: string } {
  return kind === 'date'
    ? { desc: 'Newest first', asc: 'Oldest first' }
    : { desc: 'High to low', asc: 'Low to high' };
}

/** For example "sorted by plays, high to low". */
export function describeSort(spec: SortSpec, kind: SortKind): string {
  return `sorted by ${spec.field}, ${sortDirectionLabels(kind)[spec.direction].toLowerCase()}`;
}
