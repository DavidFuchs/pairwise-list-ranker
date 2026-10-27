import { describe, expect, it, vi } from 'vitest';

import { EngineSession, type EngineState, replay, replayWithStats } from '@/lib/ranking/bt/engine';
import { Evidence } from '@/lib/ranking/bt/evidence';
import { hessianDiagonal, type Problem } from '@/lib/ranking/bt/objective';
import { seedPrior } from '@/lib/ranking/bt/priors';
import type * as Solver from '@/lib/ranking/bt/solver';
import { Timeline } from '@/lib/ranking/bt/timeline';
import { seededRandom, shuffled } from '@/tests/helpers/random';
import type { EngineList, PairOutcome, RankingEvent, StartingOrder } from '@/types/rankingEvents';

/** Solves still to report as missed, so a test can make the engine count one. */
const forcedMisses = vi.hoisted(() => ({ remaining: 0 }));

vi.mock('@/lib/ranking/bt/solver', async (importOriginal) => {
  const actual = await importOriginal<typeof Solver>();
  const solve: typeof actual.solve = (...args) => {
    const result = actual.solve(...args);
    if (forcedMisses.remaining === 0) return result;
    forcedMisses.remaining--;
    return { ...result, converged: false };
  };
  return { ...actual, solve };
});

const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };
let nextId = 0;
const id = (): string => `e${nextId++}`;

function pair(left: string, right: string, outcome: PairOutcome = 'left'): RankingEvent {
  return { ...base, id: id(), kind: 'pair', leftItemId: left, rightItemId: right, outcome };
}

function place(itemId: string, above?: string, below?: string): RankingEvent {
  return { ...base, id: id(), kind: 'placement', itemId, aboveItemId: above, belowItemId: below };
}

function unrecognized(...itemIds: string[]): RankingEvent {
  return { ...base, id: id(), kind: 'unrecognized', itemIds };
}

function removal(...itemIds: string[]): RankingEvent {
  return { ...base, id: id(), kind: 'removal', itemIds };
}

function items(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `i${i}`);
}

function list(
  originalItemIds: string[],
  events: RankingEvent[] = [],
  startingOrder: StartingOrder = 'unordered',
): EngineList {
  return { originalItemIds, startingOrder, events };
}

function strength(state: EngineState, item: string): number {
  const s = state.strengths.get(item);
  if (s === undefined) throw new Error(`no strength for ${item}`);
  return s;
}

/** Same displayed order and questions, strengths within 1e-9. */
function expectSameState(actual: EngineState, expected: EngineState): void {
  expect(actual.ranked).toEqual(expected.ranked);
  expect(actual.unrecognized).toEqual(expected.unrecognized);
  expect(actual.nextPair).toEqual(expected.nextPair);
  expect([...actual.strengths.keys()]).toEqual([...expected.strengths.keys()]);
  for (const [item, s] of expected.strengths) expect(strength(actual, item)).toBeCloseTo(s, 9);
  expect(actual.priorSource).toEqual(expected.priorSource);
}

/** A deterministic mixed history: pairs, draws, strong answers, placements, marks and removals. */
function mixedHistory(seed: number, count: number, originals: string[]): RankingEvent[] {
  const random = seededRandom(seed);
  const pool = [...originals];
  const pick = (): string => pool[Math.floor(random() * pool.length)] as string;
  // Nothing comes back after a removal but undo, so a few at most keep the list worth ranking.
  const removed = new Set<string>();
  const maxRemoved = Math.floor(originals.length / 4);
  const distinct = (k: number): string[] => {
    const chosen: string[] = [];
    while (chosen.length < k) {
      const candidate = pick();
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }
    return chosen;
  };
  const outcomes: PairOutcome[] = ['left', 'right', 'left_strong', 'right_strong', 'draw'];
  const events: RankingEvent[] = [];
  while (events.length < count) {
    const roll = random();
    if (roll < 0.45) {
      const [a, b] = distinct(2) as [string, string];
      events.push(pair(a, b, outcomes[Math.floor(random() * outcomes.length)]));
    } else if (roll < 0.65) {
      // A second run of answers, half draws and half strong, so both weights are well represented.
      const [a, b] = distinct(2) as [string, string];
      events.push(pair(a, b, random() < 0.5 ? 'draw' : 'right_strong'));
    } else if (roll < 0.8) {
      const [item, above, below] = distinct(3) as [string, string, string];
      events.push(place(item, above, below));
    } else if (roll < 0.87) {
      events.push(unrecognized(pick()));
    } else if (removed.size < maxRemoved) {
      const item = pick();
      removed.add(item);
      events.push(removal(item));
    } else {
      const [a, b] = distinct(2) as [string, string];
      events.push(pair(a, b));
    }
  }
  return events;
}

describe('replay basics', () => {
  it('an evidence-free list ranks in arrival order', () => {
    const state = replay(list(['c', 'a', 'b', 'd']));
    expect(state.ranked).toEqual(['c', 'a', 'b', 'd']);
    expect(state.nextPair).toEqual(['c', 'a']);
    expect(state.eventCount).toBe(0);
  });

  it('a pair answer puts the winner above the loser', () => {
    const state = replay(list(['a', 'b', 'c'], [pair('a', 'c', 'right')]));
    expect(state.ranked.indexOf('c')).toBeLessThan(state.ranked.indexOf('a'));
    expect(strength(state, 'c')).toBeGreaterThan(strength(state, 'a'));
    expect(state.eventCount).toBe(1);
  });
});

describe('prior replacement (docs/ARCHITECTURE.md 11)', () => {
  const ten = items(10);

  it('a ranked-seed item dragged far away shows exactly at the drop', () => {
    const state = replay(list(ten, [place('i9', 'i1', 'i2')], 'ranked'));
    expect(state.ranked[2]).toBe('i9');
    expect(state.priorSource.get('i9')).toBe('placement');
    expect(state.priorSource.get('i0')).toBe('seed');
    expect(strength(state, 'i9')).toBeCloseTo((strength(state, 'i1') + strength(state, 'i2')) / 2, 9);
  });

  it('a drop into a tied run shows exactly at the drop', () => {
    const state = replay(list(items(6), [place('i5', 'i1', 'i2')]));
    expect(state.ranked).toEqual(['i0', 'i1', 'i5', 'i2', 'i3', 'i4']);
    expect(strength(state, 'i5')).toBe(0);
  });

  it('a drop between two tied rows recorded in swapped order still shows between them', () => {
    // i1 displays above i2, but the event names i2 above and i1 below (malformed data).
    const state = replay(list(items(5), [place('i4', 'i2', 'i1')]));
    expect(state.ranked).toEqual(['i0', 'i1', 'i4', 'i2', 'i3']);
  });

  it('a second drop supersedes the first', () => {
    const state = replay(list(ten, [place('i9', 'i1', 'i2'), place('i9', 'i5', 'i6')], 'ranked'));
    expect(state.ranked[6]).toBe('i9');
    expect(state.priorSource.get('i9')).toBe('placement');
    expect(strength(state, 'i9')).toBeCloseTo((strength(state, 'i5') + strength(state, 'i6')) / 2, 9);
  });

  it('undoing the second drop restores the first placement prior', () => {
    const first = place('i9', 'i1', 'i2');
    const afterFirst = replay(list(ten, [first], 'ranked'));
    const session = new EngineSession(list(ten, [first], 'ranked'));
    session.append(place('i9', 'i5', 'i6'));
    const undone = session.undo();
    expect(undone.ranked[2]).toBe('i9');
    expect(undone.priorSource.get('i9')).toBe('placement');
    expect(strength(undone, 'i9')).toBeCloseTo(strength(afterFirst, 'i9'), 9);
    // No evidence anywhere, so the first prior's mean is the seed midpoint of i1 and i2.
    expect(strength(undone, 'i9')).toBeCloseTo(40 - (80 * 1.5) / 9, 9);
  });
});

