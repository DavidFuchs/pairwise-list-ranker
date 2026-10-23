import { BAND_WIDTH } from '@/lib/ranking/bt/constants';
import { EngineSession } from '@/lib/ranking/bt/engine';
import { seededRandom, shuffled } from '@/tests/helpers/random';
import { gaussian, makeUser, type UserModel } from '@/tests/helpers/simUser';
import type { EngineList, PairOutcome, RankingEvent, StartingOrder } from '@/types/rankingEvents';

export interface CorpusHistory {
  name: string;
  list: EngineList;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EventBody = DistributiveOmit<RankingEvent, 'id' | 'listId' | 'createdAt'>;

const LIST_ID = 'sim-list';
const EPOCH_MS = Date.UTC(2026, 0, 1);

/** Fully determined by (seed, index): ids `e<seed>-<index>`, one second apart from a fixed epoch. */
function stamped(seed: number, index: number, body: EventBody): RankingEvent {
  return {
    ...body,
    id: `e${seed}-${index}`,
    listId: LIST_ID,
    createdAt: new Date(EPOCH_MS + index * 1000).toISOString(),
  } as RankingEvent;
}

function itemIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `i${i}`);
}

function pickIndex(random: () => number, length: number): number {
  return Math.floor(random() * length);
}

export interface DrivenView {
  session: EngineSession;
  /** The history as it stands, with the surviving events. */
  list: EngineList;
  undid: boolean;
  /** The step dragged a currently unrecognized item back into the list. */
  draggedBack: boolean;
}

type DrivenKind = 'draw' | 'placement' | 'unrecognized' | 'removal' | 'undo';

const DEFAULT_MIX: Record<DrivenKind, number> = {
  draw: 0.05,
  placement: 0.05,
  unrecognized: 0.03,
  removal: 0.03,
  undo: 0.04,
};

/**
 * Drives an EngineSession with a simulated user, so the history holds the
 * questions the picker really asks: pairs, draws, placements,
 * unrecognized marks, removals and undos, mixed by seed. `events` is
 * the number of steps taken (an undo takes one and removes one event).
 */
