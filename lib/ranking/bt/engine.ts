import { CHECKPOINT_EVERY } from '@/lib/ranking/bt/constants';
import { Evidence, type EvidenceCounts } from '@/lib/ranking/bt/evidence';
import { type FitEvidence, FlipChances } from '@/lib/ranking/bt/flips';
import { compile, emptyCurvature, evaluate, type Problem } from '@/lib/ranking/bt/objective';
import { displayedOrder, TieOrder } from '@/lib/ranking/bt/order';
import { pairKey, pickPair } from '@/lib/ranking/bt/picker';
import { placementPrior, type Prior, seedPrior } from '@/lib/ranking/bt/priors';
import {
  coversPrefixOf,
  type DisplacedPrior,
  ENGINE_SNAPSHOT_VERSION,
  type EngineSnapshot,
  matchesDisplaced,
  matchesSlots,
} from '@/lib/ranking/bt/snapshot';
import { solve } from '@/lib/ranking/bt/solver';
import { Timeline } from '@/lib/ranking/bt/timeline';
import type { EngineList, RankingEvent, StartingOrder } from '@/types/rankingEvents';

type PlacementEvent = Extract<RankingEvent, { kind: 'placement' }>;

export type PriorSource = 'seed' | 'placement';

export interface EngineState {
  eventCount: number;
  /** Visible items, displayed order, best first. */
  ranked: string[];
  /** Unrecognized items in marking order (shown at the bottom). */
  unrecognized: string[];
  /** Fitted items only (docs/ARCHITECTURE.md 6.9 "in the fit"); unrecognized items are absent. */
  strengths: ReadonlyMap<string, number>;
  uncertainty: ReadonlyMap<string, number>;
  /** Where each fitted item's active prior came from. */
  priorSource: ReadonlyMap<string, PriorSource>;
  nextPair: [string, string] | null;
  /** What the flip chances are read from (flips.ts), by slot, and each fitted item's slot in it. */
  fit: FitEvidence;
  slots: ReadonlyMap<string, number>;
}

/**
 * What the last event, an applied placement, overwrote: the placed slot's
 * prior and its tie-order index. Undefined when the last event was anything
 * else, and also for a state stepped back onto a placement from a persisted
 * snapshot or a checkpoint, which never held it (stepBack tells the two apart
 * from the events).
 */
interface Displaced extends DisplacedPrior {
  item: number;
}

/** Everything replay builds up, as of eventCount events. Arrays are indexed by slot. */
interface ReplayState {
  timeline: Timeline;
  evidence: Evidence;
  tie: TieOrder;
  priorMean: Float64Array;
  priorVar: Float64Array;
  /** The index of the placement event that set each slot's prior, or -1 for a seed prior. */
  placedAt: number[];
  strengths: Float64Array;
  /** Times each pair of slots has been shown, by pairKey. */
  shown: Map<number, number>;
  previousPair: number | undefined;
  eventCount: number;
  displaced: Displaced | undefined;
}

/**
 * What a checkpoint keeps of a replay state after a placement or every
 * CHECKPOINT_EVERY events, keyed by the prefix it covers. Evidence is only ever
 * appended, so a count of its terms stands in for a copy; `shown` and
 * `previousPair` are cheap to rebuild from the events, so they are not kept.
 */
interface Checkpoint {
  timeline: Timeline;
  tie: TieOrder;
  priorMean: Float64Array;
  priorVar: Float64Array;
  placedAt: number[];
  strengths: Float64Array;
  evidenceCounts: EvidenceCounts;
  eventCount: number;
  lastEventId: string | undefined;
  displaced: Displaced | undefined;
}

function takeCheckpoint(state: ReplayState, lastEventId: string | undefined): Checkpoint {
  return {
    timeline: state.timeline.clone(),
    tie: state.tie.clone(),
    priorMean: state.priorMean.slice(),
    priorVar: state.priorVar.slice(),
    placedAt: [...state.placedAt],
    strengths: state.strengths.slice(),
    evidenceCounts: state.evidence.counts(),
    eventCount: state.eventCount,
    lastEventId,
    displaced: state.displaced,
  };
}

/**
 * The state a checkpoint covers. The caller's evidence (which holds at least
 * the checkpoint's terms) is truncated to it; `shown` and `previousPair` are
 * recounted from the prefix, with no fit.
 */
function restoreCheckpoint(
  checkpoint: Checkpoint,
  evidence: Evidence,
  events: readonly RankingEvent[],
  originalItemIds: readonly string[],
): ReplayState {
  evidence.truncate(checkpoint.evidenceCounts);
  const { shown, previousPair } = walkEvents(originalItemIds, events, checkpoint.eventCount, evidence);
  return {
    timeline: checkpoint.timeline.clone(),
    evidence,
    tie: checkpoint.tie.clone(),
    priorMean: checkpoint.priorMean.slice(),
    priorVar: checkpoint.priorVar.slice(),
    placedAt: [...checkpoint.placedAt],
    strengths: checkpoint.strengths.slice(),
    shown,
    previousPair,
    eventCount: checkpoint.eventCount,
    displaced: checkpoint.displaced,
  };
}