describe('the same history under another starting order (docs/ARCHITECTURE.md 11)', () => {
  const eight = items(8);
  type Step = RankingEvent | { drop: string; at: number };
  const steps: Step[] = [
    pair('i0', 'i2'),
    pair('i3', 'i1', 'left_strong'),
    // The order i2, i4, i3, i6, i5 as answers between neighbours.
    pair('i2', 'i4'),
    pair('i4', 'i3'),
    pair('i3', 'i6'),
    pair('i6', 'i5'),
    { drop: 'i6', at: 1 },
    pair('i6', 'i0', 'right'),
    pair('i4', 'i5'),
    { drop: 'i1', at: 4 },
    pair('i7', 'i5', 'draw'),
    { drop: 'i7', at: 2 },
    pair('i1', 'i4'),
  ];

  /** The history as recorded under 'rough': each drop names the rows it was shown between. */
  function recordedHistory(): RankingEvent[] {
    const session = new EngineSession(list(eight, [], 'rough'));
    const recorded: RankingEvent[] = [];
    for (const step of steps) {
      let event: RankingEvent;
      if ('kind' in step) {
        event = step;
      } else {
        const rows = session.state.ranked.filter((item) => item !== step.drop);
        event = place(step.drop, rows[step.at - 1], rows[step.at]);
      }
      session.append(event);
      recorded.push(event);
    }
    return recorded;
  }

  const events = recordedHistory();
  const placements = events.flatMap((event, index) => (event.kind === 'placement' ? [index] : []));

  it.each(['unordered', 'ranked'] as const)(
    'under %s, each placement re-derives its prior and shows between its neighbours',
    (startingOrder) => {
      expect(placements).toHaveLength(3);
      for (const index of placements) {
        const { itemId, aboveItemId, belowItemId } = events[index] as {
          itemId: string;
          aboveItemId: string;
          belowItemId: string;
        };
        const state = replay(list(eight, events.slice(0, index + 1), startingOrder));
        expect(state.priorSource.get(itemId)).toBe('placement');

        // Re-derive the anchor independently: the fit just before the drop
        // with the item's earlier evidence gone. Marking the item takes its
        // evidence out without changing anyone else's fit.
        const refit = replay(list(eight, [...events.slice(0, index), unrecognized(itemId)], startingOrder));
        const mean = (strength(refit, aboveItemId) + strength(refit, belowItemId)) / 2;
        expect(Math.abs(strength(state, itemId) - mean)).toBeLessThan(1e-9);

        // The new seeds can swap the two recorded rows (under 'ranked', the
        // second drop's i4 and i3 do); the item still shows between them.
        const at = state.ranked.indexOf(itemId);
        const rows = [state.ranked.indexOf(aboveItemId), state.ranked.indexOf(belowItemId)];
        expect(Math.min(...rows)).toBeLessThan(at);
        expect(Math.max(...rows)).toBeGreaterThan(at);
      }
    },
  );

  it('the re-derived anchors differ from the recorded ones', () => {
    const index = placements[0] as number;
    const prefix = events.slice(0, index + 1);
    const rough = replay(list(eight, prefix, 'rough'));
    const ranked = replay(list(eight, prefix, 'ranked'));
    expect(Math.abs(strength(rough, 'i6') - strength(ranked, 'i6'))).toBeGreaterThan(0.1);
  });

  it('two full replays are identical', () => {
    const changed = list(eight, events, 'ranked');
    expect(replay(changed)).toEqual(replay(changed));
  });

  it('a session reset to another starting order rebuilds from scratch', () => {
    const changed = list(eight, events, 'ranked');
    const session = new EngineSession(list(eight, events, 'rough'));
    expectSameState(session.reset(changed), replay(changed));
    expect(session.lastRebuild.fromEvent).toBe(0);
  });
});

describe('removal (docs/ARCHITECTURE.md 11)', () => {
  const six = items(6);
  const before = [pair('i0', 'i1'), pair('i2', 'i3'), pair('i4', 'i1'), pair('i0', 'i5', 'right')];
  const placement = place('i3', 'i0', 'i1');

  it('takes an item out of the ranking and keeps it in the fit', () => {
    const kept = replay(list(six, before));
    const removed = replay(list(six, [...before, removal('i0')]));
    expect(removed.ranked).toEqual(kept.ranked.filter((item) => item !== 'i0'));
    expect(removed.unrecognized).toEqual([]);
    // Its answers still count, for it and for everyone it met.
    for (const [item, s] of kept.strengths) expect(strength(removed, item)).toBeCloseTo(s, 9);
    expect(removed.priorSource.get('i0')).toBe('seed');
    expect(removed.nextPair).not.toContain('i0');
  });

  it("hides a removed item from the 'Didn't recognize' section and restores it on undo", () => {
    const events = [unrecognized('i0'), removal('i0')];
    const removed = replay(list(six, events));
    expect(removed.ranked).not.toContain('i0');
    expect(removed.unrecognized).not.toContain('i0');

    const undone = replay(list(six, events.slice(0, -1)));
    expect(undone.unrecognized).toContain('i0');
  });

  it('a removal after a placement does not change how the placement replays', () => {
    const plain = replay(list(six, [...before, placement]));
    const withRemoval = replay(list(six, [...before, placement, removal('i0', 'i2'), pair('i4', 'i5')]));
    expect(strength(withRemoval, 'i3')).toBeCloseTo(strength(plain, 'i3'), 9);
    expect(withRemoval.ranked).not.toContain('i0');
    expect(withRemoval.strengths.has('i0')).toBe(true);
  });
});

