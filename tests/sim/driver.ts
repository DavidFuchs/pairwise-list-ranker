import { EngineSession, type EngineState } from '@/lib/ranking/bt/engine';
import { MIN_ITEMS_FOR_PAIR_SCALE } from '@/lib/ranking/bt/progress';
import { seededRandom, shuffled } from '@/tests/helpers/random';
import type { UserModel } from '@/tests/helpers/simUser';
import { makeBehaviour, type StrongUse } from '@/tests/sim/behaviours';
import { answersToThreshold, measure, type Measures } from '@/tests/sim/measures';
import { makeWorld, type ImportQuality, type TruthKind, type World } from '@/tests/sim/truth';
import type { RankingEvent, StartingOrder } from '@/types/rankingEvents';

/** Where a move puts an item: the item and the rows it now sits between. */
type Move = { itemId: string; aboveItemId?: string; belowItemId?: string };

/** What a scenario does besides answering questions. None of it counts as an answer. */
export interface ScenarioExtras {
  /** Share of the items marked "don't recognize", the first up front and the rest spread over the first quarter of the budget. */
  markShare?: number;
  /** A wrong move after every this many answers. */
  wrongMoveEvery?: number;
  /** Answers after each wrong move until the item is put between its true neighbours (at least 1); no correction if absent. */
  correctAfter?: number;
  /** After every `answers` answers, `count` random visible items each moved, in a row, by a placement of its own between its true neighbours. */
  multiMoveEvery?: { answers: number; count: number };
  /**
   * Every `every` answers, from the first `n`, one visible item is moved to a
   * place `near` (within 2% of the list from its true place) or `far` (more than
   * 25% of the list away), between its new neighbours, up to `count` moves. Each
   * move is recorded as a probe in the trace.
   */
  probeMoves?: { every: number; count: number; kind: 'near' | 'far' };
  /**
   * After `at` answers the user's mind changes: World.drift(share, minItems)
   * gives some items new values, and the gate is measured from then on against
   * the new truth.
   */
  drift?: { at: number; share: number; minItems: number };
}

export interface Scenario {
  name: string;
  tags?: string[];
  n: number;
  startingOrder: StartingOrder;
  truth: TruthKind;
  quality: ImportQuality;
  model: UserModel;
  strong: StrongUse;
  /** Answers the run may give (8 * n in every scenario but the probe ones, which run 8n past their last probe). */
  budgetAnswers: number;
  extras?: ScenarioExtras;
}

export interface Sample {
  answers: number;
  /** Every user action so far: answers, marks and moves. */
  changes: number;
  /** The question the last answer was given to: always a pair. */
  asked: 'pairs';
  measures: Measures;
}

/** One probe move and how far the moved item stood from its true place afterwards. */
export interface MoveProbe {
  itemId: string;
  /** Answers given when the move was made. */
  atAnswer: number;
  kind: 'near' | 'far';
  /** |shown place - true place| / shown count among the shown items, right after the move. */
  displacementAtMove: number;
  /** The same after a further 2n answers; null if the run ended first (or the item was no longer shown). */
  displacementAfter2n: number | null;
  /** The same after a further 4n answers. Absent in result files recorded before it was added. */
  displacementAfter4n?: number | null;
  /** The same after a further 8n answers. Absent in result files recorded before it was added. */
  displacementAfter8n?: number | null;
}

/** The horizons a probe is measured at, as multiples of n answers after the move, with the field each fills. */
const PROBE_HORIZONS = [
  { multiple: 2, field: 'displacementAfter2n' },
  { multiple: 4, field: 'displacementAfter4n' },
  { multiple: 8, field: 'displacementAfter8n' },
] as const;

export interface Trace {
  scenario: string;
  seed: number;
  samples: Sample[];
  /**
   * Answers until within5 first reached 0.9, or null if it never did within the budget. In a drift
   * scenario, the answers after the drift until the drift gate was met against the new truth.
   */
  answersToGate: number | null;
  probes: MoveProbe[];
  /** Probe moves the driver wanted to make but could not: no candidate place gave the displacement asked for. */
  probesSkipped: number;
  /** The answers the gate is counted from: the drift point in a drift scenario, absent (0) otherwise. */
  gateFrom?: number;
}

