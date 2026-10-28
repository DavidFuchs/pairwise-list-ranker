import { describe, expect, it, vi } from 'vitest';

import { EngineSession, type EngineState, replay, replayWithStats } from '@/lib/ranking/bt/engine';
import { drivenHistory, gridBoundaryHistories } from '@/tests/helpers/engineCorpus';
import { seededRandom, shuffled } from '@/tests/helpers/random';
import type { UserModel } from '@/tests/helpers/simUser';
import type { EngineList, RankingEvent, StartingOrder } from '@/types/rankingEvents';

// The rule that later answers discount earlier ones is on, so every history here also checks it.
vi.mock('@/lib/ranking/bt/constants', async (original) => ({
  ...(await original<typeof import('@/lib/ranking/bt/constants')>()),
  RECENCY_FACTOR: 0.5,
}));

const USERS: UserModel[] = ['careful', 'typical', 'fuzzy', 'sloppy'];
const STARTS: StartingOrder[] = ['unordered', 'unordered', 'rough', 'ranked'];

function visible(state: EngineState): Pick<EngineState, 'ranked' | 'nextPair'> {
  return { ranked: state.ranked, nextPair: state.nextPair };
}

/**
 * Feeds the history to a fresh session one event at a time and compares it
 * with a cold replay of the same prefix, every `every` events and at the end.
 */
function expectWarmMatchesReplay(list: EngineList, every: number): void {
  const session = new EngineSession({ ...list, events: [] });
  list.events.forEach((event, index) => {
    session.append(event);
    const count = index + 1;
    if (count % every === 0 || count === list.events.length) {
      const prefix = { ...list, events: list.events.slice(0, count) };
      expect(visible(session.state), `after ${count} events`).toEqual(visible(replay(prefix)));
    }
  });
}

/** Histories are checked in blocks of seeds so each `it` stays well inside CI's time limit, even under coverage. */
const BLOCK = 25;
const SEEDS = 200;
const MOVE_SEEDS = 50;
const BLOCK_TIMEOUT = 300_000;

const seen = {
  kinds: { pair: 0, placement: 0, unrecognized: 0, removal: 0 },
  strongAnswers: 0,
  removals: 0,
  undos: 0,
  dragBacks: 0,
  histories: 0,
  startingOrders: new Set<StartingOrder>(),
  drawsByUser: new Map<UserModel, number>(),
};

function checkSeed(seed: number, mix?: Parameters<typeof drivenHistory>[0]['mix']): void {
  const user = USERS[seed % 4] as UserModel;
  const startingOrder = STARTS[seed % 4] as StartingOrder;
  let steps = 0;
  try {
    // The driven session is the warm path with real undos: it must match a
    // cold replay of the events that survived, just after each undo and at samples.
    const list = drivenHistory({
      n: 8 + ((seed * 7) % 53),
      events: 50 + ((seed * 37) % 351),
      seed,
      user,
      startingOrder,
      mix,
      observe: ({ session, list: current, undid, draggedBack }) => {
        steps++;
        if (undid) seen.undos++;
        if (draggedBack) seen.dragBacks++;
        if (undid || steps % 25 === 0) {
          const cold = replayWithStats(current);
          expect(cold.nonConverged, 'cold replay solves that missed the test').toBe(0);
          expect(visible(session.state), `driven session at step ${steps}`).toEqual(visible(cold.state));
        }
        expect(session.nonConverged, 'driven session solves that missed the test').toBe(0);
      },
    });
    expectWarmMatchesReplay(list, 25);
    seen.histories++;
    seen.startingOrders.add(startingOrder);
    for (const event of list.events) {
      seen.kinds[event.kind]++;
      if (event.kind === 'removal') {
        seen.removals += event.itemIds.length;
      } else if (event.kind === 'pair' && event.outcome === 'draw') {
        seen.drawsByUser.set(user, (seen.drawsByUser.get(user) ?? 0) + 1);
      } else if (event.kind === 'pair' && event.outcome.endsWith('_strong')) {
        seen.strongAnswers++;
      }
    }
  } catch (error) {
    throw new Error(`seed ${seed}: ${(error as Error).message}`);
  }
}

describe('warm path against fresh replay (docs/ARCHITECTURE.md 6.6)', () => {
  for (let first = 1; first <= SEEDS; first += BLOCK) {
    const last = first + BLOCK - 1;
    it(
      `warm path and fresh replay agree on driven histories, seeds ${first} to ${last}`,
      () => {
        for (let seed = first; seed <= last; seed++) checkSeed(seed);
      },
      BLOCK_TIMEOUT,
    );
  }

  // Histories with plenty of moves, each placing one item (docs/ARCHITECTURE.md 6.8).
  for (let first = 1; first <= MOVE_SEEDS; first += BLOCK) {
    const last = first + BLOCK - 1;
    it(
      `warm path and fresh replay agree on histories with many moves, seeds ${first} to ${last}`,
      () => {
        for (let seed = 1000 + first; seed <= 1000 + last; seed++) checkSeed(seed, { placement: 0.15 });
      },
      BLOCK_TIMEOUT,
    );
  }

  it('the driven histories were varied enough for the property to mean something', () => {
    expect(seen.histories).toBe(SEEDS + MOVE_SEEDS);
    for (const [kind, count] of Object.entries(seen.kinds)) expect(count, kind).toBeGreaterThan(0);
    expect(seen.strongAnswers).toBeGreaterThan(0);
    expect(seen.removals).toBeGreaterThan(0);
    expect(seen.undos).toBeGreaterThan(0);
    expect(seen.dragBacks).toBeGreaterThan(0);
    expect(seen.startingOrders).toEqual(new Set(STARTS));
    // A careful user draws only on a pair closer than its tiny noise, which the
    // picker, asking the pairs most likely out of order, almost never offers.
    for (const user of USERS.filter((u) => u !== 'careful')) {
      expect(seen.drawsByUser.get(user), `draws by ${user}`).toBeGreaterThan(0);
    }
  });

  it('warm path and fresh replay agree on histories at the strength grid lines', () => {
    const histories = gridBoundaryHistories();
    expect(histories.length).toBeGreaterThan(10);
    for (const { name, list } of histories) {
      try {
        expectWarmMatchesReplay(list, 1);
      } catch (error) {
        throw new Error(`${name}: ${(error as Error).message}`);
      }
    }
  });
});

