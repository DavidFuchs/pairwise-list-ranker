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
 * Which slot the pointer is over. A row claims the pointer until it passes the
 * row's midpoint, which is what makes a drag snap one slot at a time rather
 * than jittering around the boundary.
 */
export function dropIndexFor(offsets: RowOffset[], pointerY: number): number {
  if (offsets.length === 0) return 0;

  for (let index = 0; index < offsets.length; index += 1) {
    const row = offsets[index];
    if (row === undefined) continue;
    if (pointerY < row.y + row.height / 2) return index;
  }

  return offsets.length - 1;
}