describe('unrecognized items (docs/ARCHITECTURE.md 11)', () => {
  const five = items(5);
  const answers = [pair('i2', 'i0'), pair('i2', 'i1'), pair('i0', 'i1'), pair('i3', 'i4')];

  it('while marked, an item has no strength, no uncertainty and no term', () => {
    const marked = replay(list(five, [...answers, unrecognized('i2')]));
    expect(marked.strengths.has('i2')).toBe(false);
    expect(marked.uncertainty.has('i2')).toBe(false);
    expect(marked.priorSource.has('i2')).toBe(false);
    expect(marked.ranked).not.toContain('i2');
    expect(marked.unrecognized).toEqual(['i2']);
    // No term: the others fit as if i2's answers had never been given.
    const without = replay(list(five, [pair('i0', 'i1'), pair('i3', 'i4')]));
    for (const item of ['i0', 'i1', 'i3', 'i4']) {
      expect(strength(marked, item)).toBeCloseTo(strength(without, item), 9);
    }
  });

  it('dragging it back gives a placement prior and keeps its old evidence excluded', () => {
    const back = replay(list(five, [...answers, unrecognized('i2'), place('i2', 'i0', 'i3')]));
    expect(back.unrecognized).toEqual([]);
    expect(back.priorSource.get('i2')).toBe('placement');
    expect(back.ranked.indexOf('i2')).toBe(back.ranked.indexOf('i0') + 1);
    const without = replay(list(five, [pair('i0', 'i1'), pair('i3', 'i4'), place('i2', 'i0', 'i3')]));
    for (const item of ['i0', 'i1', 'i3', 'i4', 'i2']) {
      expect(strength(back, item)).toBeCloseTo(strength(without, item), 9);
    }
  });

  it('undoing that drag restores the unrecognized state', () => {
    const marked = [...answers, unrecognized('i2')];
    const session = new EngineSession(list(five, marked));
    session.append(place('i2', 'i3', 'i0'));
    const undone = session.undo();
    expect(undone.unrecognized).toEqual(['i2']);
    expect(undone.strengths.has('i2')).toBe(false);
    expectSameState(undone, replay(list(five, marked)));
  });
});

describe('drag exclusion (docs/ARCHITECTURE.md 11)', () => {
  it("a drag makes the item's earlier answers stop counting for its opponents too", () => {
    const four = items(4);
    const answers = [pair('i0', 'i1'), pair('i0', 'i1', 'left_strong'), pair('i0', 'i2'), pair('i3', 'i2')];
    const dragged = replay(list(four, [...answers, place('i0', 'i2', 'i3')]));
    const reference = replay(list(four, [pair('i3', 'i2'), place('i0', 'i2', 'i3')]));
    for (const item of ['i1', 'i2', 'i3']) {
      expect(Math.abs(strength(dragged, item) - strength(reference, item))).toBeLessThan(1e-9);
    }
    // Without the drag, i1's losses to i0 pull it down.
    const undragged = replay(list(four, answers));
    expect(strength(undragged, 'i1')).toBeLessThan(strength(dragged, 'i1') - 0.1);
  });
});

describe('EngineSession', () => {
  const twelve = items(12);

  it('append equals replay', () => {
    const events = mixedHistory(7, 30, twelve);
    const session = new EngineSession(list(twelve));
    let state = session.state;
    for (const event of events) state = session.append(event);
    const cold = replay(list(twelve, events));
    expect(state.eventCount).toBe(30);
    expectSameState(state, cold);
    expect(state.nextPair).not.toBeNull();
  });

  it('undo equals a replay of the shorter history', () => {
    const events = mixedHistory(11, 30, twelve);
    const session = new EngineSession(list(twelve, events));
    for (let length = events.length - 1; length >= 20; length--) {
      const state = session.undo();
      expect(state.eventCount).toBe(length);
      expectSameState(state, replay(list(twelve, events.slice(0, length))));
    }
  });

  it('checkpoints are used by a second undo', () => {
    const events = [
      pair('i0', 'i1'),
      place('i4', 'i0', 'i1'),
      pair('i2', 'i3'),
      place('i5', 'i2', 'i3'),
      pair('i6', 'i7'),
      place('i8', 'i6', 'i7'),
      pair('i9', 'i10'),
      pair('i11', 'i9'),
    ];
    const lastPlacement = 6; // eventCount after the third placement
    const session = new EngineSession(list(twelve, events));
    session.undo();
    const state = session.undo();
    expect(session.lastRebuild.fromEvent).toBeGreaterThanOrEqual(lastPlacement);
    // The checkpoint covers the shorter history, so it steps back one event: one
    // fit there (for the next undo's snapshot) and the placement's own fit.
    expect(session.lastRebuild.fits).toBe(2);
    expectSameState(state, replay(list(twelve, events.slice(0, -2))));
  });

  it('a checkpoint is kept every 500 events, for a second undo', () => {
    const random = seededRandom(3);
    const events = Array.from({ length: 520 }, () => {
      const a = Math.floor(random() * 12);
      const b = (a + 1 + Math.floor(random() * 11)) % 12;
      return pair(`i${a}`, `i${b}`);
    });
    const session = new EngineSession(list(twelve, events));
    session.undo();
    const state = session.undo();
    expect(session.lastRebuild.fromEvent).toBe(500);
    expectSameState(state, replay(list(twelve, events.slice(0, -2))));
  });

  it('append after undo equals replay, counting shown pairs from the restored prefix', () => {
    const events = mixedHistory(19, 60, twelve);
    const session = new EngineSession(list(twelve, events));
    session.undo();
    session.undo();
    expect(session.lastRebuild.fromEvent).toBeGreaterThan(0);
    const kept = events.slice(0, -2);
    const more = [pair('i1', 'i2'), pair('i4', 'i0', 'left_strong'), pair('i3', 'i4')];
    let state = session.state;
    for (const event of more) state = session.append(event);
    expectSameState(state, replay(list(twelve, [...kept, ...more])));
  });

  it('append after reset equals replay', () => {
    const events = mixedHistory(23, 60, twelve);
    const session = new EngineSession(list(twelve, events));
    const edited = [...events.slice(0, 40), pair('i9', 'i10'), pair('i6', 'i2', 'draw')];
    session.reset(list(twelve, edited));
    expect(session.lastRebuild.fromEvent).toBeGreaterThan(0);
    const more = [pair('i0', 'i11', 'draw'), pair('i5', 'i8', 'right_strong')];
    let state = session.state;
    for (const event of more) state = session.append(event);
    expectSameState(state, replay(list(twelve, [...edited, ...more])));
  });

  it('append after undo past a 500-event checkpoint equals replay', () => {
    const events = mixedHistory(29, 620, twelve);
    const session = new EngineSession(list(twelve, events));
    session.undo();
    expect(session.lastRebuild.fromEvent).toBeGreaterThanOrEqual(500);
    const more = [pair('i0', 'i1'), pair('i8', 'i4', 'right_strong')];
    let state = session.state;
    for (const event of more) state = session.append(event);
    expectSameState(state, replay(list(twelve, [...events.slice(0, -1), ...more])));
  });

  it('reset rebuilds from the latest checkpoint whose prefix is unchanged', () => {
    const events = [
      pair('i0', 'i1'),
      place('i4', 'i0', 'i1'),
      pair('i2', 'i3'),
      place('i5', 'i2', 'i3'),
      pair('i6', 'i7'),
    ];
    const session = new EngineSession(list(twelve, events));
    const edited = [...events.slice(0, 3), pair('i9', 'i10'), pair('i11', 'i0')];
    const state = session.reset(list(twelve, edited));
    expect(session.lastRebuild.fromEvent).toBe(2);
    expectSameState(state, replay(list(twelve, edited)));
  });
});

