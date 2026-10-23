import { describe, expect, it } from 'vitest';

import {
  EngineSession,
  type EngineState,
  replay,
  replayWithStats,
  validateSnapshot,
} from '@/lib/ranking/bt/engine';
import { seedPrior } from '@/lib/ranking/bt/priors';
import { ENGINE_SNAPSHOT_VERSION, type EngineSnapshot, exportSnapshot } from '@/lib/ranking/bt/snapshot';
import { drivenHistory, gridBoundaryHistories } from '@/tests/helpers/engineCorpus';
import type { UserModel } from '@/tests/helpers/simUser';
import type { EngineList, RankingEvent, StartingOrder } from '@/types/rankingEvents';

const USERS: UserModel[] = ['careful', 'typical', 'fuzzy', 'sloppy'];
const STARTS: StartingOrder[] = ['unordered', 'rough', 'ranked'];

/** Same displayed order and questions, strengths within 1e-9 (docs/ARCHITECTURE.md 6.6: a fresh replay is canonical). */
function expectSameState(actual: EngineState, expected: EngineState): void {
  expect(actual.ranked).toEqual(expected.ranked);
  expect(actual.unrecognized).toEqual(expected.unrecognized);
  expect(actual.nextPair).toEqual(expected.nextPair);
  expect(actual.priorSource).toEqual(expected.priorSource);
  expect([...actual.strengths.keys()]).toEqual([...expected.strengths.keys()]);
  for (const [item, s] of expected.strengths) {
    expect(Math.abs((actual.strengths.get(item) as number) - s)).toBeLessThan(1e-9);
  }
}

/** What browser storage hands back. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function prefixOf(list: EngineList, count: number): EngineList {
  return { ...list, events: list.events.slice(0, count) };
}

/** The snapshot of a session built on the first `count` events. */
function snapshotAt(list: EngineList, count: number): EngineSnapshot {
  const snapshot = exportSnapshot(new EngineSession(prefixOf(list, count)));
  if (snapshot === null) throw new Error('no snapshot');
  return roundTrip(snapshot);
}

/** A small history with every event kind, placements included. */
function mixed(startingOrder: StartingOrder = 'unordered'): EngineList {
  return drivenHistory({
    n: 24,
    events: 90,
    seed: 77,
    user: 'typical',
    startingOrder,
    mix: { placement: 0.12, undo: 0 },
  });
}

/**
 * A placement skipped because its only neighbour was removed (the item stays
 * unrecognized), and pair answers that leave one question as the previous one.
 */
function edgeCases(): { name: string; list: EngineList } {
  const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };
  const events: RankingEvent[] = [
    { ...base, id: 'a', kind: 'unrecognized', itemIds: ['i3'] },
    { ...base, id: 'b', kind: 'removal', itemIds: ['i1'] },
    { ...base, id: 'c', kind: 'placement', itemId: 'i3', aboveItemId: 'i1' },
    { ...base, id: 'd', kind: 'pair', leftItemId: 'i0', rightItemId: 'i2', outcome: 'left' },
    { ...base, id: 'e', kind: 'removal', itemIds: ['i0'] },
    { ...base, id: 'f', kind: 'pair', leftItemId: 'i3', rightItemId: 'i2', outcome: 'right' },
  ];
  return {
    name: 'edge cases',
    list: { originalItemIds: ['i0', 'i1', 'i2', 'i3'], startingOrder: 'unordered', events },
  };
}

