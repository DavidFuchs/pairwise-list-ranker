/** Structural equality, used to recognise an entry the user did not edit. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((entry, index) => deepEqual(entry, b[index]));
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;

  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]),
  );
}