/**
 * The session as it stood just before its last append (docs/ARCHITECTURE.md 6.5 item 7), so
 * undoing that event needs no replay and no fit. The replay state is kept as a
 * checkpoint (evidence by term counts); `shown` is not copied, since taking the
 * event's own showings back out restores it exactly.
 */
interface UndoSnapshot {
  before: Checkpoint;
  previousPair: number | undefined;
  event: RankingEvent;
  state: EngineState;
}

/**
 * Restores a snapshot's replay state onto the live one. The snapshot's arrays
 * are taken as they are, since it is restored at most once. The pre-event
 * timeline gives the event's slots: a pair never changes them.
 */
function restoreSnapshot(snapshot: UndoSnapshot, live: ReplayState): ReplayState {
  const { before } = snapshot;
  live.evidence.truncate(before.evidenceCounts);
  countEventShown(live.shown, before.timeline, snapshot.event, -1);
  return {
    timeline: before.timeline,
    evidence: live.evidence,
    tie: before.tie,
    priorMean: before.priorMean,
    priorVar: before.priorVar,
    placedAt: before.placedAt,
    strengths: before.strengths,
    shown: live.shown,
    previousPair: snapshot.previousPair,
    eventCount: before.eventCount,
    displaced: before.displaced,
  };
}

/** A placement's item and its recorded neighbours, as slots. */
interface PlacementSlots {
  item: number;
  upper: number | undefined;
  lower: number | undefined;
}

/**
 * A placement's item and its recorded neighbours, or undefined when it is
 * skipped (docs/ARCHITECTURE.md 6.8): the item cannot be placed, or neither neighbour is
 * visible. Depends only on the timeline, so a restore can tell without a fit.
 */
function placementSlots(timeline: Timeline, event: PlacementEvent): PlacementSlots | undefined {
  const item = timeline.slotOf(event.itemId);
  if (item === undefined || timeline.isRemoved(item)) return undefined;
  const neighbour = (itemId: string | undefined): number | undefined => {
    const slot = itemId === undefined ? undefined : timeline.slotOf(itemId);
    return slot !== undefined && slot !== item && timeline.isVisible(slot) ? slot : undefined;
  };
  const upper = neighbour(event.aboveItemId);
  const lower = neighbour(event.belowItemId);
  return upper === undefined && lower === undefined ? undefined : { item, upper, lower };
}

/** Options for replay and EngineSession. */
export interface ReplayOptions {
  /** A persisted snapshot (docs/ARCHITECTURE.md 6.5 item 8), used only if it matches the list; anything else is ignored. */
  snapshot?: unknown;
}

/** Each slot's seed prior (docs/ARCHITECTURE.md 6.4), from the item's first position in the import. */
function seedPriors(
  timeline: Timeline,
  originalItemIds: readonly string[],
  startingOrder: StartingOrder,
): Prior[] {
  const priors: Prior[] = [];
  originalItemIds.forEach((itemId, position) => {
    const slot = timeline.slotOf(itemId) as number;
    priors[slot] ??= seedPrior(position, originalItemIds.length, startingOrder);
  });
  return priors;
}

/** What a walk of a history's first events rebuilds with no fit. */
interface Walk {
  timeline: Timeline;
  evidence: Evidence;
  shown: Map<number, number>;
  previousPair: number | undefined;
  /** The placement that set each slot's prior, or -1, as in ReplayState. */
  placedAt: number[];
  /** The placed slot and its earlier placedAt, when the last walked event was an applied placement. */
  lastPlaced: { item: number; previousPlacedAt: number } | undefined;
}

/**
 * Walks the first `count` events: removals and marks, evidence and what was shown,
 * and which placements applied. Evidence only reads the timeline, so none of
 * it needs a fit. With `known` evidence (which holds at least these events'
 * terms) none is rebuilt.
 */
function walkEvents(
  originalItemIds: readonly string[],
  events: readonly RankingEvent[],
  count: number,
  known?: Evidence,
): Walk {
  const timeline = new Timeline(originalItemIds);
  const evidence = known ?? new Evidence();
  const shown = new Map<number, number>();
  const placedAt: number[] = [];
  let previousPair: number | undefined;
  let lastPlaced: Walk['lastPlaced'];
  for (let i = 0; i < count; i++) {
    const event = events[i] as RankingEvent;
    lastPlaced = undefined;
    if (event.kind === 'pair') {
      if (known === undefined) evidence.add(event, i, timeline);
    } else if (event.kind === 'placement') {
      // As Replayer.place: the placement is judged against the state before the event.
      const slots = placementSlots(timeline, event);
      if (slots !== undefined) {
        const { item } = slots;
        lastPlaced = { item, previousPlacedAt: placedAt[item] ?? -1 };
        timeline.place(item, i);
        placedAt[item] = i;
      }
    } else {
      timeline.apply(event, i);
    }
    previousPair = countEventShown(shown, timeline, event);
  }
  for (let slot = 0; slot < timeline.arrivalOrder.length; slot++) placedAt[slot] ??= -1;
  return { timeline, evidence, shown, previousPair, placedAt, lastPlaced };
}