describe('checkpoints hold fitted strengths (docs/ARCHITECTURE.md 6.5)', () => {
  const twelve = items(12);

  function expectFitted(session: EngineSession, events: RankingEvent[], listItems = twelve): void {
    const checkpoints = session.checkpointStrengths;
    expect(checkpoints.some((c) => c.eventCount % 500 === 0)).toBe(true);
    expect(checkpoints.some((c) => c.eventCount % 500 !== 0)).toBe(true);
    let spread = 0;
    for (const { eventCount, strengths } of checkpoints) {
      const live = replay(list(listItems, events.slice(0, eventCount)));
      for (const [item, s] of live.strengths) {
        expect(strengths.get(item), `${item} at ${eventCount} events`).toBeCloseTo(s, 9);
        spread = Math.max(spread, Math.abs(s));
      }
    }
    // Not the all-prior zeros: the strengths really were fitted.
    expect(spread).toBeGreaterThan(1);
  }

  it('a cold-built session stores the live fitted strengths at every checkpoint', () => {
    const events = mixedHistory(31, 1120, twelve);
    expectFitted(new EngineSession(list(twelve, events)), events);
  }, 120_000);

  it('a warm-built session stores them too', () => {
    const events = mixedHistory(37, 1120, twelve);
    const session = new EngineSession(list(twelve, []));
    for (const event of events) session.append(event);
    expectFitted(session, events);
  }, 120_000);

  // Item 43 of docs/TECH_DEBT.md: precision was only measured on 12 items, where the placement width is
  // widest relative to the list. At 100 items the same fitted-strength match must hold.
  it('a cold-built session stores the live fitted strengths at every checkpoint on 100 items', () => {
    const hundred = items(100);
    const events = mixedHistory(53, 1120, hundred);
    expectFitted(new EngineSession(list(hundred, events)), events, hundred);
  }, 300_000);

  it('a second undo rebuilds from a fitted checkpoint with at most two fits', () => {
    const events = mixedHistory(41, 1120, twelve);
    const session = new EngineSession(list(twelve, events));
    session.undo();
    session.undo();
    expect(session.lastRebuild.fromEvent).toBeGreaterThanOrEqual(1000);
    expect(session.lastRebuild.fits).toBeLessThanOrEqual(2);
  });
});

describe('engine uncertainty is unchanged (docs/ARCHITECTURE.md 6.1)', () => {
  const twelve = items(12);
  const random = seededRandom(61);
  const shuffledIds = (k: number): string[] => shuffled(twelve, random).slice(0, k);
  const answers: RankingEvent[] = Array.from({ length: 40 }, (_, e) => {
    const presented = shuffledIds(2);
    const outcome = e % 3 === 0 ? 'draw' : e % 2 === 0 ? 'left' : 'right_strong';
    return pair(presented[0] as string, presented[1] as string, outcome);
  });

  /** The final problem for answers only (no placement, mark or edit): seed priors and every term. */
  function finalProblem(engineList: EngineList): Problem {
    const timeline = new Timeline(engineList.originalItemIds);
    const evidence = new Evidence();
    engineList.events.forEach((event, index) => evidence.add(event, index, timeline));
    const n = engineList.originalItemIds.length;
    const priors = engineList.originalItemIds.map((_, i) => seedPrior(i, n, engineList.startingOrder));
    return {
      free: Int32Array.from({ length: n }, (_, i) => i),
      priorMean: Float64Array.from(priors, (prior) => prior.mean),
      priorVar: Float64Array.from(priors, (prior) => prior.variance),
      ...evidence.activeTerms(timeline),
    };
  }

  /** Every uncertainty is 1 / hessianDiagonal of the final problem at the state's strengths. */
  function expectExactUncertainty(state: EngineState, engineList: EngineList): void {
    const p = finalProblem(engineList);
    const s = Float64Array.from(engineList.originalItemIds, (item) => strength(state, item));
    const diagonal = new Float64Array(s.length);
    hessianDiagonal(p, s, diagonal);
    engineList.originalItemIds.forEach((item, slot) => {
      const expected = 1 / (diagonal[slot] as number);
      const actual = state.uncertainty.get(item) ?? NaN;
      expect(Math.abs(actual - expected) / expected, item).toBeLessThan(1e-12);
    });
  }

  it('after a cold replay, a warm pair answer and a warm draw', () => {
    const ranked = list(twelve, answers, 'ranked');
    expectExactUncertainty(replay(ranked), ranked);
    const session = new EngineSession(list(twelve, answers.slice(0, -2), 'ranked'));
    expectExactUncertainty(
      session.append(answers[38] as RankingEvent),
      list(twelve, answers.slice(0, -1), 'ranked'),
    );
    expectExactUncertainty(session.append(answers[39] as RankingEvent), ranked);
  });

  it('after a warm placement, which has no solve at its final point', () => {
    const events = [...answers, place('i3', 'i7', 'i8')];
    const session = new EngineSession(list(twelve, answers));
    const placed = session.append(events[events.length - 1] as RankingEvent);
    const cold = replay(list(twelve, events));
    for (const [item, u] of cold.uncertainty) {
      expect(Math.abs((placed.uncertainty.get(item) ?? NaN) - u) / u, item).toBeLessThan(1e-9);
    }
  });
});

describe('solver bookkeeping (docs/ARCHITECTURE.md 6.5)', () => {
  it('counts no missed solves on an ordinary history, cold or warm', () => {
    const twelve = items(12);
    const events = mixedHistory(43, 300, twelve);
    expect(replayWithStats(list(twelve, events)).nonConverged).toBe(0);
    const session = new EngineSession(list(twelve, events.slice(0, 200)));
    for (const event of events.slice(200)) session.append(event);
    session.undo();
    expect(session.nonConverged).toBe(0);
  });
});

