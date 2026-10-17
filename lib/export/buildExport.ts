import { serializeDocument } from '@/lib/import/serialize';
import { isPlainObject } from '@/lib/import/shape';
import type { ListItem } from '@/types/list';
import type { DataSource, FieldRoles, SourceFormat } from '@/types/source';

/** A structural copy, so the stored source document is never mutated. */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value)) copy[key] = clone(value[key]);
    return copy as T;
  }
  return value;
}

export function setAtPath(document: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;

  const copy = clone(document);
  let current: unknown = copy;

  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current)) return copy;
    current = current[key];
  }

  const last = path[path.length - 1];
  if (isPlainObject(current) && last !== undefined) current[last] = value;

  return copy;
}

/**
 * The user's document back, with the ranked array spliced in at its own path.
 * Every other key, at every depth, survives exactly as it arrived.
 */
export function buildExportDocument(
  source: DataSource,
  roles: FieldRoles,
  entries: unknown[],
): unknown {
  const positioned = entries.map((entry, index) => {
    if (roles.positionField === undefined || !isPlainObject(entry)) return clone(entry);
    // Spread rewrites an existing key in place, so an existing `order` keeps
    // its position among the object's keys; a new one is appended.
    return { ...clone(entry), [roles.positionField]: index + 1 };
  });

  return setAtPath(source.document, source.arrayPath, positioned);
}

export function buildExport(
  source: DataSource,
  roles: FieldRoles,
  rankedItems: ListItem[],
  format: SourceFormat,
): string {
  const entries = rankedItems.filter((item) => item.active).map((item) => item.value);
  const document = buildExportDocument(source, roles, entries);

  switch (format) {
    case 'json':
    case 'yaml':
      return serializeDocument(document, format);
    case 'list':
      return `${entries.map((entry) => labelOf(entry, roles.labelField)).join('\n')}\n`;
  }
}

function labelOf(entry: unknown, labelField: string | undefined): string {
  if (!isPlainObject(entry)) return String(entry);

  const preferred = labelField === undefined ? undefined : entry[labelField];
  if (typeof preferred === 'string' || typeof preferred === 'number') return String(preferred);

  const firstText = Object.values(entry).find((value) => typeof value === 'string');
  return typeof firstText === 'string' ? firstText : 'Untitled item';
}