/** The state a validated snapshot restores to, for the list it was validated against. */
const validatedStates = new WeakMap<object, { list: EngineList; state: ReplayState }>();

/**
 * The replay state after a persisted snapshot's covered events, or undefined
 * when the snapshot does not match the list. The snapshot gives what the fits
 * decided; the rest comes from a walk of the covered events. The same walk
 * finds which placements applied, so the snapshot's priors are accepted only
 * when they could have come from exactly these events.
 */
function restorePersisted(list: EngineList, value: unknown): ReplayState | undefined {
  // validateSnapshot already walked these events; its state is used once, as a session mutates it.
  const validated = typeof value === 'object' && value !== null ? validatedStates.get(value) : undefined;
  if (validated !== undefined && validated.list === list) {
    validatedStates.delete(value as object);
    return validated.state;
  }
  return walkPersisted(list, value);
}

function walkPersisted(list: EngineList, value: unknown): ReplayState | undefined {
  if (!coversPrefixOf(list, value)) return undefined;
  const count = value.eventIds.length;
  const { timeline, evidence, shown, previousPair, placedAt, lastPlaced } = walkEvents(
    list.originalItemIds,
    list.events,
    count,
  );
  const seeds = seedPriors(timeline, list.originalItemIds, list.startingOrder);
  if (!matchesSlots(value, placedAt, seeds)) return undefined;
  if (!matchesDisplaced(value, lastPlaced, seeds, placedAt.length)) return undefined;
  const record = value.displaced;
  const displaced: Displaced | undefined =
    lastPlaced === undefined || record === undefined
      ? undefined
      : {
          item: lastPlaced.item,
          priorMean: record.priorMean,
          priorVar: record.priorVar,
          tieIndex: record.tieIndex,
        };
  return {
    timeline,
    evidence,
    tie: new TieOrder(value.tieOrder),
    priorMean: Float64Array.from(value.priorMean),
    priorVar: Float64Array.from(value.priorVar),
    placedAt,
    strengths: Float64Array.from(value.strengths),
    shown,
    previousPair,
    eventCount: count,
    displaced,
  };
}

/**
 * The state one event before a fitted one, so a session built from it can
 * keep an undo snapshot. Removals, marks, evidence and what was shown come
 * from a walk of the earlier events; what the fits decided comes from the
 * state, with a placement's displaced prior and tie index put back. The strengths are only a warm start: the caller
 * fits. Undefined when the last event is an applied placement whose displaced
 * prior the state does not hold.
 */
function stepBack(state: ReplayState, list: EngineList): ReplayState | undefined {
  const { displaced } = state;
  const count = state.eventCount - 1;
  const walk = walkEvents(list.originalItemIds, list.events, count);
  const last = list.events[count] as RankingEvent;
  // The walk's timeline is the one before the last event, so it tells whether that placement applied.
  if (
    displaced === undefined &&
    last.kind === 'placement' &&
    placementSlots(walk.timeline, last) !== undefined
  )
    return undefined;
  const priorMean = state.priorMean.slice();
  const priorVar = state.priorVar.slice();
  const tie = state.tie.clone();
  if (displaced !== undefined) {
    priorMean[displaced.item] = displaced.priorMean;
    priorVar[displaced.item] = displaced.priorVar;
    tie.moveTo(displaced.item, displaced.tieIndex);
  }
  return {
    timeline: walk.timeline,
    evidence: walk.evidence,
    tie,
    priorMean,
    priorVar,
    placedAt: walk.placedAt,
    strengths: state.strengths.slice(),
    shown: walk.shown,
    previousPair: walk.previousPair,
    eventCount: count,
    // What the event before overwrote is not held; a further step back tells from the events.
    displaced: undefined,
  };
}

/**
 * The snapshot if a replay would accept it for this list, otherwise null. It
 * runs the same walk of the covered events as the restore, so the two cannot
 * disagree. Takes anything (it may come from storage, stale or corrupted) and
 * never throws.
 */
export function validateSnapshot(list: EngineList, value: unknown): EngineSnapshot | null {
  const state = walkPersisted(list, value);
  if (state === undefined) return null;
  // Kept for the open that follows, which would otherwise walk the same events again.
  validatedStates.set(value as object, { list, state });
  return value as EngineSnapshot;
}

