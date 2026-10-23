import type { RankingEvent } from '@/types/rankingEvents';

/**
 * Status over the event history, kept apart from the fit so the solver sees
 * fixed slots. Slot i is the i-th item of the original import (a duplicate id
 * keeps its first slot). Every item is there before the first event and none
 * joins later, so every engine array can be indexed by slot and iterated in
 * import order.
 */
export class Timeline {
  private readonly order: string[];
  private readonly slots: Map<string, number>;
  private readonly removed: boolean[];
  private readonly unrecognized: boolean[];
  private readonly excluded: number[];
  private marked: number[];

  constructor(originalItemIds: readonly string[]) {
    this.order = [];
    this.slots = new Map();
    this.removed = [];
    this.unrecognized = [];
    this.excluded = [];
    this.marked = [];
    for (const id of originalItemIds) {
      if (this.slots.has(id)) continue;
      this.slots.set(id, this.order.length);
      this.order.push(id);
      this.removed.push(false);
      this.unrecognized.push(false);
      this.excluded.push(-1);
    }
  }

  /** Every item, in import order. Slot i of every engine array is arrivalOrder[i]. */
  get arrivalOrder(): readonly string[] {
    return this.order;
  }

  /** Unrecognized, not removed slots in marking order. */
  get unrecognizedOrder(): readonly number[] {
    return this.marked.filter((slot) => !this.isRemoved(slot));
  }

  slotOf(itemId: string): number | undefined {
    return this.slots.get(itemId);
  }

  isRemoved(slot: number): boolean {
    return this.removed[slot] === true;
  }

  isUnrecognized(slot: number): boolean {
    return this.unrecognized[slot] === true;
  }

  /** In the fit: a slot of the list and not unrecognized (docs/ARCHITECTURE.md 6.9). A removed item stays in the fit. */
  inFit(slot: number): boolean {
    return slot >= 0 && slot < this.order.length && !this.isUnrecognized(slot);
  }

  /** Visible: in the fit and not removed. */
  isVisible(slot: number): boolean {
    return this.inFit(slot) && !this.isRemoved(slot);
  }

  /** Evidence from event index e involving this slot counts iff e > excludedThrough(slot). -1 when never excluded. */
  excludedThrough(slot: number): number {
    return this.excluded[slot] ?? -1;
  }

  /** Applies one event's status effects. index is the event's position in the history. */
  apply(event: RankingEvent, index: number): void {
    switch (event.kind) {
      case 'removal':
        for (const id of event.itemIds) {
          const slot = this.slots.get(id);
          if (slot !== undefined) this.removed[slot] = true;
        }
        break;
      case 'unrecognized':
        for (const id of event.itemIds) {
          const slot = this.slots.get(id);
          if (slot === undefined || this.unrecognized[slot]) continue;
          this.unrecognized[slot] = true;
          this.marked.push(slot);
          this.excluded[slot] = index;
        }
        break;
      case 'placement':
        // The engine decides whether it applies (placementSlots), then places the item.
        break;
      case 'pair':
        break;
    }
  }

  /**
   * A placement at event `index` for a slot (docs/ARCHITECTURE.md 6.8): it leaves "don't
   * recognize", and its older evidence stops counting, for everyone.
   */
  place(slot: number, index: number): void {
    if (this.unrecognized[slot]) {
      this.unrecognized[slot] = false;
      this.marked = this.marked.filter((s) => s !== slot);
    }
    this.excluded[slot] = index;
  }

  clone(): Timeline {
    const copy = new Timeline([]);
    copy.order.push(...this.order);
    for (const [id, slot] of this.slots) copy.slots.set(id, slot);
    copy.removed.push(...this.removed);
    copy.unrecognized.push(...this.unrecognized);
    copy.excluded.push(...this.excluded);
    copy.marked = [...this.marked];
    return copy;
  }
}