describe('placements through a real fit (docs/ARCHITECTURE.md 6.8 step 9)', () => {
  /** Deterministic evidence over the given items: short-range answers, a few of them reversed. */
  function evidence(ids: string[]): RankingEvent[] {
    const random = seededRandom(ids.length);
    const events: RankingEvent[] = [];
    for (let round = 0; round < 6; round++) {
      for (let k = 0; k < ids.length; k++) {
        const j = Math.min(ids.length - 1, k + 1 + Math.floor(random() * 3));
        if (j === k) continue;
        const reversed = random() < 0.15;
        events.push(pair(ids[k] as string, ids[j] as string, reversed ? 'right' : 'left'));
      }
    }
    return events;
  }

  interface Drop {
    upper: number | undefined;
    lower: number | undefined;
  }

  /**
   * Drops `item` between the rows now at the given positions of the others (undefined is an edge), and checks the result.
   * The others keep the order of the refit without the item's earlier answers (6.8 steps 2 to 4: other rows may
   * shift in that refit, and the placed item then moves nothing else), which is the list with the item set aside.
   */
  function expectDrop(l: EngineList, item: string, where: Drop): void {
    const before = replay(l);
    const others = before.ranked.filter((id) => id !== item);
    const refit = replay({ ...l, events: [...l.events, unrecognized(item)] }).ranked;
    const above = where.upper === undefined ? undefined : others[where.upper];
    const below = where.lower === undefined ? undefined : others[where.lower];
    const dropped = place(item, above, below);
    const states = [replay({ ...l, events: [...l.events, dropped] }), new EngineSession(l).append(dropped)];
    for (const state of states) {
      const at = state.ranked.indexOf(item);
      expect(at, `${item} in the list`).toBeGreaterThanOrEqual(0);
      if (above !== undefined) expect(state.ranked[at - 1]).toBe(above);
      else expect(at).toBe(0);
      if (below !== undefined) expect(state.ranked[at + 1]).toBe(below);
      else expect(at).toBe(state.ranked.length - 1);
      expect(state.priorSource.get(item)).toBe('placement');
      expect(state.ranked.filter((id) => id !== item)).toEqual(refit);
    }
  }

  const fifteen = items(15);

  it('a drop at the top edge shows at the top', () => {
    const l = list(fifteen, evidence(fifteen));
    expectDrop(l, replay(l).ranked[9] as string, { upper: undefined, lower: 0 });
  });

  it('a drop at the bottom edge shows at the bottom', () => {
    const l = list(fifteen, evidence(fifteen));
    expectDrop(l, replay(l).ranked[3] as string, { upper: 13, lower: undefined });
  });

  it('a drop into a near-tied region with real evidence shows between its neighbours', () => {
    // a and b both beat d and lose to c, and split their own game: a dead heat with evidence.
    const events = [
      pair('c', 'a'),
      pair('c', 'b'),
      pair('a', 'd'),
      pair('b', 'd'),
      pair('a', 'b'),
      pair('b', 'a'),
      pair('e', 'd'),
      pair('d', 'f'),
    ];
    const l = list(['a', 'b', 'c', 'd', 'e', 'f', 'x'], events);
    const others = replay(l).ranked.filter((id) => id !== 'x');
    const upper = Math.min(others.indexOf('a'), others.indexOf('b'));
    expect(Math.abs(others.indexOf('a') - others.indexOf('b'))).toBe(1);
    expectDrop(l, 'x', { upper, lower: upper + 1 });
  });

  it('a drop in a seeded ranked list with evidence shows between its neighbours', () => {
    const ten = items(10);
    const l = list(ten, evidence(ten.slice(0, 9)), 'ranked');
    expectDrop(l, 'i9', { upper: 3, lower: 4 });
  });

  it('a drop in a list of fewer than 10 items with evidence shows between its neighbours', () => {
    const six = items(6);
    const l = list(six, evidence(six.slice(0, 5)));
    expectDrop(l, 'i5', { upper: 1, lower: 2 });
  });
});

describe('review focus', () => {
  it('events naming unknown items are skipped', () => {
    const known = [pair('a', 'b'), pair('c', 'a')];
    const noisy = [
      pair('a', 'ghost'),
      ...known.slice(0, 1),
      pair('c', 'ghost', 'draw'),
      place('ghost', 'a', 'b'),
      unrecognized('phantom'),
      removal('ghost'),
      ...known.slice(1),
    ];
    const clean = replay(list(['a', 'b', 'c', 'd'], known));
    const state = replay(list(['a', 'b', 'c', 'd'], noisy));
    expect(state.eventCount).toBe(noisy.length);
    expect(state.ranked).toEqual(clean.ranked);
    expect(state.priorSource).toEqual(clean.priorSource);
    for (const [item, s] of clean.strengths) expect(strength(state, item)).toBeCloseTo(s, 9);
  });

  it('a placement with a neighbour not visible at that time treats it as absent', () => {
    const five = items(5);
    const setup = [pair('i0', 'i1'), pair('i1', 'i2'), removal('i1')];
    const withHidden = replay(list(five, [...setup, place('i4', 'i1', 'i2')]));
    const withoutUpper = replay(list(five, [...setup, place('i4', undefined, 'i2')]));
    expectSameState(withHidden, withoutUpper);
    expect(withHidden.ranked.indexOf('i4')).toBe(withHidden.ranked.indexOf('i2') - 1);
    // A neighbour the list never held is absent too.
    const unknown = replay(list(five, [...setup, place('i4', 'i0', 'ghost')]));
    const withoutLower = replay(list(five, [...setup, place('i4', 'i0')]));
    expectSameState(unknown, withoutLower);
  });

  it('a placement with both neighbours absent is skipped', () => {
    const five = items(5);
    const setup = [pair('i0', 'i1'), unrecognized('i3'), removal('i1')];
    const skipped = replay(list(five, [...setup, place('i4', 'i1', 'i3')]));
    expectSameState(skipped, replay(list(five, setup)));
    expect(skipped.priorSource.get('i4')).toBe('seed');
    // A removed item cannot be placed.
    const removedItem = replay(list(five, [...setup, place('i1', 'i0', 'i2')]));
    expectSameState(removedItem, replay(list(five, setup)));
    // Nor between itself and something else.
    const self = replay(list(five, [...setup, place('i4', 'i4', 'i3')]));
    expectSameState(self, replay(list(five, setup)));
  });

  it.each([0, 1, 2, 4, 5])('a list of %i visible items', (n) => {
    const state = replay(list(items(n)));
    expect(state.ranked).toHaveLength(n);
    expect(state.nextPair === null).toBe(n < 2);
  });

  it('visible counts exclude removed and unrecognized items', () => {
    const state = replay(list(items(6), [removal('i0'), unrecognized('i1')]));
    expect(state.ranked).toHaveLength(4);
    expect(state.nextPair).not.toBeNull();
  });
});

