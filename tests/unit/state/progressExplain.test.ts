import { describe, expect, it } from 'vitest';

import { replay } from '@/lib/ranking/bt/engine';
import { disorderOfState, levelOf, pairChances, type ProgressLevel } from '@/lib/ranking/bt/progress';
import { selectProgressState } from '@/lib/state/progress';
import { DOUBT, explainProgress, type Spot } from '@/lib/state/progressExplain';
import { rankedList, recorded } from '@/tests/helpers/snapshots';
import { drivenHistory } from '@/tests/helpers/engineCorpus';
import type { PairOutcome, RankingEvent, StartingOrder } from '@/types/rankingEvents';

const NOW = '2026-10-27T00:00:00.000Z';

let counter = 0;
/** `left` against `right`, from the left item's point of view. */
function ask(left: string, right: string, outcome: PairOutcome = 'left'): RankingEvent {
  counter++;
  return {
    id: `e${counter}`,
    listId: 'list',
    createdAt: NOW,
    kind: 'pair',
    leftItemId: left,
    rightItemId: right,
    outcome,
  };
}

function move(itemId: string, aboveItemId?: string, belowItemId?: string): RankingEvent {
  counter++;
  return {
    id: `e${counter}`,
    listId: 'list',
    createdAt: NOW,
    kind: 'placement',
    itemId,
    aboveItemId,
    belowItemId,
  };
}

/** The explanation the window would show for this history, read the way the rank screen reads it. */
function explain(
  ids: string[],
  events: RankingEvent[],
  startingOrder: StartingOrder = 'unordered',
  atLevel?: ProgressLevel,
) {
  const state = replay({ originalItemIds: ids, startingOrder, events });
  const list = rankedList({
    id: 'list',
    originalItemIds: ids,
    initialStartingOrder: startingOrder,
    events: recorded(events),
  });
  const disorder = disorderOfState(state);
  const progress = selectProgressState(list, state.ranked, disorder);
  const level = atLevel ?? (progress.kind === 'level' ? levelOf(progress.disorder, progress.items) : null);
  const explanation = explainProgress({
    state: progress,
    level,
    events,
    shown: state.ranked,
    evidence: state,
  });
  return { state, explanation };
}

const TRIPS = ['lisbon', 'reykjavik', 'banff', 'dubrovnik', 'cape-breton', 'amalfi'];

/** The owner's 24 answers on the trips sample, winner first (docs/engine-calibration.md, "Flip chances"). */
const TRIP_ANSWERS: [string, string][] = [
  ['reykjavik', 'lisbon'],
  ['banff', 'dubrovnik'],
  ['cape-breton', 'amalfi'],
  ['banff', 'reykjavik'],
  ['dubrovnik', 'amalfi'],
  ['cape-breton', 'dubrovnik'],
  ['lisbon', 'amalfi'],
  ['banff', 'cape-breton'],
  ['cape-breton', 'reykjavik'],
  ['reykjavik', 'dubrovnik'],
  ['lisbon', 'dubrovnik'],
  ['banff', 'lisbon'],
  ['reykjavik', 'amalfi'],
  ['banff', 'amalfi'],
  ['lisbon', 'cape-breton'],
  ['banff', 'lisbon'],
  ['banff', 'reykjavik'],
  ['banff', 'cape-breton'],
  ['dubrovnik', 'amalfi'],
  ['banff', 'dubrovnik'],
  ['banff', 'amalfi'],
  ['lisbon', 'amalfi'],
  ['reykjavik', 'amalfi'],
  ['cape-breton', 'amalfi'],
];

const answered = (pairs: [string, string][]) => pairs.map(([winner, loser]) => ask(winner, loser));

/** A spot about one pair, with the answers between them. */
type PairSpot = Extract<Spot, { above: string; answers: unknown }>;

const kinds = (spots: Spot[]) => spots.map((spot) => spot.kind);

