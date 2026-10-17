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

/**
 * `insertIndexFor` for rows of one height at one spacing, when only the first
 * is measured - a windowed list has just a slice of its rows in the DOM.
 * `firstIndex` is the list index of the measured row.
 */
export function insertIndexForUniform(
  count: number,
  firstIndex: number,
  firstTop: number,
  rowHeight: number,
  pitch: number,
  pointerY: number,
): number {
  const rowsBefore = (pointerY - firstTop - rowHeight / 2) / pitch + firstIndex;
  if (rowsBefore <= 0) return 0;
  return Math.min(count, Math.ceil(rowsBefore));
}

/** How close to a scrolling edge a held drag starts the list moving. */
export const EDGE_SCROLL_ZONE = 48;
/** The fastest the list scrolls under a held drag, in pixels a frame. */
export const EDGE_SCROLL_MAX = 18;

/**
 * How far to scroll this frame while a drag is held at `pointerY`, given the
 * visible top and bottom of what scrolls: negative near the top, positive near
 * the bottom, zero in between. Faster the closer to the edge, and flat out
 * past it, so a row can be carried the length of a long list in one drag.
 */
export function edgeScrollStep(
  pointerY: number,
  top: number,
  bottom: number,
  zone = EDGE_SCROLL_ZONE,
  max = EDGE_SCROLL_MAX,
): number {
  // A short scroller would have its two zones overlap; each gets at most a third.
  const reach = Math.min(zone, (bottom - top) / 3);
  if (reach <= 0) return 0;
  const intoTop = top + reach - pointerY;
  if (intoTop > 0) return -Math.ceil(max * Math.min(1, intoTop / reach));
  const intoBottom = pointerY - (bottom - reach);
  if (intoBottom > 0) return Math.ceil(max * Math.min(1, intoBottom / reach));
  return 0;
}
