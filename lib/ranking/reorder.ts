/** A row's measured geometry within the scrolling list. */
export interface RowOffset {
  y: number;
  height: number;
}

/** The list with one entry moved. Both indexes are clamped into range. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;

  const target = Math.max(0, Math.min(to, next.length));
  next.splice(target, 0, moved);
  return next;
}

/**
 * Which gap the pointer sits in: 0 is above the first row, `rows.length` is
 * below the last. A row's midpoint is the boundary, which is what makes the
 * insertion line settle rather than flicker around an edge.
 */
export function insertIndexFor(offsets: RowOffset[], pointerY: number): number {
  let gap = 0;
  for (const row of offsets) {
    if (pointerY > row.y + row.height / 2) gap += 1;
  }
  return gap;
}

/**
 * Which gap a dragged row would drop into, given how far the pointer has moved
 * since it was grabbed.
 *
 * `deltaY` rather than a pointer position on purpose: rows are measured against
 * the scrolling content, while pointer events report viewport coordinates.
 * Mixing the two silently sends every drag to the end of the list, since a
 * viewport y is always larger than a content y near the top.
 */
export function dragInsertIndex(rows: RowOffset[], fromIndex: number, deltaY: number): number {
  const grabbed = rows[fromIndex];
  if (grabbed === undefined) return fromIndex;
  return insertIndexFor(rows, grabbed.y + deltaY + grabbed.height / 2);
}

/**
 * The index to move a row to so it lands in `gap`. Dropping below its own
 * position closes the hole the row leaves behind, so the target shifts up one.
 */
export function targetIndexForGap(fromIndex: number, gap: number): number {
  return gap > fromIndex ? gap - 1 : gap;
}

/** Whether dropping into this gap would actually change the order. */
export function gapMovesRow(fromIndex: number, gap: number): boolean {
  return gap !== fromIndex && gap !== fromIndex + 1;
}