describe('explainProgress', () => {
  it('finds the circle in the trips list after 24 answers, and calls the rest settled', () => {
    const { state, explanation } = explain(TRIPS, answered(TRIP_ANSWERS));
    expect(explanation.level).toBe(1);
    expect(kinds(explanation.spots)).toEqual(['circle']);
    const circle = explanation.spots[0] as Extract<Spot, { kind: 'circle' }>;
    // In circle order from whichever of the three is shown highest.
    const loop = ['reykjavik', 'lisbon', 'cape-breton'];
    const start = loop.indexOf(circle.items[0] as string);
    expect(circle.items).toEqual([...loop.slice(start), ...loop.slice(0, start)]);
    expect(state.ranked.indexOf(circle.items[0] as string)).toBeLessThan(
      Math.min(...circle.items.slice(1).map((id) => state.ranked.indexOf(id))),
    );
    const byWinner = Object.fromEntries(circle.answers.map((answer) => [answer.winner, answer.answer]));
    expect(byWinner).toEqual({ reykjavik: 1, 'cape-breton': 9, lisbon: 15 });
    expect(circle.chance).toBeGreaterThan(0.4);
    expect(state.nextPair?.every((id) => loop.includes(id))).toBe(true);
    expect(circle.next).toBe(true);
    expect(explanation.settled).toEqual({ first: ['banff'], middle: [], last: ['dubrovnik', 'amalfi'] });
    expect(explanation.moreSpots).toBe(0);
  });

  it('says when a pair was answered both ways', () => {
    const events = [
      ...answered([
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'c'],
      ]),
      ask('b', 'a'),
      ask('c', 'd'),
      ask('b', 'd'),
    ];
    const spot = explain(['a', 'b', 'c', 'd'], events).explanation.spots[0] as PairSpot;
    expect(spot.kind).toBe('both-ways');
    expect([spot.above, spot.below].sort()).toEqual(['a', 'b']);
    expect(spot.answers.map((answer) => answer.answer)).toEqual([1, 4]);
  });

  it('says when every answer between two was a draw', () => {
    const events = [
      ask('a', 'b', 'draw'),
      ...answered([
        ['a', 'c'],
        ['b', 'c'],
        ['c', 'd'],
      ]),
    ];
    const { explanation } = explain(['a', 'b', 'c', 'd'], events);
    const spot = explanation.spots[0] as PairSpot;
    expect(spot.kind).toBe('undecided');
    expect([spot.above, spot.below].sort()).toEqual(['a', 'b']);
    expect(spot.answers).toEqual([expect.objectContaining({ answer: 1, draw: true })]);
  });

  it('says when an item was moved and hardly asked since, and never cites what the move set aside', () => {
    const before = answered([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'e'],
    ]);
    const events = [
      ...before,
      move('e', 'a', 'b'),
      ...answered([
        ['a', 'c'],
        ['c', 'd'],
      ]),
    ];
    const { explanation } = explain(['a', 'b', 'c', 'd', 'e'], events);
    expect(kinds(explanation.spots)).toContain('moved');
    const cited = explanation.spots.flatMap((spot) =>
      'answers' in spot ? spot.answers : 'chain' in spot ? spot.chain : [],
    );
    expect(cited.filter((answer) => answer.winner === 'e' || answer.loser === 'e')).toEqual([]);
  });

  it('says when two were never compared directly, and gives no chain when none links them', () => {
    // a and b each beat c, so either could be first.
    const events = answered([
      ['a', 'c'],
      ['b', 'c'],
      ['c', 'd'],
    ]);
    const { explanation } = explain(['a', 'b', 'c', 'd'], events);
    expect(explanation.spots[0]).toEqual(
      expect.objectContaining({ kind: 'inferred', above: 'a', below: 'b', chain: [] }),
    );
    expect(explanation.spots[0]?.chance).toBeGreaterThan(0.4);
  });

  it('says when a pair rests on one answer', () => {
    // x is over both and y under both, so a and b are close, with one answer between them.
    const events = answered([
      ['a', 'b'],
      ['x', 'a'],
      ['x', 'b'],
      ['a', 'y'],
      ['b', 'y'],
    ]);
    // Read below the top level, which mentions a spot only past 10%.
    const { explanation } = explain(['a', 'b', 'x', 'y'], events, 'unordered', 1);
    expect(explanation.spots[0]).toEqual(
      expect.objectContaining({
        kind: 'one-answer',
        above: 'a',
        below: 'b',
        answers: [expect.objectContaining({ answer: 1 })],
      }),
    );
  });

  it('counts a pair with one clear answer and a draw as resting on one answer', () => {
    const events = [
      ask('a', 'b'),
      ask('a', 'b', 'draw'),
      ...answered([
        ['x', 'a'],
        ['x', 'b'],
        ['a', 'y'],
        ['b', 'y'],
      ]),
    ];
    const spot = explain(['a', 'b', 'x', 'y'], events).explanation.spots[0] as PairSpot;
    expect(spot.kind).toBe('one-answer');
    expect(spot.answers.map((answer) => [answer.answer, answer.draw])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it('follows a circle of four in order, each answer from one item to the next', () => {
    const events = answered([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'a'],
      ['x', 'a'],
      ['x', 'b'],
      ['x', 'c'],
      ['x', 'd'],
    ]);
    const { explanation } = explain(['a', 'b', 'c', 'd', 'x'], events);
    expect(kinds(explanation.spots)).toEqual(['circle']);
    const circle = explanation.spots[0] as Extract<Spot, { kind: 'circle' }>;
    expect(circle.items).toHaveLength(4);
    circle.answers.forEach((answer, k) => {
      expect(answer.winner).toBe(circle.items[k]);
      expect(answer.loser).toBe(circle.items[(k + 1) % circle.items.length]);
    });
  });

  it('puts every pair that circles through a known circle with it, whatever its chance', () => {
    // a, b and c go in a circle, and so do a, b and d; c and d are a toss-up only because of them.
    const events = answered([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'],
      ['b', 'd'],
      ['d', 'a'],
    ]);
    const { explanation } = explain(['a', 'b', 'c', 'd'], events);
    expect(kinds(explanation.spots)).toEqual(['circle']);
    expect(explanation.spots[0]?.chance).toBeGreaterThan(0.45);
    expect(explanation.moreSpots).toBe(0);
    expect(explanation.doubtful).toBe(0);
  });

  it('at the top level gives the spot with the likeliest pair, not the heaviest', () => {
    // The circle's pairs add up to more, but x and y are a closer call than any of them.
    const events = answered([
      ['a', 'b'],
      ['a', 'b'],
      ['b', 'c'],
      ['b', 'c'],
      ['c', 'a'],
      ['x', 'z'],
      ['y', 'z'],
    ]);
    const ids = ['a', 'b', 'c', 'x', 'y', 'z'];
    expect(kinds(explain(ids, events).explanation.spots)[0]).toBe('circle');
    const { explanation } = explain(ids, events, 'unordered', 3);
    expect(explanation.spots).toEqual([
      expect.objectContaining({ kind: 'inferred', above: 'x', below: 'y' }),
    ]);
    expect(explanation.moreSpots).toBe(0);
    expect(explanation.doubtful).toBe(0);
  });

  it('lists the items not yet compared while comparing, with no spots', () => {
    const { explanation } = explain(['a', 'b', 'c', 'd'], [ask('a', 'b')]);
    expect(explanation.state.kind).toBe('comparing');
    expect([...explanation.uncompared].sort()).toEqual(['c', 'd']);
    expect(explanation.spots).toEqual([]);
  });

  it('shows no spot at the top level when nothing is over 10%', () => {
    const ids = ['a', 'b', 'c'];
    const events = answered(
      Array.from({ length: 6 }, () => [
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'c'],
      ]).flat() as [string, string][],
    );
    const { explanation } = explain(ids, events);
    expect(explanation.level).toBe(3);
    expect(explanation.spots).toEqual([]);
  });

  it('leaves out an item marked unrecognized', () => {
    const events: RankingEvent[] = [
      ...answered([
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
        ['a', 'd'],
      ]),
      { id: 'u1', listId: 'list', createdAt: NOW, kind: 'unrecognized', itemIds: ['d'] },
    ];
    const { explanation } = explain(['a', 'b', 'c', 'd'], events);
    expect(JSON.stringify(explanation)).not.toContain('"d"');
  });

  it('gives at most three spots and counts the rest on a long list, quickly', () => {
    const history = drivenHistory({ n: 300, events: 1500, seed: 3, user: 'typical' });
    const state = replay(history);
    const list = rankedList({
      id: 'list',
      originalItemIds: [...history.originalItemIds],
      events: recorded(history.events),
    });
    const progress = selectProgressState(list, state.ranked, disorderOfState(state));
    expect(progress.kind).toBe('level');
    const started = performance.now();
    const explanation = explainProgress({
      state: progress,
      level: progress.kind === 'level' ? levelOf(progress.disorder, progress.items) : null,
      events: history.events,
      shown: state.ranked,
      evidence: state,
    });
    expect(performance.now() - started).toBeLessThan(200);
    expect(explanation.spots.length).toBe(3);
    expect(explanation.moreSpots).toBeGreaterThan(0);
    expect(explanation.settled).toBeNull();
  });

  it('looks for causes only among the likeliest pairs early on a long list, and counts each pair once', () => {
    // Early on, a thousand items leave hundreds of thousands of pairs in doubt.
    const history = drivenHistory({ n: 1000, events: 1200, seed: 3, user: 'typical' });
    const state = replay(history);
    const inDoubt = (pairChances(state) ?? []).filter((pair) => pair.chance >= DOUBT).length;
    expect(inDoubt).toBeGreaterThan(100_000);
    const started = performance.now();
    const explanation = explainProgress({
      state: { kind: 'level', disorder: 0.2, items: 1000 },
      level: 0,
      events: history.events,
      shown: state.ranked,
      evidence: state,
    });
    expect(performance.now() - started).toBeLessThan(1500);
    expect(explanation.spots.length).toBe(3);
    // Each pair in doubt is in a spot, given or not, or counted on its own, never both.
    const spots = explanation.spots.length + explanation.moreSpots;
    expect(explanation.doubtful).toBeLessThanOrEqual(inDoubt - spots);
    expect(explanation.doubtful).toBeGreaterThanOrEqual(inDoubt - 200);
  });
});