describe('questions', () => {
  it('never offers the immediately previous pair', () => {
    // With two items the only pair is the previous one, so no repeat discount can explain a null.
    expect(replay(list(['a', 'b'], [pair('a', 'b', 'draw')])).nextPair).toBeNull();
  });

  it('a later non-pair event clears the previous pair', () => {
    const state = replay(list(['a', 'b'], [pair('a', 'b', 'draw'), removal('c')]));
    expect(state.nextPair).toEqual(['a', 'b']);
  });
});

describe('undo snapshot (docs/ARCHITECTURE.md 6.5 item 7)', () => {
  const twelve = items(12);

  /** Appends the last event to a session built from the rest, then undoes it. */
  function appendThenUndo(events: RankingEvent[]): { session: EngineSession; undone: EngineState } {
    const session = new EngineSession(list(twelve, events.slice(0, -1)));
    session.append(events[events.length - 1] as RankingEvent);
    return { session, undone: session.undo() };
  }

  it('undo of the last append uses the snapshot', () => {
    const events = mixedHistory(47, 40, twelve);
    const session = new EngineSession(list(twelve, events));
    session.append(pair('i0', 'i11'));
    const undone = session.undo();
    expect(session.lastRebuild).toEqual({ fromEvent: 40, fits: 0, fromSnapshot: true });
    expect(undone.eventCount).toBe(40);
    expectSameState(undone, replay(list(twelve, events)));
  });

  it('undo with no events changes nothing', () => {
    const session = new EngineSession(list(twelve));
    const before = session.state;
    expect(session.undo()).toBe(before);
    expect(session.lastRebuild).toEqual({ fromEvent: 0, fits: 0, fromSnapshot: false });
  });

  it('undo keeps the count of missed solves since the session began', () => {
    const session = new EngineSession(list(twelve, mixedHistory(59, 40, twelve)));
    expect(session.nonConverged).toBe(0);
    forcedMisses.remaining = 1;
    session.append(pair('i0', 'i11'));
    expect(session.nonConverged).toBe(1);
    session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    expect(session.nonConverged).toBe(1);
  });

  it('two undos in a row: the second uses the checkpoint path', () => {
    const events = mixedHistory(53, 40, twelve);
    const session = new EngineSession(list(twelve, events.slice(0, -1)));
    session.append(events[events.length - 1] as RankingEvent);
    session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    const state = session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(false);
    expect(session.lastRebuild.fits).toBeGreaterThan(0);
    expectSameState(state, replay(list(twelve, events.slice(0, -2))));
  });

  it.each([
    ['a placement', () => place('i3', 'i0', 'i1')],
    ['a placement of an unrecognized item', () => place('i7', 'i2', 'i5')],
    ['a "don\'t recognize" event', () => unrecognized('i2')],
    ['a removal', () => removal('i4')],
    ['a draw', () => pair('i4', 'i0', 'draw')],
  ])('undo after %s equals replay', (_label, last) => {
    const prefix = [...mixedHistory(59, 40, twelve), unrecognized('i7'), place('i9', 'i0', 'i1')];
    const { session, undone } = appendThenUndo([...prefix, last()]);
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    expectSameState(undone, replay(list(twelve, prefix)));
    // The restored tie order, exclusions and priors carry on exactly: answers after the undo still equal replay.
    const more = [pair('i3', 'i9'), pair('i7', 'i0', 'right'), place('i9', 'i5', 'i6'), pair('i9', 'i2')];
    let state = undone;
    for (const event of more) state = session.append(event);
    expectSameState(state, replay(list(twelve, [...prefix, ...more])));
  });

  it.each([
    ['a drop into a tied run', () => place('i2', 'i4', 'i5')],
    ['a pair naming an unrecognized item (shown, no evidence)', () => pair('i3', 'i6')],
    ['a pair', () => pair('i3', 'i4', 'draw')],
  ])('undo after %s restores the tie order and shown pairs exactly', (_label, last) => {
    // No evidence before the last event, so the order rests on the tie order
    // and the next question on what has been shown.
    const seven = items(7);
    // The draw is shown, and the drag of i5 that follows stops it counting as
    // evidence. i6 is marked unrecognized, so a pair naming it is shown but adds no term.
    const prefix = [pair('i5', 'i1', 'draw'), place('i5', 'i0', 'i1'), unrecognized('i6')];
    const session = new EngineSession(list(seven, prefix));
    session.append(last());
    session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    // An empty removal changes nothing but forces a fresh description of the live state.
    const noop = removal();
    expectSameState(session.append(noop), replay(list(seven, [...prefix, noop])));
  });

  it('undo after a drop restores the priors exactly', () => {
    // Under a ranked seed the drop's prior differs from the item's seed prior.
    const ten = items(10);
    const prefix = [pair('i0', 'i3'), pair('i4', 'i8')];
    const session = new EngineSession(list(ten, prefix, 'ranked'));
    session.append(place('i9', 'i1', 'i2'));
    session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    const next = pair('i9', 'i5');
    expectSameState(session.append(next), replay(list(ten, [...prefix, next], 'ranked')));
  });

  it('undo after reset does not use a stale snapshot', () => {
    const events = mixedHistory(61, 40, twelve);
    const session = new EngineSession(list(twelve, events));
    session.append(pair('i0', 'i1'));
    const edited = [...events.slice(0, 30), pair('i5', 'i6')];
    session.reset(list(twelve, edited));
    // The reset's own snapshot, of the edited history, not the append's.
    expectSameState(session.undo(), replay(list(twelve, edited.slice(0, -1))));
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    const state = session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(false);
    expectSameState(state, replay(list(twelve, edited.slice(0, -2))));
  });

  it('a second undo on a fresh session does not use a snapshot', () => {
    const events = mixedHistory(67, 40, twelve);
    const session = new EngineSession(list(twelve, events));
    session.undo();
    const state = session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(false);
    expectSameState(state, replay(list(twelve, events.slice(0, -2))));
  });

  it('append, undo, append again equals replay', () => {
    const events = mixedHistory(71, 40, twelve);
    const session = new EngineSession(list(twelve, events));
    session.append(pair('i7', 'i3', 'right_strong'));
    session.undo();
    const next = pair('i3', 'i7', 'draw');
    const state = session.append(next);
    expectSameState(state, replay(list(twelve, [...events, next])));
    // The new append keeps its own snapshot.
    expectSameState(session.undo(), replay(list(twelve, events)));
    expect(session.lastRebuild.fromSnapshot).toBe(true);
  });

  it('undo of an append that took a checkpoint drops that checkpoint', () => {
    const random = seededRandom(5);
    const events = Array.from({ length: 499 }, () => {
      const a = Math.floor(random() * 12);
      const b = (a + 1 + Math.floor(random() * 11)) % 12;
      return pair(`i${a}`, `i${b}`);
    });
    const session = new EngineSession(list(twelve, events));
    session.append(pair('i0', 'i1'));
    expect(session.checkpointStrengths.some((c) => c.eventCount === 500)).toBe(true);
    session.undo();
    expect(session.checkpointStrengths.some((c) => c.eventCount === 500)).toBe(false);
    session.undo();
    expectSameState(session.state, replay(list(twelve, events.slice(0, -1))));
  });

  it('undo of a checkpoint that ends in a re-placement of an already-placed item equals replay', () => {
    // A ranked start, so the earlier placement's prior differs from the seed and a wrong restore shows.
    const random = seededRandom(9);
    const filler = Array.from({ length: 498 }, () => {
      const a = Math.floor(random() * 12);
      const b = (a + 1 + Math.floor(random() * 11)) % 12;
      return pair(`i${a}`, `i${b}`);
    });
    const before = [place('i3', 'i0', 'i1'), ...filler];
    const events = [...before, place('i3', 'i8', 'i9')];
    expect(events).toHaveLength(500);
    const session = new EngineSession(list(twelve, events, 'ranked'));
    expect(session.checkpointStrengths.some((c) => c.eventCount === 500)).toBe(true);

    expectSameState(session.undo(), replay(list(twelve, before, 'ranked')));
    expectSameState(session.undo(), replay(list(twelve, before.slice(0, -1), 'ranked')));
  });
});