/** The state before any event: seed priors (docs/ARCHITECTURE.md 6.4), strengths at the prior means, tie order the import order. */
function initialState(originalItemIds: readonly string[], startingOrder: StartingOrder): ReplayState {
  const timeline = new Timeline(originalItemIds);
  const priors = seedPriors(timeline, originalItemIds, startingOrder);
  const size = priors.length;
  return {
    timeline,
    evidence: new Evidence(),
    tie: new TieOrder(Array.from({ length: size }, (_, slot) => slot)),
    priorMean: Float64Array.from(priors, (prior) => prior.mean),
    priorVar: Float64Array.from(priors, (prior) => prior.variance),
    placedAt: new Array<number>(size).fill(-1),
    strengths: Float64Array.from(priors, (prior) => prior.mean),
    shown: new Map(),
    previousPair: undefined,
    eventCount: 0,
    displaced: undefined,
  };
}

/**
 * The objective for the current timeline. A new free array every time: the
 * objective caches by its identity, and the in-fit set may have changed.
 */
function buildProblem(state: ReplayState): Problem {
  const { timeline } = state;
  const free: number[] = [];
  for (let slot = 0; slot < timeline.arrivalOrder.length; slot++) {
    if (timeline.inFit(slot)) free.push(slot);
  }
  const { pairs } = state.evidence.activeTerms(timeline);
  return {
    free: Int32Array.from(free),
    priorMean: state.priorMean,
    priorVar: state.priorVar,
    pairs,
  };
}

function visibleSlots(timeline: Timeline): number[] {
  const slots: number[] = [];
  for (let slot = 0; slot < timeline.arrivalOrder.length; slot++) {
    if (timeline.isVisible(slot)) slots.push(slot);
  }
  return slots;
}

/**
 * Counts what one event showed (a pair question shows its two items) and
 * returns the pairKey it leaves as the previous pair question, if it was one.
 * A delta of -1 takes the event back out (a pair back at zero is dropped).
 */
function countEventShown(
  shown: Map<number, number>,
  timeline: Timeline,
  event: RankingEvent,
  delta = 1,
): number | undefined {
  if (event.kind !== 'pair') return undefined;
  const left = timeline.slotOf(event.leftItemId);
  const right = timeline.slotOf(event.rightItemId);
  if (left === undefined || right === undefined || left === right) return undefined;
  const key = pairKey(left, right);
  const times = (shown.get(key) ?? 0) + delta;
  if (times > 0) shown.set(key, times);
  else shown.delete(key);
  return key;
}

/** A fit's problem, and the curvature diagonal at its result when the solver handed one back. */
interface Fit {
  problem: Problem;
  curvature?: Float64Array;
}

/**
 * Replays events into a state. Cold replay fits only at placements and at the
 * end; the warm path fits after every event. Both run through process, so
 * they differ only in where they fit.
 */
class Replayer {
  fits = 0;
  /** Solves that stopped without meeting the solver's test (docs/ARCHITECTURE.md 6.5). Tests and benchmarks assert this stays zero. */
  nonConverged = 0;

  constructor(
    public state: ReplayState,
    private readonly checkpoints: Checkpoint[] | null,
  ) {}

  /**
   * Fits the strengths from where they stand. Spec 6.3 asks for a cold
   * rebuild when the solver misses its test; that fallback is deferred to the
   * integration plan (controller ruling R11). Until then a miss is only counted.
   * A final fit asks for the curvature at its result, so describeState can
   * skip compiling and evaluating the problem again.
   */
  fit(wantCurvature = false): Fit {
    const problem = buildProblem(this.state);
    const result = solve(problem, this.state.strengths, { wantDiagonal: wantCurvature });
    this.fits++;
    if (!result.converged) this.nonConverged++;
    return { problem, curvature: result.diagonal };
  }

  /** Folds in one event. Returns true when it left the state fitted: an applied placement, or a checkpoint. */
  process(event: RankingEvent): boolean {
    const state = this.state;
    const index = state.eventCount;
    let placed = false;
    state.displaced = undefined;
    switch (event.kind) {
      case 'removal':
      case 'unrecognized':
        state.timeline.apply(event, index);
        break;
      case 'pair':
        state.evidence.add(event, index, state.timeline);
        break;
      case 'placement':
        placed = this.place(event, index);
        break;
    }
    state.previousPair = countEventShown(state.shown, state.timeline, event);
    state.eventCount = index + 1;
    if (this.checkpoints && (placed || state.eventCount % CHECKPOINT_EVERY === 0)) {
      // A placement has just fitted; any other event is fitted here, so the
      // checkpoint holds fitted strengths (docs/ARCHITECTURE.md 6.5) and a restore starts warm.
      if (!placed) this.fit();
      this.checkpoints.push(takeCheckpoint(state, event.id));
      return true;
    }
    return placed;
  }