describe('persisted snapshot (docs/ARCHITECTURE.md 6.5 item 8)', () => {
  it('a snapshot-started replay equals a fresh replay', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const steps = 80 + ((seed * 37) % 160);
      // Taken from the driven session itself up to mid-history, so they carry warm-path strengths.
      const snapshots: EngineSnapshot[] = [];
      const list = drivenHistory({
        n: 10 + ((seed * 7) % 40),
        events: steps,
        seed,
        user: USERS[seed % USERS.length] as UserModel,
        startingOrder: STARTS[seed % STARTS.length] as StartingOrder,
        mix: { placement: 0.08 },
        observe: ({ session }) => {
          const snapshot = exportSnapshot(session);
          if (snapshots.length < steps / 2 && snapshot) snapshots.push(roundTrip(snapshot));
        },
      });
      for (const event of list.events) kinds.add(event.kind);
      // The latest one whose events all survived the later undos.
      const snapshot = snapshots.findLast((s) => s.eventIds.every((id, i) => id === list.events[i]?.id));
      const covered = snapshot?.eventIds.length ?? 0;
      expect(covered, `seed ${seed}: snapshot covers events`).toBeGreaterThan(0);
      expect(list.events.length, `seed ${seed}: events appended after`).toBeGreaterThan(covered);
      const fresh = replayWithStats(list);
      const started = replayWithStats(list, { snapshot });
      expect(started.fromEvent, `seed ${seed}: snapshot accepted`).toBe(covered);
      expectSameState(started.state, fresh.state);
      expectSameState(new EngineSession(list, { snapshot }).state, fresh.state);
    }
    expect(kinds).toEqual(new Set(['pair', 'placement', 'unrecognized', 'removal']));
  }, 120_000);

  it('a snapshot at any point restores the tie order and the previous question exactly', () => {
    // Tied placements make the tie order decide the display; the snapshot at the very end keeps the previous pair.
    const histories = [{ name: 'mixed', list: mixed() }, edgeCases(), ...gridBoundaryHistories()];
    for (const { name, list } of histories) {
      for (let count = 1; count <= list.events.length; count++) {
        const snapshot = snapshotAt(list, count);
        for (const end of new Set([count, Math.min(count + 3, list.events.length)])) {
          const history = prefixOf(list, end);
          const started = replayWithStats(history, { snapshot });
          expect(started.fromEvent, `${name}: ${count} of ${end}`).toBe(count);
          expectSameState(started.state, replay(history));
        }
      }
    }
  }, 60_000);

  it('JSON round-trip', () => {
    const list = mixed('rough');
    const session = new EngineSession(list);
    const snapshot = exportSnapshot(session) as EngineSnapshot;
    expect(snapshot.version).toBe(ENGINE_SNAPSHOT_VERSION);
    expect(snapshot.eventIds).toEqual(list.events.map((event) => event.id));
    const text = JSON.stringify(snapshot);
    expect(roundTrip(snapshot)).toEqual(snapshot);
    expect(JSON.stringify(JSON.parse(text))).toBe(text);
    const started = replayWithStats(list, { snapshot: JSON.parse(text) as unknown });
    expect(started.fromEvent).toBe(list.events.length);
    expectSameState(started.state, replay(list));
  });

  it('a session with no events has nothing to export', () => {
    const session = new EngineSession({
      originalItemIds: ['a', 'b'],
      startingOrder: 'unordered',
      events: [],
    });
    expect(exportSnapshot(session)).toBeNull();
  });

  it('restoring skips the work: no placement fits for covered events', () => {
    const list = drivenHistory({
      n: 30,
      events: 120,
      seed: 9,
      user: 'careful',
      mix: { placement: 0.2, undo: 0 },
    });
    const cut = 70;
    const fresh = replayWithStats(list);
    const prefixFits = replayWithStats(prefixOf(list, cut)).fits;
    // A cold replay fits once per applied placement and once at the end.
    expect(prefixFits - 1, 'placements fitted in the covered prefix').toBeGreaterThan(5);
    const started = replayWithStats(list, { snapshot: snapshotAt(list, cut) });
    expect(started.fits).toBe(fresh.fits - (prefixFits - 1));
    expect(started.nonConverged).toBe(0);

    const whole = replayWithStats(list, { snapshot: snapshotAt(list, list.events.length) });
    expect(whole.fits).toBe(1);
    expectSameState(whole.state, fresh.state);
  });

  it('a session started from a snapshot rebuilds from it and undoes past it', () => {
    const list = mixed();
    const cut = 60;
    const session = new EngineSession(list, { snapshot: snapshotAt(list, cut) });
    expect(session.lastRebuild.fromEvent).toBe(cut);
    expectSameState(session.state, replay(list));
    for (let count = list.events.length - 1; count >= cut - 5; count--) {
      expectSameState(session.undo(), replay(prefixOf(list, count)));
    }
    const event = list.events[cut - 5] as (typeof list.events)[number];
    expectSameState(session.append(event), replay(prefixOf(list, cut - 4)));
  });

  describe('a snapshot that does not match is ignored, with no throw', () => {
    const list = mixed();
    const cut = 60;
    const good = snapshotAt(list, cut);
    const fresh = replay(list);

    function expectIgnored(snapshot: unknown, against: EngineList = list): void {
      const canonical = against === list ? fresh : replay(against);
      expect(validateSnapshot(against, snapshot)).toBeNull();
      const started = replayWithStats(against, { snapshot });
      expect(started.fromEvent).toBe(0);
      expectSameState(started.state, canonical);
      const session = new EngineSession(against, { snapshot });
      expect(session.lastRebuild.fromEvent).toBe(0);
      expectSameState(session.state, canonical);
    }

    it('accepts the untouched snapshot', () => {
      expect(validateSnapshot(list, good)).toEqual(good);
      expect(replayWithStats(list, { snapshot: good }).fromEvent).toBe(cut);
    });

    it('ignored when the version, items, starting order or an event id differ', () => {
      expectIgnored({ ...good, version: ENGINE_SNAPSHOT_VERSION + 1 });
      expectIgnored({ ...good, originalItemIds: [...good.originalItemIds, 'extra'] });
      expectIgnored(good, { ...list, originalItemIds: [...list.originalItemIds].reverse() });
      expectIgnored(good, { ...list, originalItemIds: [...list.originalItemIds, 'extra'] });
      expectIgnored(good, { ...list, startingOrder: 'ranked' });
      expectIgnored({ ...good, startingOrder: 'ranked' });
      const events = [...list.events];
      events[10] = { ...(events[10] as (typeof events)[number]), id: 'edited' };
      expectIgnored(good, { ...list, events });
      expectIgnored({ ...good, eventIds: good.eventIds.map((id, i) => (i === cut - 1 ? 'other' : id)) });
    });

    it('ignored when it covers more events than the history', () => {
      expectIgnored(good, prefixOf(list, cut - 1));
      expectIgnored(snapshotAt(list, list.events.length), prefixOf(list, list.events.length - 3));
    });

    it('ignored when a number is NaN or a field is missing or truncated', () => {
      const withStrength = (value: unknown): unknown => ({
        ...good,
        strengths: [value, ...good.strengths.slice(1)],
      });
      expectIgnored(withStrength(Number.NaN));
      expectIgnored(withStrength(Number.POSITIVE_INFINITY));
      expectIgnored(withStrength('1'));
      // NaN as browser storage returns it.
      expectIgnored(roundTrip(withStrength(Number.NaN)));
      expectIgnored({ ...good, priorVar: [0, ...good.priorVar.slice(1)] });
      expectIgnored({ ...good, priorMean: [...good.priorMean.slice(0, -1), null] });
      for (const field of Object.keys(good)) {
        const { [field]: _dropped, ...rest } = good as unknown as Record<string, unknown>;
        expectIgnored(rest);
      }
      expectIgnored({ ...good, strengths: good.strengths.slice(0, -1) });
      expectIgnored({ ...good, priorMean: good.priorMean.slice(0, -1) });
      expectIgnored({ ...good, priorVar: good.priorVar.slice(0, -1) });
      expectIgnored({ ...good, placedAt: good.placedAt.slice(0, -1) });
      expectIgnored({ ...good, tieOrder: good.tieOrder.slice(0, -1) });
      // Every array one longer is as wrong as one shorter: the slots come from the covered events.
      expectIgnored({
        ...good,
        strengths: [...good.strengths, 0],
        priorMean: [...good.priorMean, 0],
        priorVar: [...good.priorVar, 1],
        placedAt: [...good.placedAt, -1],
        tieOrder: [...good.tieOrder, good.tieOrder.length],
      });
      expectIgnored({ ...good, tieOrder: [good.tieOrder[1], ...good.tieOrder.slice(1)] });
      expectIgnored({ ...good, tieOrder: [0.5, ...good.tieOrder.slice(1)] });
      expectIgnored({ ...good, placedAt: ['guess', ...good.placedAt.slice(1)] });
      expectIgnored({ ...good, eventIds: [7, ...good.eventIds.slice(1)] });
      expectIgnored({ ...good, strengths: 'not an array' });
      for (const junk of [null, 42, 'snapshot', [], {}, [good]]) expectIgnored(junk);
    });
  });

  describe('a snapshot whose priors do not belong to its events is ignored', () => {
    const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };

    /** The whole-history snapshot with its covered events cut back to the first `count`. */
    function cutTo(list: EngineList, count: number): EngineSnapshot {
      const whole = snapshotAt(list, list.events.length);
      return { ...whole, eventIds: whole.eventIds.slice(0, count) };
    }

    it('every cut of a whole-history snapshot is ignored or gives the replay', () => {
      let accepted = 0;
      let rejected = 0;
      for (let seed = 1; seed <= 4; seed++) {
        const list = drivenHistory({
          n: 16 + seed * 4,
          events: 70,
          seed,
          user: USERS[seed % USERS.length] as UserModel,
          // A ranked start leaves the simulated user little to drag, so these use the other two.
          startingOrder: seed % 2 === 0 ? 'rough' : 'unordered',
          mix: { placement: 0.15, undo: 0 },
        });
        expect(list.events.some((event) => event.kind === 'placement')).toBe(true);
        const fresh = replay(list);
        for (let count = 0; count <= list.events.length; count++) {
          const started = replayWithStats(list, { snapshot: cutTo(list, count) });
          if (started.fromEvent === 0) {
            rejected++;
          } else {
            accepted++;
            expect(started.fromEvent, `seed ${seed}: cut at ${count}`).toBe(count);
          }
          expect(started.state.ranked, `seed ${seed}: cut at ${count}`).toEqual(fresh.ranked);
          expect(started.state.nextPair).toEqual(fresh.nextPair);
          for (const [item, s] of fresh.strengths) {
            expect(Math.abs((started.state.strengths.get(item) as number) - s)).toBeLessThan(1e-9);
          }
        }
      }
      // Both outcomes are exercised: cuts after the last placement are kept, earlier ones are not.
      expect(accepted).toBeGreaterThan(0);
      expect(rejected).toBeGreaterThan(0);
    }, 120_000);

    it('ignored when it covers no events', () => {
      const list = mixed();
      expectIgnoredFor(list, cutTo(list, 0));
    });

    it('ignored when an item placed before the cut was placed again after it', () => {
      const events: RankingEvent[] = [
        { ...base, id: 'a', kind: 'placement', itemId: 'i5', aboveItemId: 'i0' },
        { ...base, id: 'b', kind: 'pair', leftItemId: 'i1', rightItemId: 'i2', outcome: 'left' },
        { ...base, id: 'c', kind: 'placement', itemId: 'i5', belowItemId: 'i3' },
        { ...base, id: 'd', kind: 'pair', leftItemId: 'i0', rightItemId: 'i4', outcome: 'right' },
      ];
      const list: EngineList = {
        originalItemIds: ['i0', 'i1', 'i2', 'i3', 'i4', 'i5'],
        startingOrder: 'ranked',
        events,
      };
      const cut = cutTo(list, 2);
      // Placed in the covered events too, so its source alone cannot tell.
      expect(replay(prefixOf(list, 2)).priorSource.get('i5')).toBe('placement');
      expectIgnoredFor(list, cut);
      expect(validateSnapshot(list, cutTo(list, 3))).not.toBeNull();
    });

    it('ignored when a seed prior was changed', () => {
      const list = mixed('rough');
      const good = snapshotAt(list, 60);
      expect(validateSnapshot(list, good)).toEqual(good);
      const seedSlot = good.placedAt.indexOf(-1);
      const expected = seedPrior(seedSlot, list.originalItemIds.length, 'rough');
      expect(good.priorMean[seedSlot]).toBe(expected.mean);
      const nudged = (values: number[]): number[] =>
        values.map((value, slot) => (slot === seedSlot ? value + 1e-9 : value));
      expectIgnoredFor(list, { ...good, priorMean: nudged(good.priorMean) });
      expectIgnoredFor(list, { ...good, priorVar: nudged(good.priorVar) });
      // A placement slot marked as seed, or the other way round.
      const placedSlot = good.placedAt.findIndex((index) => index >= 0);
      expect(placedSlot).toBeGreaterThanOrEqual(0);
      const marked = (slot: number, value: number): number[] =>
        good.placedAt.map((index, s) => (s === slot ? value : index));
      expectIgnoredFor(list, { ...good, placedAt: marked(placedSlot, -1) });
      expectIgnoredFor(list, { ...good, placedAt: marked(seedSlot, 0) });
    });

    function expectIgnoredFor(list: EngineList, snapshot: EngineSnapshot): void {
      expect(validateSnapshot(list, snapshot)).toBeNull();
      const started = replayWithStats(list, { snapshot });
      expect(started.fromEvent).toBe(0);
      expectSameState(started.state, replay(list));
      expect(new EngineSession(list, { snapshot }).lastRebuild.fromEvent).toBe(0);
    }
  });
});

