import { BAND_WIDTH } from '@/lib/ranking/bt/constants';

/** The strength band: a fixed grid, so ties are transitive (docs/ARCHITECTURE.md 6.6). */
export function band(strength: number): number {
  return Math.round(strength / BAND_WIDTH);
}

/**
 * Total order over slots that decides display order inside a strength band.
 * Starts as the import order; placements splice the placed slot (docs/ARCHITECTURE.md 6.6).
 * Positions are kept in an array so sorting by them is O(1) per lookup.
 */
export class TieOrder {
  private order: number[];
  private positions: Int32Array;

  constructor(arrivalSlots: readonly number[]) {
    this.order = [...arrivalSlots];
    this.positions = new Int32Array(0);
    this.reindex();
  }

  /** Spec 6.4 splice rule. upper/lower are the recorded neighbours, absent at the edges. */
  splice(slot: number, upper: number | undefined, lower: number | undefined, strengths: Float64Array): void {
    if (upper === undefined && lower === undefined) return;
    const current = this.order.indexOf(slot);
    if (current >= 0) this.order.splice(current, 1);

    let at: number;
    if (upper === undefined) {
      at = this.order.indexOf(lower as number);
    } else if (lower === undefined) {
      at = this.order.indexOf(upper) + 1;
    } else if (band(strengths[slot] ?? 0) === band(strengths[upper] ?? 0)) {
      at = this.order.indexOf(upper) + 1;
    } else {
      at = this.order.indexOf(lower);
    }
    this.order.splice(at < 0 ? this.order.length : at, 0, slot);
    this.reindex();
  }

  /**
   * Puts a slot back at an index. A splice only moves its own slot, so moving
   * it back to the index it had before restores the order exactly.
   */
  moveTo(slot: number, index: number): void {
    const current = this.order.indexOf(slot);
    if (current >= 0) this.order.splice(current, 1);
    this.order.splice(index, 0, slot);
    this.reindex();
  }

  /** Every slot, in tie order. */
  get slots(): readonly number[] {
    return this.order;
  }

  position(slot: number): number {
    return this.positions[slot] ?? -1;
  }

  clone(): TieOrder {
    return new TieOrder(this.order);
  }

  private reindex(): void {
    let size = 0;
    for (const slot of this.order) size = Math.max(size, slot + 1);
    this.positions = new Int32Array(size).fill(-1);
    this.order.forEach((slot, index) => {
      this.positions[slot] = index;
    });
  }
}

/** Sort by band (highest first), then tie order. Nothing else. Returns a new array. */
export function displayedOrder(slots: readonly number[], strengths: Float64Array, tie: TieOrder): number[] {
  return [...slots].sort(
    (a, b) => band(strengths[b] ?? 0) - band(strengths[a] ?? 0) || tie.position(a) - tie.position(b),
  );
}