/** One recorded event, for tests that check what the driver did. */
export interface DriverStep {
  event: RankingEvent;
  /** The event is an answer (a pair). */
  answer: boolean;
  /** The session's state after the event. */
  state: EngineState;
  world: World;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EventBody = DistributiveOmit<RankingEvent, 'id' | 'listId' | 'createdAt'>;

/** A near probe move puts the item within this share of the list of its true place. */
const NEAR_SHARE = 0.02;
/** A far probe move puts the item more than this share of the list away. */
const FAR_SHARE = 0.25;

/** Places a probe move tries before giving up on that move. */
const PROBE_TRIES = 12;

/** The within5 share that counts as reaching the gate (docs/ARCHITECTURE.md 11). */
const GATE_WITHIN5 = 0.9;

/** Event stamps as in tests/helpers/engineCorpus.ts: ids `e<seed>-<index>`, one second apart from a fixed epoch. */
const LIST_ID = 'sim-list';
const EPOCH_MS = Date.UTC(2026, 0, 1);

/** Salts that give the user and the driver's own choices streams apart from the world's. */
const USER_SALT = 0xc2b2ae35;
const DRIVER_SALT = 0x85ebca6b;
const DRIFT_SALT = 0x27d4eb2f;

/**
 * Under this many items, the lists the engine gives exact flip chances, a drift
 * comes at 4n answers and its gate is the exact order; from it up, at 3n and
 * the usual within5 gate.
 */
export const DRIFT_EXACT_UNDER = MIN_ITEMS_FOR_PAIR_SCALE;

function stamped(seed: number, index: number, body: EventBody): RankingEvent {
  return {
    ...body,
    id: `e${seed}-${index}`,
    listId: LIST_ID,
    createdAt: new Date(EPOCH_MS + index * 1000).toISOString(),
  } as RankingEvent;
}

/**
 * The answer counts at which to sample, ascending and distinct: the k-th at
 * round(k * every), at least 1, then the budget itself if it is not already one.
 */
function samplePoints(every: number, budget: number): Set<number> {
  const points = new Set<number>();
  // An empty list has no quarter to step by.
  if (every <= 0) {
    if (budget > 0) points.add(budget);
    return points;
  }
  for (let k = 1; ; k++) {
    const at = Math.max(1, Math.round(k * every));
    if (at > budget) break;
    points.add(at);
  }
  if (budget > 0) points.add(budget);
  return points;
}

/**
 * Plays a scenario against the real engine, asking the pair it offers next
 * (pairs only), and samples the shown order every quarter of n answers. Stops
 * at the budget, or early when no pair is left to ask.
 */
export function runScenario(scenario: Scenario, seed: number, observe?: (step: DriverStep) => void): Trace {
  const { n, startingOrder, budgetAnswers } = scenario;
  const extras = scenario.extras ?? {};
  const world = makeWorld({ n, kind: scenario.truth, startingOrder, quality: scenario.quality, seed });
  const behaviour = makeBehaviour({
    model: scenario.model,
    strong: scenario.strong,
    seed: (seed ^ USER_SALT) >>> 0,
    world,
  });
  const random = seededRandom((seed ^ DRIVER_SALT) >>> 0);

  // A copy, so the import's ids stay as they were.
  const originalItemIds = [...world.ids];
  const session = new EngineSession({ originalItemIds, startingOrder, events: [] });
  const history: RankingEvent[] = [];
  let answers = 0;
  let changes = 0;

  const record = (body: EventBody, answer: boolean): void => {
    const event = stamped(seed, history.length, body);
    history.push(event);
    session.append(event);
    changes++;
    if (answer) answers++;
    observe?.({ event, answer, state: session.state, world });
  };

  /** The item put between the rows around its true place among the other shown items. */
  const betweenTrueNeighbours = (itemId: string, shown: readonly string[]): Move => {
    const others = shown.filter((id) => id !== itemId);
    const place = others.filter((id) => world.trueRank(id) < world.trueRank(itemId)).length;
    const target: Move = { itemId };
    if (place > 0) target.aboveItemId = others[place - 1] as string;
    if (place < others.length) target.belowItemId = others[place] as string;
    return target;
  };

  const marks = Math.round((extras.markShare ?? 0) * n);
  const markWindow = Math.max(1, Math.floor(budgetAnswers / 4));
  /** Mark j is made once j * markWindow / marks answers have been given. */
  const markDue = (j: number): number => Math.floor((j * markWindow) / marks);
  let nextMark = 0;
  const corrections: { at: number; itemId: string }[] = [];
  const probes: MoveProbe[] = [];
  let probesSkipped = 0;
  const pendingProbes: { probe: MoveProbe; due: number; field: (typeof PROBE_HORIZONS)[number]['field'] }[] =
    [];

  /** Places from the item's tie-aware span to the nearest end of it, over the shown count. */
  const displacement = (itemId: string, shown: readonly string[]): number => {
    const place = shown.indexOf(itemId) + 1;
    const [low, high] = world.truthOver(shown).span(itemId);
    const distance = place < low ? low - place : place > high ? place - high : 0;
    return distance / shown.length;
  };

  /** Whether an item `distance` places from its true place, in a list of `m`, is what the probe kind asks for. */
  const fits = (kind: 'near' | 'far', distance: number, m: number): boolean =>
    kind === 'far' ? distance > FAR_SHARE * m : distance <= Math.max(1, Math.floor(NEAR_SHARE * m));

  /**
   * Moves one random shown item as the probe asks. The engine places an item
   * between its new neighbours by score, which can also shift other rows, so
   * each candidate place is tried on a scratch copy of the session first and
   * the first one that really ends up as asked is made. No move if none does.
   */
  const probeMove = (kind: 'near' | 'far', at: number): void => {
    const { ranked } = session.state;
    const m = ranked.length;
    if (m < 3) {
      probesSkipped++;
      return;
    }
    const itemId = ranked[Math.floor(random() * m)] as string;
    const current = ranked.indexOf(itemId) + 1;
    const [low, high] = world.truthOver(ranked).span(itemId);
    const away = (place: number): number => (place < low ? low - place : place > high ? place - high : 0);
    const reach = kind === 'far' ? FAR_SHARE * m : Math.max(1, Math.floor(NEAR_SHARE * m));
    const candidates = Array.from({ length: m }, (_, i) => i + 1).filter((place) =>
      kind === 'far' ? away(place) > reach : place !== current && away(place) <= reach,
    );
    const others = ranked.filter((id) => id !== itemId);
    for (const place of shuffled(candidates, random).slice(0, PROBE_TRIES)) {
      const target: Move = { itemId };
      if (place > 1) target.aboveItemId = others[place - 2] as string;
      if (place <= others.length) target.belowItemId = others[place - 1] as string;
      const body: EventBody = { kind: 'placement', ...target };
      const scratch = new EngineSession({
        originalItemIds,
        startingOrder,
        events: [...history, stamped(seed, history.length, body)],
      });
      if (!fits(kind, Math.round(displacement(itemId, scratch.state.ranked) * m), m)) continue;
      record(body, false);
      const probe: MoveProbe = {
        itemId,
        atAnswer: at,
        kind,
        displacementAtMove: displacement(itemId, session.state.ranked),
        displacementAfter2n: null,
        displacementAfter4n: null,
        displacementAfter8n: null,
      };
      probes.push(probe);
      for (const { multiple, field } of PROBE_HORIZONS) {
        pendingProbes.push({ probe, due: at + multiple * n, field });
      }
      return;
    }
    probesSkipped++;
  };

  const every = (interval: number | undefined, at: number): boolean =>
    interval !== undefined && interval > 0 && at > 0 && at % interval === 0;

  /** Everything the scenario does between answers, once `at` answers have been given. */
  const actBetween = (at: number): void => {
    while (nextMark < marks && markDue(nextMark) <= at) {
      nextMark++;
      const { ranked } = session.state;
      if (ranked.length === 0) continue;
      record(
        { kind: 'unrecognized', itemIds: [ranked[Math.floor(random() * ranked.length)] as string] },
        false,
      );
    }

    for (const due of corrections.filter((c) => c.at === at)) {
      const { ranked } = session.state;
      // An item marked or removed since its wrong move is not shown, so there is nothing to correct.
      if (!ranked.includes(due.itemId)) continue;
      record({ kind: 'placement', ...betweenTrueNeighbours(due.itemId, ranked) }, false);
    }

    if (every(extras.wrongMoveEvery, at)) {
      const move = behaviour.wrongMove(session.state.ranked);
      if (move) {
        record({ kind: 'placement', ...move }, false);
        if (extras.correctAfter !== undefined) {
          corrections.push({ at: at + Math.max(1, extras.correctAfter), itemId: move.itemId });
        }
      }
    }

    const probing = extras.probeMoves;
    if (
      probing &&
      probing.every > 0 &&
      at >= n &&
      (at - n) % probing.every === 0 &&
      probes.length < probing.count
    ) {
      probeMove(probing.kind, at);
    }

    const multi = extras.multiMoveEvery;
    if (multi && every(multi.answers, at)) {
      const { ranked } = session.state;
      if (ranked.length >= 2) {
        // The items are drawn once, from the order before the first move. Each is then
        // placed against the order as the earlier moves of the group left it, so the
        // neighbours are re-read for every item rather than taken from that first order.
        const moved = shuffled(ranked, random).slice(0, Math.min(multi.count, ranked.length));
        for (const itemId of moved) {
          record({ kind: 'placement', ...betweenTrueNeighbours(itemId, session.state.ranked) }, false);
        }
      }
    }
  };

  const quarters = samplePoints(n / 4, budgetAnswers);
  const dense = Math.max(1, Math.round(n / 20));
  const samples: Sample[] = [];
  const gateSamples: { answers: number; within5: number }[] = [];
  let reached = false;

  const drift = extras.drift;
  const driftThreshold = n < DRIFT_EXACT_UNDER ? 1 : GATE_WITHIN5;
  /** The drift gate's reading: the share of pairs the right way round on a short list, within5 on a long one. */
  const driftScore = (measures: Measures): number =>
    n < DRIFT_EXACT_UNDER ? measures.kendall : measures.within5;
  const driftSamples: { answers: number; within5: number }[] = [];
  let drifted = false;
  /** Samples the drift gate after every answer from the drift until it is met. */
  const sampleDrift = (at: number): void => {
    if (!drifted || driftSamples.some((sample) => sample.within5 >= driftThreshold)) return;
    const shown = session.state.ranked;
    driftSamples.push({ answers: at, within5: driftScore(measure(shown, world.truthOver(shown))) });
  };

  actBetween(0);
  {
    // Before the first question: a list that starts at the gate reports 0 answers to it.
    const shown = session.state.ranked;
    const measures = measure(shown, world.truthOver(shown));
    samples.push({ answers: 0, changes, asked: 'pairs', measures });
    gateSamples.push({ answers: 0, within5: measures.within5 });
    reached = measures.within5 >= GATE_WITHIN5;
  }
  while (answers < budgetAnswers) {
    const next = session.state.nextPair;
    if (!next) break;
    const [left, right] = next;
    record(
      { kind: 'pair', leftItemId: left, rightItemId: right, outcome: behaviour.pair(left, right, true) },
      true,
    );

    for (const pending of pendingProbes) {
      const shown = session.state.ranked;
      if (pending.due === answers && shown.includes(pending.probe.itemId)) {
        pending.probe[pending.field] = displacement(pending.probe.itemId, shown);
      }
    }

    const quarter = quarters.has(answers);
    const forGate = !reached && (quarter || answers % dense === 0);
    if (quarter || forGate) {
      const shown = session.state.ranked;
      const measures = measure(shown, world.truthOver(shown));
      if (quarter) samples.push({ answers, changes, asked: 'pairs', measures });
      if (forGate) {
        gateSamples.push({ answers, within5: measures.within5 });
        reached = measures.within5 >= GATE_WITHIN5;
      }
    }

    sampleDrift(answers);
    if (drift && !drifted && answers === drift.at) {
      world.drift(drift.share, drift.minItems, seededRandom((seed ^ DRIFT_SALT) >>> 0));
      drifted = true;
      sampleDrift(answers);
    }

    if (answers < budgetAnswers) actBetween(answers);
  }
  // A run that ends first never measures the change of mind; counted, it would read as a slow one.
  if (drift && !drifted) {
    throw new Error(
      `${scenario.name} seed ${seed} ended after ${answers} answers, before its drift at ${drift.at}`,
    );
  }

  return {
    scenario: scenario.name,
    seed,
    samples,
    answersToGate: drift
      ? (() => {
          const at = answersToThreshold(driftSamples, driftThreshold);
          return at === null ? null : at - drift.at;
        })()
      : answersToThreshold(gateSamples, GATE_WITHIN5),
    probes,
    probesSkipped,
    ...(drift ? { gateFrom: drift.at } : {}),
  };
}