describe('undo snapshot from construction and reset (docs/ARCHITECTURE.md 6.5 item 7)', () => {
  const twelve = items(12);

  /** A session opened from a JSON round-tripped snapshot of the first `covered` events. */
  function opened(l: EngineList, covered = l.events.length): EngineSession {
    const exported = new EngineSession({ ...l, events: l.events.slice(0, covered) }).exportSnapshot();
    const snapshot: unknown = JSON.parse(JSON.stringify(exported));
    const session = new EngineSession(l, { snapshot });
    expect(session.lastRebuild.fromEvent, 'snapshot accepted').toBe(covered);
    return session;
  }

  /** Undoes straight away, checks it took the snapshot and equals replay, then checks the session carries on. */
  function expectSnapshotUndo(session: EngineSession, l: EngineList): void {
    const n = l.events.length;
    expectSameState(session.state, replay(l));
    const undone = session.undo();
    expect(session.lastRebuild).toEqual({ fromEvent: n - 1, fits: 0, fromSnapshot: true });
    const shorter = [...l.events.slice(0, -1)];
    expectSameState(undone, replay({ ...l, events: shorter }));
    const more = [pair('i3', 'i9'), place('i9', 'i5', 'i6'), pair('i9', 'i2', 'right')];
    let state = undone;
    for (const event of more) state = session.append(event);
    expectSameState(state, replay({ ...l, events: [...shorter, ...more] }));
  }

  const lastEvents: [string, () => RankingEvent][] = [
    ['a placement', () => place('i3', 'i0', 'i1')],
    ['a placement of an item placed before', () => place('i9', 'i4', 'i5')],
    ['a placement of an unrecognized item', () => place('i7', 'i2', 'i5')],
    ['a removal', () => removal('i4')],
    ['a pair', () => pair('i2', 'i7', 'left_strong')],
    ['a draw', () => pair('i4', 'i0', 'draw')],
    ['a "don\'t recognize" event', () => unrecognized('i6')],
  ];
  const prefix = (): RankingEvent[] => [
    ...mixedHistory(83, 40, twelve),
    unrecognized('i7'),
    place('i9', 'i0', 'i1'),
    pair('i9', 'i3'),
  ];

  describe('undo straight after construction uses the snapshot and equals replay', () => {
    it.each(lastEvents)('cold-built, last event %s', (_label, last) => {
      const l = list(twelve, [...prefix(), last()], 'rough');
      expectSnapshotUndo(new EngineSession(l), l);
    });

    it.each(lastEvents)('from a snapshot of the whole history, last event %s', (_label, last) => {
      const l = list(twelve, [...prefix(), last()], 'rough');
      expectSnapshotUndo(opened(l), l);
    });

    it.each(lastEvents)('from a snapshot with events after it, last event %s', (_label, last) => {
      const l = list(twelve, [...prefix(), pair('i1', 'i8'), last()], 'rough');
      expectSnapshotUndo(opened(l, l.events.length - 3), l);
    });

    it('restores the tie order exactly when the last event was a drop into a tied run', () => {
      // No evidence, so every strength ties and the tie order alone decides the display.
      const six = items(6);
      const l = list(six, [place('i5', 'i0', 'i1'), removal(), place('i2', 'i4', 'i5')]);
      for (const session of [new EngineSession(l), opened(l)]) {
        session.undo();
        expect(session.lastRebuild.fromSnapshot).toBe(true);
        expect(session.state.ranked).toEqual(['i0', 'i5', 'i1', 'i2', 'i3', 'i4']);
        // A fresh description of the live state, not the kept one.
        const noop = removal();
        expectSameState(session.append(noop), replay({ ...l, events: [...l.events.slice(0, -1), noop] }));
      }
    });

    it('a history of one event', () => {
      const l = list(twelve, [place('i3', 'i0', 'i1')], 'ranked');
      expectSnapshotUndo(new EngineSession(l), l);
      expectSnapshotUndo(opened(l), l);
    });

    it('construction fits once more, at the second-last event', () => {
      const answers = [pair('i0', 'i1'), pair('i2', 'i3'), pair('i4', 'i5'), pair('i6', 'i7')];
      forcedMisses.remaining = 2;
      const session = new EngineSession(list(twelve, answers));
      expect(session.lastRebuild.fits).toBe(2);
      // Both fits are counted, the extra one included.
      expect(session.nonConverged).toBe(2);
    });
  });

  describe('an item dragged again as the last event, opened and undone, equals replay', () => {
    // A ranked start makes the earlier drag's prior differ from the seed, so a wrong restore shows.
    const ten = items(10);
    const earlier = (): RankingEvent[] => [
      pair('i0', 'i3'),
      place('i8', 'i1', 'i2'),
      pair('i8', 'i4'),
      pair('i5', 'i6'),
      pair('i2', 'i9'),
    ];

    it('with the earlier drag inside the snapshot', () => {
      const l = list(ten, [...earlier(), place('i8', 'i6', 'i7')], 'ranked');
      const session = opened(l);
      expectSameState(session.undo(), replay({ ...l, events: l.events.slice(0, -1) }));
      expect(session.lastRebuild.fromSnapshot).toBe(true);
      expect(session.state.priorSource.get('i8')).toBe('placement');
    });

    it('with the earlier drag before a checkpoint the reset starts from', () => {
      const dragged = [...earlier(), place('i8', 'i6', 'i7')];
      const session = new EngineSession(
        list(ten, [...dragged, pair('i0', 'i9'), pair('i1', 'i9')], 'ranked'),
      );
      // The second drag took a checkpoint, and the reset history ends exactly there.
      const l = list(ten, dragged, 'ranked');
      expectSameState(session.reset(l), replay(l));
      expect(session.lastRebuild.fromEvent).toBe(dragged.length);
      expectSameState(session.undo(), replay({ ...l, events: dragged.slice(0, -1) }));
      expect(session.lastRebuild.fromSnapshot).toBe(true);
    });
  });

  it('undo straight after reset uses the snapshot', () => {
    const events = mixedHistory(89, 50, twelve);
    const session = new EngineSession(list(twelve, events));
    const edited = [...events.slice(0, 35), pair('i2', 'i10'), place('i4', 'i0', 'i1')];
    session.reset(list(twelve, edited));
    expect(session.lastRebuild.fromEvent).toBeGreaterThan(0);
    expectSnapshotUndo(session, list(twelve, edited));
  });

  it('a second undo still takes the checkpoint path', () => {
    const events = [...prefix(), place('i3', 'i0', 'i1')];
    for (const session of [new EngineSession(list(twelve, events)), opened(list(twelve, events))]) {
      session.undo();
      expect(session.lastRebuild.fromSnapshot).toBe(true);
      const state = session.undo();
      expect(session.lastRebuild.fromSnapshot).toBe(false);
      expect(session.lastRebuild.fits).toBeGreaterThan(0);
      expectSameState(state, replay(list(twelve, events.slice(0, -2))));
    }
  });

  it('opened and undone right after two drags, it still exports a snapshot that opens and equals replay', () => {
    // The undone state ends in a drag whose earlier prior the opened snapshot never held.
    const events = [...prefix(), place('i3', 'i0', 'i1'), place('i5', 'i2', 'i3')];
    const session = opened(list(twelve, events));
    session.undo();
    const resaved = session.exportSnapshot();
    expect(resaved?.displaced).toBeUndefined();
    const shorter = list(twelve, events.slice(0, -1));
    const reopened = new EngineSession(shorter, { snapshot: JSON.parse(JSON.stringify(resaved)) as unknown });
    expect(reopened.lastRebuild.fromEvent).toBe(shorter.events.length);
    expectSameState(reopened.state, replay(shorter));
    // With no earlier prior to step back to, undo rebuilds instead, and still equals replay.
    expectSameState(reopened.undo(), replay(list(twelve, events.slice(0, -2))));
    expect(reopened.lastRebuild.fromSnapshot).toBe(false);
  });
});