export function drivenHistory(options: {
  n: number;
  events: number;
  seed: number;
  user: UserModel;
  startingOrder?: StartingOrder;
  mix?: Partial<Record<DrivenKind, number>>;
  /** Called after every step with the live session and the surviving events, so a test can check the driven session itself. */
  observe?: (view: DrivenView) => void;
}): EngineList {
  const { n, events: steps, seed, user: model, startingOrder = 'unordered' } = options;
  const mix = { ...DEFAULT_MIX, ...options.mix };
  const random = seededRandom(seed);

  // Item `i<k>` is the k-th in the import; its true rank follows the starting order's quality.
  const ids = itemIds(n);
  const trueRanks = new Map<string, number>();
  if (startingOrder === 'unordered') {
    shuffled(ids, random).forEach((id, rank) => trueRanks.set(id, rank));
  } else {
    const noise = startingOrder === 'ranked' ? 0.02 : 0.15;
    ids
      .map((id, position) => ({ id, key: position + gaussian(random) * noise * n }))
      .sort((a, b) => a.key - b.key)
      .forEach(({ id }, rank) => trueRanks.set(id, rank));
  }
  const trueRank = (id: string): number => trueRanks.get(id) ?? n / 2;
  const simUser = makeUser(model, seed * 7919 + 13, trueRank, n);

  const base: EngineList = { originalItemIds: ids, startingOrder, events: [] };
  const session = new EngineSession(base);
  const history: RankingEvent[] = [];
  let counter = 0;
  const record = (body: EventBody): void => {
    const event = stamped(seed, counter++, body);
    history.push(event);
    session.append(event);
  };

  const dropPlacement = (): boolean => {
    const { ranked, unrecognized } = session.state;
    // Sometimes drag a marked item back, else a visible item far from its true place.
    const fromMarked = unrecognized.length > 0 && random() < 0.2;
    const pool = fromMarked ? unrecognized : ranked;
    const farEnough = Math.max(2, Math.ceil(0.1 * ranked.length));
    for (let attempt = 0; attempt < 12; attempt++) {
      const itemId = pool[pickIndex(random, pool.length)];
      if (itemId === undefined) return false;
      const others = ranked.filter((id) => id !== itemId);
      const target = others.filter((id) => trueRank(id) < trueRank(itemId)).length;
      const shownAt = fromMarked ? -farEnough : ranked.indexOf(itemId);
      if (Math.abs(shownAt - target) < farEnough) continue;
      draggedBack = fromMarked;
      record({ kind: 'placement', itemId, aboveItemId: others[target - 1], belowItemId: others[target] });
      return true;
    }
    return false;
  };

  const kinds = Object.keys(mix) as DrivenKind[];
  let undid = false;
  let draggedBack = false;
  const takeStep = (): void => {
    const roll = random();
    let kind: DrivenKind | 'pair' = 'pair';
    let edge = 0;
    for (const candidate of kinds) {
      edge += mix[candidate];
      if (roll < edge) {
        kind = candidate;
        break;
      }
    }
    const state = session.state;
    const visible = state.ranked.length;
    const someVisible = (): string => state.ranked[pickIndex(random, visible)] as string;
    if (kind === 'undo') {
      if (history.length > 0) {
        history.pop();
        session.undo();
        undid = true;
      }
      return;
    }
    if (kind === 'placement' && dropPlacement()) return;
    if (kind === 'unrecognized' && visible > 6) {
      record({ kind: 'unrecognized', itemIds: [someVisible()] });
      return;
    }
    if (kind === 'removal' && visible > 6) {
      record({ kind: 'removal', itemIds: [someVisible()] });
      return;
    }
    if (state.nextPair) {
      const [left, right] = state.nextPair;
      const outcome = simUser.pair(left, right, { allowDraw: kind === 'draw' });
      record({ kind: 'pair', leftItemId: left, rightItemId: right, outcome });
    }
  };
  for (let step = 0; step < steps; step++) {
    undid = false;
    draggedBack = false;
    takeStep();
    options.observe?.({ session, list: { ...base, events: history }, undid, draggedBack });
  }
  return { ...base, events: history };
}

/** Where to put `count` events in [from, to): distinct, seeded, ascending. */
function positionsIn(random: () => number, count: number, from: number, to: number): number[] {
  const range = Array.from({ length: to - from }, (_, i) => from + i);
  return shuffled(range, random)
    .slice(0, count)
    .sort((a, b) => a - b);
}

const CORPUS_ITEMS = 1000;
const CORPUS_EVENTS = 10000;

type CorpusKind = 'pair' | 'placement' | 'unrecognized';

/**
 * One benchmark-sized history without the engine: the questions are chosen by
 * true rank (near neighbours, with some spread), not by the picker, so
 * generating it is cheap. `kinds` says what each event index is.
 */
