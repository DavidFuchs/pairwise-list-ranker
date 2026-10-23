/**
 * Joined on a character no real key contains, so `["a.b"]` and `["a", "b"]`
 * stay two lists. A dot would merge them, and a document with dotted keys
 * would mix up their rankings. A one-segment path keys as the segment itself.
 */
const SEPARATOR = '\u0000';

/** A list's path as a string, for maps and comparisons. Not for display: see formatPath. */
export function pathKey(path: string[]): string {
  return path.join(SEPARATOR);
}

/** The path a pathKey names; absent or empty keys are the document's own list. */
export function pathFromKey(key: string | undefined): string[] | undefined {
  if (key === undefined) return undefined;
  return key === '' ? [] : key.split(SEPARATOR);
}

export function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}