describe('canUndoWarm', () => {
  const twelve = items(12);
  // Longer than CHECKPOINT_EVERY, so an undo with no nearby checkpoint is a long replay.
  const long = (): EngineList => list(twelve, [...mixedHistory(97, 560, twelve), pair('i1', 'i2')]);

  function openedFromSnapshot(l: EngineList, strip = false): EngineSession {
    const exported = new EngineSession(l).exportSnapshot();
    const snapshot = JSON.parse(JSON.stringify(exported)) as Record<string, unknown>;
    if (strip) delete snapshot.displaced;
    const session = new EngineSession(l, { snapshot });
    expect(session.lastRebuild.fromEvent, 'snapshot accepted').toBe(l.events.length);
    return session;
  }

  it('undo of a pair answer, a draw and a placement restores warm', () => {
    const l = list(twelve, mixedHistory(99, 40, twelve));
    for (const last of [pair('i0', 'i5'), pair('i3', 'i8', 'draw'), place('i6', 'i1', 'i2')]) {
      const session = new EngineSession(l);
      session.append(last);
      expect(session.canUndoWarm()).toBe(true);
      expectSameState(session.undo(), replay(l));
      expect(session.lastRebuild).toEqual({ fromEvent: l.events.length, fits: 0, fromSnapshot: true });
    }
  });

  it('undo of a removal restores it warm', () => {
    const l = list(twelve, mixedHistory(99, 40, twelve));
    const session = new EngineSession(l);
    const removed = session.state.ranked[3] as string;
    const after = session.append(removal(removed));
    expect(after.ranked).not.toContain(removed);
    expect(after.strengths.has(removed)).toBe(true);
    expect(session.canUndoWarm()).toBe(true);
    const undone = session.undo();
    expect(session.lastRebuild).toEqual({ fromEvent: l.events.length, fits: 0, fromSnapshot: true });
    expect(undone.ranked).toContain(removed);
    expectSameState(undone, replay(l));
  });

  it('is true with no events, and after an append', () => {
    const session = new EngineSession(list(twelve));
    expect(session.canUndoWarm()).toBe(true);
    session.append(pair('i0', 'i1'));
    expect(session.canUndoWarm()).toBe(true);
  });

  it('after opening a long history from a snapshot: the first undo is warm, the second is not', () => {
    const l = long();
    const session = openedFromSnapshot(l);
    expect(session.canUndoWarm()).toBe(true);
    session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    expect(session.canUndoWarm()).toBe(false);
    session.undo();
    expect(session.lastRebuild.fromEvent, 'the replay it predicted').toBe(0);
  });

  it('after opening a long history from a snapshot, answering and undoing: the next undo is warm too', () => {
    const l = long();
    const session = openedFromSnapshot(l);
    session.append(pair('i2', 'i3'));
    session.undo();
    expect(session.lastRebuild.fromSnapshot).toBe(true);
    expect(session.canUndoWarm()).toBe(true);
    const undone = session.undo();
    expect(session.lastRebuild.fromEvent, 'from a checkpoint 0 events back').toBe(l.events.length - 1);
    expectSameState(undone, replay(list(twelve, l.events.slice(0, -1))));
    // And the one after that, from the checkpoint the rebuild left behind.
    expect(session.canUndoWarm()).toBe(true);
    expectSameState(session.undo(), replay(list(twelve, l.events.slice(0, -2))));
    expect(session.lastRebuild.fromEvent).toBe(l.events.length - 2);
  });

  it('is false for the first undo when the snapshot cannot give the state before a drag', () => {
    const base = long();
    // Items still shown, so the drag applies.
    const [above, below, , , item] = replay(base).ranked as [string, string, string, string, string];
    const l = { ...base, events: [...base.events, place(item, above, below)] };
    const session = openedFromSnapshot(l, true);
    expect(session.canUndoWarm()).toBe(false);
    session.undo();
    expect(session.lastRebuild.fromEvent).toBe(0);
  });

  it('is true when a checkpoint is near: a long history replayed from the priors keeps them', () => {
    const l = long();
    const session = new EngineSession(l);
    session.undo();
    expect(session.canUndoWarm()).toBe(true);
    session.undo();
    expect(session.lastRebuild.fromEvent).toBeGreaterThan(0);
  });

  it('is true for a short history, which replays from the start quickly', () => {
    const l = list(twelve, mixedHistory(98, 60, twelve));
    const session = openedFromSnapshot(l);
    session.undo();
    expect(session.canUndoWarm()).toBe(true);
  });
});