describe('a snapshot ending in a drag (ruling W2)', () => {
  const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };
  const events: RankingEvent[] = [
    { ...base, id: 'a', kind: 'pair', leftItemId: 'i0', rightItemId: 'i3', outcome: 'left' },
    {
      ...base,
      id: 'b',
      kind: 'placement',
      itemId: 'i5',
      aboveItemId: 'i1',
      belowItemId: 'i2',
    },
    { ...base, id: 'c', kind: 'pair', leftItemId: 'i5', rightItemId: 'i4', outcome: 'right' },
    {
      ...base,
      id: 'd',
      kind: 'placement',
      itemId: 'i4',
      aboveItemId: 'i0',
      belowItemId: 'i1',
    },
  ];
  const list: EngineList = {
    originalItemIds: ['i0', 'i1', 'i2', 'i3', 'i4', 'i5'],
    startingOrder: 'ranked',
    events,
  };
  const good = snapshotAt(list, events.length);
  const displaced = good.displaced as NonNullable<EngineSnapshot['displaced']>;

  function expectIgnored(snapshot: unknown, against: EngineList = list): void {
    expect(validateSnapshot(against, snapshot)).toBeNull();
    expect(replayWithStats(against, { snapshot }).fromEvent).toBe(0);
  }

  it("carries the dragged item's earlier prior and tie position", () => {
    // i4 (slot 4) still had its seed prior.
    const before = snapshotAt(list, events.length - 1);
    const seed = seedPrior(4, 6, 'ranked');
    expect(before.priorMean[4]).toBe(seed.mean);
    expect(displaced).toEqual({
      priorMean: seed.mean,
      priorVar: seed.variance,
      tieIndex: before.tieOrder.indexOf(4),
    });
    expect(validateSnapshot(list, good)).toEqual(good);
    expect(snapshotAt(list, events.length - 1).displaced).toBeUndefined();
  });

  it('ignored when the record does not fit the events', () => {
    expectIgnored({ ...good, displaced: { ...displaced, priorMean: displaced.priorMean + 1e-9 } });
    expectIgnored({ ...good, displaced: { ...displaced, priorVar: 0 } });
    expectIgnored({ ...good, displaced: { ...displaced, priorMean: Number.NaN } });
    for (const tieIndex of [-1, 6, 0.5, '4', undefined])
      expectIgnored({ ...good, displaced: { ...displaced, tieIndex } });
    for (const junk of [null, 0, 'x', []]) expectIgnored({ ...good, displaced: junk });
    // Present when the last covered event is not an applied drag.
    const longer = {
      ...list,
      events: [
        ...events,
        {
          ...base,
          id: 'e',
          kind: 'pair',
          leftItemId: 'i0',
          rightItemId: 'i1',
          outcome: 'left',
        } as RankingEvent,
      ],
    };
    expectIgnored({ ...snapshotAt(longer, longer.events.length), displaced }, longer);
  });

  it('an earlier prior from a drag is any finite prior, since only a fit could check it', () => {
    const again = {
      ...list,
      events: [
        ...events,
        {
          ...base,
          id: 'e',
          kind: 'placement',
          itemId: 'i5',
          aboveItemId: 'i3',
        } as RankingEvent,
      ],
    };
    const snapshot = snapshotAt(again, again.events.length);
    expect(snapshot.displaced?.priorMean).not.toBe(seedPrior(5, 6, 'ranked').mean);
    expect(validateSnapshot(again, snapshot)).toEqual(snapshot);
  });

  // i5's prior before the last event came from the earlier drag, so only the record can give it back.
  const again: EngineList = {
    ...list,
    events: [...events, { ...base, id: 'e', kind: 'placement', itemId: 'i5', aboveItemId: 'i3' }],
  };

  it('undo of a placement is warm from the in-memory undo snapshot, which needs no record', () => {
    const before = replay(prefixOf(again, events.length));
    expect(before.priorSource.get('i5')).toBe('placement');

    const appended = new EngineSession(prefixOf(again, events.length));
    appended.append(again.events[events.length] as RankingEvent);
    expectSameState(appended.undo(), before);
    expect(appended.lastRebuild).toEqual({ fromEvent: events.length, fits: 0, fromSnapshot: true });
  });

  it('undo of a placement restores the displaced prior warm from a persisted snapshot, and only with the record', () => {
    const before = replay(prefixOf(again, events.length));
    const snapshot = snapshotAt(again, again.events.length);
    expect(snapshot.displaced).toBeDefined();

    const opened = new EngineSession(again, { snapshot });
    expect(opened.lastRebuild.fromEvent).toBe(again.events.length);
    expectSameState(opened.undo(), before);
    expect(opened.lastRebuild).toEqual({ fromEvent: events.length, fits: 0, fromSnapshot: true });

    // Without the record the same snapshot cannot give the prior back, so the undo is not warm.
    const { displaced: _dropped, ...without } = snapshot;
    const withoutRecord = new EngineSession(again, { snapshot: without });
    expectSameState(withoutRecord.undo(), before);
    expect(withoutRecord.lastRebuild.fromSnapshot).toBe(false);
  });

  it('accepted without the record, which only a session undone from an opened one exports', () => {
    const { displaced: _dropped, ...without } = good;
    expect(validateSnapshot(list, without)).toEqual(without);
    const started = replayWithStats(list, { snapshot: without });
    expect(started.fromEvent).toBe(events.length);
    expectSameState(started.state, replay(list));
  });
});