  /**
   * Spec 6.6: the placement is judged against the state before the event, the
   * item's earlier evidence stops counting for both sides, the state is
   * fitted, and then the item is put between its rows. False when it does not
   * apply.
   */
  private place(event: PlacementEvent, index: number): boolean {
    const state = this.state;
    const slots = placementSlots(state.timeline, event);
    if (slots === undefined) return false;
    const { item } = slots;
    const displaced: Displaced = {
      item,
      priorMean: state.priorMean[item] as number,
      priorVar: state.priorVar[item] as number,
      tieIndex: state.tie.position(item),
    };
    state.timeline.place(item, index);
    this.fit();
    this.settle(slots, index);
    state.displaced = displaced;
    return true;
  }

  /** Spec 6.6 steps 3 to 5, once the item's evidence no longer counts for it and the state is fitted: puts the item between its neighbours. */
  private settle(slots: PlacementSlots, index: number): void {
    const state = this.state;
    const { timeline, strengths } = state;
    const { item } = slots;
    let { upper, lower } = slots;
    const visibleOrder = displayedOrder(
      visibleSlots(timeline).filter((slot) => slot !== item),
      strengths,
      state.tie,
    );
    // Rows recorded in the opposite order to the one now displayed (malformed
    // data) are taken in displayed order,
    // so the splice puts the item between them. The midpoint is unchanged.
    if (
      upper !== undefined &&
      lower !== undefined &&
      visibleOrder.indexOf(lower) < visibleOrder.indexOf(upper)
    ) {
      [upper, lower] = [lower, upper];
    }
    const at = upper !== undefined ? visibleOrder.indexOf(upper) + 1 : visibleOrder.indexOf(lower as number);
    const prior = placementPrior(visibleOrder, strengths, at);
    // Between two rows, the anchor is their midpoint even if the refit put other rows between them.
    const mean =
      upper !== undefined && lower !== undefined
        ? ((strengths[upper] as number) + (strengths[lower] as number)) / 2
        : prior.mean;
    state.priorMean[item] = mean;
    state.priorVar[item] = prior.variance;
    state.placedAt[item] = index;
    // The item has no counted evidence, so its optimum is the prior mean and no refit is needed.
    strengths[item] = mean;
    state.tie.splice(item, upper, lower, strengths);
  }

  /** Cold path: processes events from the state's eventCount up to `end`, fitting only where process does. */
  advance(events: readonly RankingEvent[], end = events.length): void {
    for (let i = this.state.eventCount; i < end; i++) this.process(events[i] as RankingEvent);
  }

  /** Cold path: replays events from the state's eventCount, fitting only at placements and once at the end. */
  run(events: readonly RankingEvent[]): Fit {
    this.advance(events);
    return this.fit(true);
  }

  /** Folds in one last event and leaves the state fitted, as append does. */
  finish(event: RankingEvent): Fit {
    // A fitted state needs no second solve, only its curvature, which is worked
    // out from the problem (a placement's fit also ran before the item's new
    // prior, so the curvature could not have come from it anyway).
    return this.process(event) ? { problem: buildProblem(this.state) } : this.fit(true);
  }
}

/**
 * The curvature diagonal at the state's strengths, for a fit that did not hand
 * one back. It comes from evaluate, which shares one exp per slot across terms.
 */
function curvatureAt(state: ReplayState, problem: Problem): Float64Array {
  const { strengths } = state;
  const compiled = compile(problem, strengths.length);
  const curved = emptyCurvature(compiled);
  evaluate(compiled, strengths, new Float64Array(strengths.length), curved);
  return curved.diagonal;
}

function describeState(state: ReplayState, { problem, curvature: fitted }: Fit): EngineState {
  const { timeline, strengths } = state;
  const ids = timeline.arrivalOrder;
  const curvature = fitted ?? curvatureAt(state, problem);
  const uncertainty = new Float64Array(strengths.length);
  const strengthMap = new Map<string, number>();
  const uncertaintyMap = new Map<string, number>();
  const sourceMap = new Map<string, PriorSource>();
  const slots = new Map<string, number>();
  for (const slot of problem.free) {
    uncertainty[slot] = 1 / (curvature[slot] as number);
    const id = ids[slot] as string;
    strengthMap.set(id, strengths[slot] as number);
    uncertaintyMap.set(id, uncertainty[slot] as number);
    sourceMap.set(id, (state.placedAt[slot] as number) >= 0 ? 'placement' : 'seed');
    slots.set(id, slot);
  }
  const order = displayedOrder(visibleSlots(timeline), strengths, state.tie);
  const fit: FitEvidence = {
    strengths: strengths.slice(),
    uncertainty,
    priorMean: state.priorMean.slice(),
    priorVar: state.priorVar.slice(),
    // A fresh array for each problem, and its terms are never changed.
    pairs: problem.pairs,
  };
  const flips = new FlipChances(fit);
  const input = {
    order,
    strengths,
    uncertainty,
    shown: state.shown,
    previousPair: state.previousPair,
    flips,
  };
  const nextPair = pickPair(input);
  return {
    eventCount: state.eventCount,
    ranked: order.map((slot) => ids[slot] as string),
    unrecognized: timeline.unrecognizedOrder.map((slot) => ids[slot] as string),
    strengths: strengthMap,
    uncertainty: uncertaintyMap,
    priorSource: sourceMap,
    nextPair: nextPair ? [ids[nextPair[0]] as string, ids[nextPair[1]] as string] : null,
    fit,
    slots,
  };
}