describe('arrival sequence (docs/ARCHITECTURE.md 6.9)', () => {
  it('shuffling an input array that is not the arrival sequence changes nothing', () => {
    const driven = drivenHistory({ n: 30, events: 120, seed: 5, user: 'typical' });
    const state = replay(driven);
    const gone = state.ranked.slice(0, 6);
    const events = [
      ...driven.events,
      {
        id: 'cut',
        listId: 'sim-list',
        createdAt: '2027-01-01T00:00:00.000Z',
        kind: 'removal' as const,
        itemIds: gone,
      },
      {
        id: 'marks',
        listId: 'sim-list',
        createdAt: '2027-01-01T00:00:01.000Z',
        kind: 'unrecognized' as const,
        itemIds: state.ranked.slice(6, 9),
      },
    ];
    const random = seededRandom(99);
    const shuffledEvents = events.map((event) =>
      event.kind === 'removal' ? { ...event, itemIds: shuffled(event.itemIds, random) } : event,
    );
    const before = replay({ ...driven, events });
    const after = replay({ ...driven, events: shuffledEvents });
    expect(after).toEqual(before);
    expect(before.ranked).not.toEqual(state.ranked);
  });
});

describe('later answers discounting earlier ones (docs/ARCHITECTURE.md 6.1)', () => {
  const ids = ['lisbon', 'reykjavik', 'banff', 'dubrovnik', 'cape-breton', 'amalfi'];
  let counter = 0;
  const ask = (winner: string, loser: string): RankingEvent => ({
    id: `e${++counter}`,
    listId: 'list',
    createdAt: '2026-10-27T00:00:00.000Z',
    kind: 'pair',
    leftItemId: winner,
    rightItemId: loser,
    outcome: 'left',
  });
  const place = (itemId: string, aboveItemId: string, belowItemId: string): RankingEvent => ({
    id: `e${++counter}`,
    listId: 'list',
    createdAt: '2026-10-27T00:00:00.000Z',
    kind: 'placement',
    itemId,
    aboveItemId,
    belowItemId,
  });
  const events = [
    ask('banff', 'cape-breton'),
    ask('lisbon', 'amalfi'),
    ask('dubrovnik', 'reykjavik'),
    ask('amalfi', 'lisbon'),
    ask('cape-breton', 'dubrovnik'),
    ask('amalfi', 'lisbon'),
    ask('reykjavik', 'lisbon'),
    ask('lisbon', 'amalfi'),
    ask('lisbon', 'amalfi'),
    ask('lisbon', 'amalfi'),
  ];
  const list: EngineList = { originalItemIds: ids, startingOrder: 'unordered', events };

  const strengths = (state: EngineState): number[] =>
    ids.map((id) => state.fit?.strengths[state.slots?.get(id) as number] as number);

  it('warm path, cold replay and undo agree when later answers discount earlier ones', () => {
    const session = new EngineSession({ ...list, events: [] });
    for (const event of events) session.append(event);
    const cold = replay(list);
    expect(visible(session.state)).toEqual(visible(cold));
    strengths(session.state).forEach((s, i) => expect(s).toBeCloseTo(strengths(cold)[i] as number, 6));

    // Undoing the last three Lisbon answers puts the two Amalfi Coast answers back to full weight.
    for (let k = 0; k < 3; k++) session.undo();
    const earlier = replay({ ...list, events: events.slice(0, -3) });
    expect(visible(session.state)).toEqual(visible(earlier));
    strengths(session.state).forEach((s, i) => expect(s).toBeCloseTo(strengths(earlier)[i] as number, 6));
    expect(session.state.fit?.pairs.some((term) => term.discounted)).toBe(
      earlier.fit?.pairs.some((term) => term.discounted),
    );
  });

  it('warm path, cold replay and undo agree while a pair answered both ways is open', () => {
    // Reykjavík and Dubrovnik go Reykjavík, Dubrovnik, Reykjavík (open), then Reykjavík (a run of two).
    // The placement forces a checkpoint, so the restore path is covered too.
    const split = [
      ask('banff', 'cape-breton'),
      ask('reykjavik', 'dubrovnik'),
      ask('lisbon', 'amalfi'),
      ask('dubrovnik', 'reykjavik'),
      ask('cape-breton', 'lisbon'),
      ask('reykjavik', 'dubrovnik'),
      place('banff', 'lisbon', 'amalfi'),
      ask('banff', 'amalfi'),
      ask('reykjavik', 'dubrovnik'),
    ];
    const splitList: EngineList = { originalItemIds: ids, startingOrder: 'unordered', events: split };
    const session = new EngineSession({ ...splitList, events: [] });
    for (const event of split) session.append(event);
    expect(visible(session.state)).toEqual(visible(replay(splitList)));

    session.undo();
    const shorter = replay({ ...splitList, events: split.slice(0, -1) });
    expect(visible(session.state)).toEqual(visible(shorter));
    expect(session.state.nextPair).toEqual(shorter.nextPair);
  });
});
