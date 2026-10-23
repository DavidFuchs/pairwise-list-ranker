/**
 * Whether the placed item shows between the two rows it was placed between
 * (docs/ARCHITECTURE.md 6.6). The refit can swap those rows, since it sets the moved item's
 * answers aside; the item is then between them the other way round.
 */
export function between(
  ranked: readonly string[],
  target: { itemId: string; aboveItemId?: string; belowItemId?: string },
): boolean {
  const at = ranked.indexOf(target.itemId);
  if (at < 0) return false;
  if (target.aboveItemId === undefined) return at < ranked.indexOf(target.belowItemId as string);
  if (target.belowItemId === undefined) return ranked.indexOf(target.aboveItemId) < at;
  const rows = [ranked.indexOf(target.aboveItemId), ranked.indexOf(target.belowItemId)];
  return Math.min(...rows) < at && at < Math.max(...rows);
}