/** The persisted snapshot's state when it matches the list, otherwise the priors. */
function startingState(list: EngineList, options: ReplayOptions): ReplayState {
  const restored = options.snapshot === undefined ? undefined : restorePersisted(list, options.snapshot);
  return restored ?? initialState(list.originalItemIds, list.startingOrder);
}

/**
 * Cold replay with the solver's bookkeeping, for tests and benchmarks.
 * fromEvent is where it started: the events a matching snapshot covered, or 0.
 */
export function replayWithStats(
  list: EngineList,
  options: ReplayOptions = {},
): { state: EngineState; fits: number; nonConverged: number; fromEvent: number } {
  const replayer = new Replayer(startingState(list, options), null);
  const fromEvent = replayer.state.eventCount;
  const state = describeState(replayer.state, replayer.run(list.events));
  return { state, fits: replayer.fits, nonConverged: replayer.nonConverged, fromEvent };
}

/**
 * Cold replay: the canonical result (docs/ARCHITECTURE.md 6.6). A matching snapshot skips the
 * events it covers; without one, or with one that does not match, it runs
 * from the priors.
 */
export function replay(list: EngineList, options: ReplayOptions = {}): EngineState {
  return replayWithStats(list, options).state;
}

/**
 * A fitted state at the end of the list's history as a persisted snapshot
 * (docs/ARCHITECTURE.md 6.5 item 8). The arrays are copied, so the snapshot stays as it is
 * while the state moves on.
 */
function snapshotOf(list: EngineList, state: ReplayState): EngineSnapshot {
  return {
    version: ENGINE_SNAPSHOT_VERSION,
    originalItemIds: [...list.originalItemIds],
    startingOrder: list.startingOrder,
    eventIds: list.events.map((event) => event.id),
    tieOrder: [...state.tie.slots],
    priorMean: Array.from(state.priorMean),
    priorVar: Array.from(state.priorVar),
    placedAt: [...state.placedAt],
    strengths: Array.from(state.strengths),
    ...(state.displaced !== undefined
      ? {
          displaced: {
            priorMean: state.displaced.priorMean,
            priorVar: state.displaced.priorVar,
            tieIndex: state.displaced.tieIndex,
          },
        }
      : {}),
  };
}

/** A cold replay done a slice at a time, so it can run on the main thread without holding it. */
export interface ReplayJob {
  /**
   * Works until `budgetMs` has passed, checking the clock after each event and
   * after the final fit, so a step overruns by at most one of those. A zero
   * budget does exactly one. Returns true when the replay is done.
   */
  step(budgetMs: number): boolean;
  /** The finished replay as a persisted snapshot. Throws before it is done, or for a history with no events. */
  snapshot(): EngineSnapshot;
  /** The finished replay's state, for a caller that cannot use a snapshot. Throws before it is done. */
  state(): EngineState;
}

/**
 * Cold replay from the priors in resumable steps. It runs the same Replayer
 * as replay, event by event and then the same final fit, so its result is the
 * canonical one (docs/ARCHITECTURE.md 6.6), not an approximation of it.
 */
export function createReplayJob(list: EngineList): ReplayJob {
  const replayer = new Replayer(initialState(list.originalItemIds, list.startingOrder), null);
  const { events } = list;
  let fit: Fit | undefined;
  return {
    step(budgetMs) {
      const start = performance.now();
      while (fit === undefined) {
        const index = replayer.state.eventCount;
        if (index < events.length) {
          replayer.process(events[index] as RankingEvent);
        } else {
          fit = replayer.fit();
        }
        if (performance.now() - start >= budgetMs) break;
      }
      return fit !== undefined;
    },
    snapshot() {
      if (fit === undefined) throw new Error('The replay has not finished.');
      if (events.length === 0) throw new Error('A history with no events has no snapshot.');
      return snapshotOf(list, replayer.state);
    },
    state() {
      if (fit === undefined) throw new Error('The replay has not finished.');
      return describeState(replayer.state, fit);
    },
  };
}