function generate(
  name: string,
  seed: number,
  startingOrder: StartingOrder,
  kinds: CorpusKind[],
): CorpusHistory {
  const random = seededRandom(seed);
  const ids = itemIds(CORPUS_ITEMS);
  const rank = new Map<string, number>();
  if (startingOrder === 'ranked') {
    ids
      .map((id, position) => ({ id, key: position + gaussian(random) * 0.02 * CORPUS_ITEMS }))
      .sort((a, b) => a.key - b.key)
      .forEach(({ id }, r) => rank.set(id, r));
  } else {
    shuffled(ids, random).forEach((id, r) => rank.set(id, r));
  }
  const rankOf = (id: string): number => rank.get(id) as number;
  // Visible items, best true rank first.
  let visible = [...ids].sort((a, b) => rankOf(a) - rankOf(b));
  const events: RankingEvent[] = [];

  const pair = (): EventBody => {
    const at = pickIndex(random, visible.length);
    const spread = 1 + Math.floor(-Math.log(1 - random()) * 6);
    let other = random() < 0.5 ? at + spread : at - spread;
    if (other < 0 || other >= visible.length)
      other = at + spread < visible.length ? at + spread : at - spread;
    other = Math.max(0, Math.min(visible.length - 1, other));
    const a = visible[at] as string;
    const b = visible[other] as string;
    const [left, right] = random() < 0.5 ? [a, b] : [b, a];
    const leftBetter = rankOf(left) < rankOf(right);
    const strong = Math.abs(rankOf(left) - rankOf(right)) > 0.3 * CORPUS_ITEMS;
    let outcome: PairOutcome = leftBetter ? 'left' : 'right';
    if (strong) outcome = leftBetter ? 'left_strong' : 'right_strong';
    else if (Math.abs(at - other) === 1 && random() < 0.1) outcome = 'draw';
    return { kind: 'pair', leftItemId: left, rightItemId: right, outcome };
  };

  kinds.forEach((kind, index) => {
    let body: EventBody;
    if (kind === 'placement') {
      // Dropped between the items adjacent to its true rank among the others.
      const at = pickIndex(random, visible.length);
      body = {
        kind: 'placement',
        itemId: visible[at] as string,
        aboveItemId: visible[at - 1],
        belowItemId: visible[at + 1],
      };
    } else if (kind === 'unrecognized') {
      const at = pickIndex(random, visible.length);
      body = { kind: 'unrecognized', itemIds: [visible[at] as string] };
      visible = visible.filter((_, i) => i !== at);
    } else {
      body = pair();
    }
    events.push(stamped(seed, index, body));
  });
  return { name, list: { originalItemIds: ids, startingOrder, events } };
}

function planOf(fill: CorpusKind, specials: [CorpusKind, number[]][]): CorpusKind[] {
  const kinds = Array.from({ length: CORPUS_EVENTS }, () => fill);
  for (const [kind, positions] of specials) for (const position of positions) kinds[position] = kind;
  return kinds;
}

/** Benchmark-sized histories (1,000 items, 10,000 events) generated cheaply. */
export function benchmarkCorpus(): CorpusHistory[] {
  const random = seededRandom(20261017);
  const third = Math.floor(CORPUS_EVENTS / 3);
  const placementsIn = (from: number, to: number): [CorpusKind, number[]][] => [
    ['placement', positionsIn(random, 200, from, to)],
  ];
  // The draws that shuffled the events of the history pairs-heavy replaced, so
  // the placements and marks below fall where they did before it.
  shuffled(Array.from({ length: CORPUS_EVENTS }), random);
  return [
    generate('pairs', 1, 'unordered', planOf('pair', [])),
    generate('placements-early', 2, 'unordered', planOf('pair', placementsIn(0, third))),
    generate('placements-middle', 3, 'unordered', planOf('pair', placementsIn(third, 2 * third))),
    generate('placements-late', 4, 'unordered', planOf('pair', placementsIn(2 * third, CORPUS_EVENTS))),
    generate(
      'unrecognized-heavy',
      5,
      'unordered',
      planOf('pair', [['unrecognized', positionsIn(random, 150, 200, CORPUS_EVENTS)]]),
    ),
    // As many events as the others, all answers: the largest evidence set the corpus holds.
    generate('pairs-heavy', 6, 'unordered', planOf('pair', [])),
    generate('ranked-import', 7, 'ranked', planOf('pair', [])),
    // 1% placements, one in every hundred events: the realistic case the cold budget is gated on.
    generate(
      'placements-realistic',
      9,
      'unordered',
      planOf('pair', [['placement', Array.from({ length: 100 }, (_, i) => i * 100 + 50)]]),
    ),
  ];
}

/** Distance from a strength to the nearest band boundary (a half-integer multiple of BAND_WIDTH). */
function boundaryDistance(strength: number): number {
  const scaled = strength / BAND_WIDTH;
  return Math.abs(scaled - Math.floor(scaled) - 0.5) * BAND_WIDTH;
}

/**
 * Small random histories, cut at the first event after which some fitted
 * strength is within `closeness` of a band boundary. Deterministic: the
 * search is seeded, so the same histories come out every time.
 */