/**
 * For convergence-quality tests: a cold replay whose final fit is then pushed
 * far past the stopping test. The fitted strengths are shaken by `shake`
 * (about 10,000 times the tolerance) and solved again with a generous
 * iteration cap; Newton's quadratic convergence then ends well below the
 * tolerance, so the result is the optimum to near machine precision.
 */
export function replayPolished(
  list: EngineList,
  shake = 1e-6,
): { state: EngineState; converged: boolean; iterations: number } {
  const replayer = new Replayer(initialState(list.originalItemIds, list.startingOrder), null);
  const { problem } = replayer.run(list.events);
  const { strengths } = replayer.state;
  for (const slot of problem.free) strengths[slot] = (strengths[slot] as number) + shake * Math.sin(slot + 1);
  const { diagonal, ...result } = solve(problem, strengths, { maxIterations: 1000, wantDiagonal: true });
  return { state: describeState(replayer.state, { problem, curvature: diagonal }), ...result };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * A live ranking: answers fold in warm, while undo and reset rebuild from the
 * latest checkpoint still valid for the new history (docs/ARCHITECTURE.md 6.5). Checkpoints
 * are a cache; replay(list) stays the definition of the result.
 */
export class EngineSession {
  private list: EngineList;
  private events: RankingEvent[];
  private checkpoints: Checkpoint[] = [];
  private replayer!: Replayer;
  private current!: EngineState;
  private rebuild = { fromEvent: 0, fits: 0, fromSnapshot: false };
  private missedSolves = 0;
  /**
   * Set by append, construction and reset, and cleared by undo, so it only
   * ever undoes the event it belongs to.
   */
  private snapshot: UndoSnapshot | undefined;

  /**
   * A matching persisted snapshot also becomes the session's first
   * checkpoint. Like reset, construction leaves an undo snapshot.
   */
  constructor(list: EngineList, options: ReplayOptions = {}) {
    this.list = list;
    this.events = [...list.events];
    const start = startingState(list, options);
    if (start.eventCount > 0) {
      this.checkpoints.push(takeCheckpoint(start, this.events[start.eventCount - 1]?.id));
    }
    this.rebuildFrom(start);
  }

  get state(): EngineState {
    return this.current;
  }

  /** For tests and benchmarks: how the last operation rebuilt, and whether it restored the undo snapshot. */
  get lastRebuild(): { fromEvent: number; fits: number; fromSnapshot: boolean } {
    return this.rebuild;
  }

  /**
   * For tests and benchmarks: solves that missed the solver's test since the
   * session began. Undo never lowers it: a miss happened even if its event is gone.
   */
  get nonConverged(): number {
    return this.missedSolves;
  }

  /** For tests: each checkpoint's event count and its stored strengths by item id. */
  get checkpointStrengths(): { eventCount: number; strengths: Map<string, number> }[] {
    return this.checkpoints.map((c) => {
      const strengths = new Map<string, number>();
      c.timeline.arrivalOrder.forEach((id, slot) => strengths.set(id, c.strengths[slot] as number));
      return { eventCount: c.eventCount, strengths };
    });
  }

  /**
   * The live state as a persisted snapshot, or null before any event. The
   * live state is always fitted, like a checkpoint, so it needs no extra fit,
   * and a snapshot of the whole history leaves a reload only the final fit.
   */
  exportSnapshot(): EngineSnapshot | null {
    const state = this.replayer.state;
    return state.eventCount === 0 ? null : snapshotOf(this.list, state);
  }

  /** Warm path: fold one event in, warm-starting the fit. */
  append(event: RankingEvent): EngineState {
    const live = this.replayer.state;
    const snapshot: UndoSnapshot = {
      before: takeCheckpoint(live, this.events[this.events.length - 1]?.id),
      previousPair: live.previousPair,
      event,
      state: this.current,
    };
    const replayer = new Replayer(live, this.checkpoints);
    const fromEvent = replayer.state.eventCount;
    const fit = replayer.finish(event);
    this.events.push(event);
    this.list = { ...this.list, events: this.events };
    this.replayer = replayer;
    this.rebuild = { fromEvent, fits: replayer.fits, fromSnapshot: false };
    this.missedSolves += replayer.nonConverged;
    this.current = describeState(replayer.state, fit);
    this.snapshot = snapshot;
    return this.current;
  }

  /**
   * Whether undo can run without a long replay: from the undo snapshot, or
   * from a checkpoint (or the start) at most CHECKPOINT_EVERY events before
   * the history it leaves. A session opened from a persisted snapshot has no
   * earlier checkpoint, so its second undo would replay from the priors; the
   * app sends that one to the cold builder instead (docs/ARCHITECTURE.md 6.5).
   */
  canUndoWarm(): boolean {
    const total = this.events.length;
    if (total === 0) return true;
    if (this.snapshot !== undefined && this.snapshot.event === this.events[total - 1]) return true;
    let from = 0;
    for (const c of this.checkpoints) if (c.eventCount < total) from = Math.max(from, c.eventCount);
    return total - 1 - from <= CHECKPOINT_EVERY;
  }

  /**
   * Removes the last event: straight from the undo snapshot when that event was
   * the last append, otherwise by rebuilding from the latest checkpoint before it.
   */
  undo(): EngineState {
    const snapshot = this.snapshot;
    this.snapshot = undefined;
    if (this.events.length === 0) {
      this.rebuild = { fromEvent: 0, fits: 0, fromSnapshot: false };
      return this.current;
    }
    if (snapshot === undefined || snapshot.event !== this.events[this.events.length - 1]) {
      return this.reset({ ...this.list, events: this.events.slice(0, -1) });
    }
    const start = restoreSnapshot(snapshot, this.replayer.state);
    this.events = this.events.slice(0, -1);
    this.list = { ...this.list, events: this.events };
    // An append that took a checkpoint leaves one past the restored state.
    this.checkpoints = this.checkpoints.filter((c) => c.eventCount <= start.eventCount);
    this.replayer = new Replayer(start, this.checkpoints);
    this.rebuild = { fromEvent: start.eventCount, fits: 0, fromSnapshot: true };
    this.current = snapshot.state;
    return this.current;
  }

  /**
   * Replaces the history (as an undo the undo snapshot cannot take does);
   * rebuilds from the latest checkpoint whose prefix is unchanged, leaving an
   * undo snapshot.
   */
  reset(list: EngineList): EngineState {
    this.snapshot = undefined;
    let unchanged = 0;
    if (
      sameIds(this.list.originalItemIds, list.originalItemIds) &&
      this.list.startingOrder === list.startingOrder
    ) {
      const limit = Math.min(this.events.length, list.events.length);
      while (unchanged < limit && this.events[unchanged]?.id === list.events[unchanged]?.id) unchanged++;
    }
    this.checkpoints = this.checkpoints.filter((c) => c.eventCount <= unchanged);
    this.list = list;
    this.events = [...list.events];
    const checkpoint = this.checkpoints[this.checkpoints.length - 1];
    // Evidence is append-only, so the live copy is cut back to the checkpoint's terms.
    return this.rebuildFrom(
      checkpoint
        ? restoreCheckpoint(checkpoint, this.replayer.state.evidence, this.events, list.originalItemIds)
        : initialState(list.originalItemIds, list.startingOrder),
    );
  }

  /**
   * Replays from `start` to the end of the history, fitting once more at the
   * second-last event so the last one can be undone like an append (docs/ARCHITECTURE.md 6.5
   * item 7). A start that already covers the whole history (a persisted
   * snapshot or a checkpoint) first steps back one event.
   */
  private rebuildFrom(start: ReplayState): EngineState {
    const fromEvent = start.eventCount;
    const total = this.events.length;
    const last = this.events[total - 1];
    const back = last !== undefined && fromEvent === total ? stepBack(start, this.list) : undefined;
    // The last event is processed again, and takes its checkpoint again if it is due one.
    if (back) this.checkpoints = this.checkpoints.filter((c) => c.eventCount < total);
    const replayer = new Replayer(back ?? start, this.checkpoints);
    let fit: Fit;
    let snapshot: UndoSnapshot | undefined;
    if (last === undefined || replayer.state.eventCount === total) {
      fit = replayer.fit(true);
    } else {
      replayer.advance(this.events, total - 1);
      const fitBefore = replayer.fit(true);
      const before = replayer.state;
      snapshot = {
        before: takeCheckpoint(before, this.events[total - 2]?.id),
        previousPair: before.previousPair,
        event: last,
        state: describeState(before, fitBefore),
      };
      // A stepped-back start (a persisted snapshot or a checkpoint at the end)
      // has no earlier checkpoint, and the undo snapshot goes with the next
      // append, so this one keeps undoing the last event warm after an answer
      // and its undo. The undo snapshot's copy is restored in place, so this
      // is a copy of its own.
      if (back && this.checkpoints[this.checkpoints.length - 1]?.eventCount !== total - 1) {
        this.checkpoints.push(takeCheckpoint(before, this.events[total - 2]?.id));
      }
      fit = replayer.finish(last);
      if (back && this.checkpoints[this.checkpoints.length - 1]?.eventCount !== total) {
        this.checkpoints.push(takeCheckpoint(replayer.state, last.id));
      }
    }
    this.replayer = replayer;
    this.rebuild = { fromEvent, fits: replayer.fits, fromSnapshot: false };
    this.missedSolves += replayer.nonConverged;
    this.current = describeState(replayer.state, fit);
    this.snapshot = snapshot;
    return this.current;
  }
}