function nearBoundaryHistories(count: number, closeness: number, maxTrials: number): CorpusHistory[] {
  const found: CorpusHistory[] = [];
  const outcomes: PairOutcome[] = ['left', 'right', 'left_strong', 'right_strong', 'draw'];
  for (let trial = 0; trial < maxTrials && found.length < count; trial++) {
    const random = seededRandom(900000 + trial);
    const originalItemIds = itemIds(3 + (trial % 5));
    const startingOrder: StartingOrder = 'unordered';
    const session = new EngineSession({ originalItemIds, startingOrder, events: [] });
    const events: RankingEvent[] = [];
    for (let index = 0; index < 6; index++) {
      const { ranked } = session.state;
      let body: EventBody;
      if (random() < 0.65) {
        const [a, b] = shuffled(ranked, random);
        const outcome = outcomes[pickIndex(random, outcomes.length)] as PairOutcome;
        body = { kind: 'pair', leftItemId: a as string, rightItemId: b as string, outcome };
      } else {
        const itemId = ranked[pickIndex(random, ranked.length)] as string;
        const others = ranked.filter((id) => id !== itemId);
        const at = pickIndex(random, others.length + 1);
        body = { kind: 'placement', itemId, aboveItemId: others[at - 1], belowItemId: others[at] };
      }
      const event = stamped(trial, index, body);
      events.push(event);
      const { strengths } = session.append(event);
      if ([...strengths.values()].some((s) => boundaryDistance(s) < closeness)) {
        const name = `near-boundary-${found.length}`;
        found.push({ name, list: { originalItemIds, startingOrder, events: [...events] } });
        break;
      }
    }
  }
  return found;
}

/** Histories whose fitted strengths sit exactly on, or within a few solver tolerances of, a band boundary. */
export function gridBoundaryHistories(): CorpusHistory[] {
  const originals = itemIds(8);
  const build = (
    name: string,
    bodies: EventBody[],
    startingOrder: StartingOrder = 'unordered',
  ): CorpusHistory => ({
    name,
    list: {
      originalItemIds: originals,
      startingOrder,
      events: bodies.map((body, index) => stamped(0, index, body)),
    },
  });
  const place = (itemId: string, aboveItemId?: string, belowItemId?: string): EventBody => ({
    kind: 'placement',
    itemId,
    aboveItemId,
    belowItemId,
  });
  const pair = (leftItemId: string, rightItemId: string, outcome: PairOutcome = 'left'): EventBody => ({
    kind: 'pair',
    leftItemId,
    rightItemId,
    outcome,
  });
  const exact: CorpusHistory[] = [
    // Evidence-free: every strength exactly 0, one tied band.
    build('evidence-free', []),
    // Placements only, into a region that is one tied band, repeatedly.
    build('tied-placements', [
      place('i7', 'i1', 'i2'),
      place('i6', 'i1', 'i7'),
      place('i5', 'i0'),
      place('i4', undefined, 'i0'),
      place('i3', 'i6', 'i7'),
    ]),
    build('tied-placements-reversed-rows', [
      place('i7', 'i2', 'i1'),
      place('i7', 'i3', 'i4'),
      place('i6', 'i3', 'i4'),
    ]),
    // A pair gives strengths symmetric about zero; a placement between them sits at zero up to rounding, of either sign.
    build('symmetric-pair-midpoints', [
      pair('i0', 'i1'),
      place('i2', 'i0', 'i1'),
      place('i3', 'i0', 'i1'),
      pair('i4', 'i5', 'right'),
      place('i6', 'i5', 'i4'),
    ]),
    build('two-symmetric-pairs', [
      pair('i0', 'i1'),
      pair('i2', 'i3', 'right'),
      pair('i0', 'i1'),
      place('i4', 'i0', 'i1'),
      place('i5', 'i3', 'i2'),
    ]),
    build(
      'ranked-midpoints',
      [place('i3', 'i1', 'i2'), place('i4', 'i3', 'i2'), place('i5', 'i3', 'i4')],
      'ranked',
    ),
    build('draws-around-zero', [
      pair('i0', 'i1', 'draw'),
      pair('i1', 'i2', 'draw'),
      place('i3', 'i0', 'i2'),
      pair('i3', 'i0', 'draw'),
    ]),
  ];
  return [...exact, ...nearBoundaryHistories(6, 5e-10, 4000)];
}
