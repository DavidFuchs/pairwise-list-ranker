import { describe, expect, it, vi } from 'vitest';

import { REPEAT_FACTOR } from '@/lib/ranking/bt/constants';
import { pairKey, type PickerInput } from '@/lib/ranking/bt/picker';
import { makeBehaviour } from '@/tests/sim/behaviours';
import { runScenario } from '@/tests/sim/driver';
import { adjacentPicker } from '@/tests/sim/pickers';
import { scenarios } from '@/tests/sim/scenarios';
import type { World } from '@/tests/sim/truth';
import type { RankingEvent } from '@/types/rankingEvents';

type Picker = Pick<typeof import('@/lib/ranking/bt/picker'), 'pickPair'>;

/** The picker the engine uses in this file: the real one while `use` is null. */
const chosen = vi.hoisted(() => ({ use: null as Picker | null }));

// A switch in this file only, so that one test can play the same scenario and
// seed under both pickers. The sim config's own seam is SIM_PICKER, in
// tests/sim/setup.ts.
vi.mock('@/lib/ranking/bt/picker', async (original) => {
  const real = await original<typeof import('@/lib/ranking/bt/picker')>();
  const current = (): Picker => chosen.use ?? real;
  return {
    ...real,
    pickPair: (input: PickerInput) => current().pickPair(input),
  };
});

/**
 * A picker input over the given slots in displayed order, with `u[p]` the
 * uncertainty of the slot shown at position p. The slots are not in slot order,
 * so a picker that returned positions would fail.
 */
function inputOf(
  order: number[],
  u: number[],
  extra: { shown?: [number, number, number][]; previousPair?: number } = {},
): PickerInput {
  const size = Math.max(...order) + 1;
  const uncertainty = new Float64Array(size);
  order.forEach((slot, p) => {
    uncertainty[slot] = u[p] as number;
  });
  const shown = new Map((extra.shown ?? []).map(([a, b, times]) => [pairKey(a, b), times]));
  return { order, strengths: new Float64Array(size), uncertainty, shown, previousPair: extra.previousPair };
}

// Exact in binary, so ties are ties. Adjacent sums by position: 0.75, 1.5, 1.375, 0.625, 0.875,
// 1.375, 0.875.
const order = [3, 0, 6, 1, 7, 2, 5, 4];
const u = [0.25, 0.5, 1, 0.375, 0.25, 0.625, 0.75, 0.125];

describe('the adjacent picker', () => {
  it('asks the neighbours with the largest summed uncertainty, as slots', () => {
    expect(adjacentPicker.pickPair(inputOf(order, u))).toEqual([0, 6]);
  });

  it('gives ties to the higher-ranked position', () => {
    expect(
      adjacentPicker.pickPair(
        inputOf(
          order,
          u.map(() => 1),
        ),
      ),
    ).toEqual([3, 0]);
    // Once [0, 6] is shown, positions 2-3 and 5-6 tie at 1.375: the higher one wins.
    expect(adjacentPicker.pickPair(inputOf(order, u, { shown: [[6, 0, 1]] }))).toEqual([6, 1]);
  });

  it('scores a pair shown once at REPEAT_FACTOR (0.3) times its summed uncertainty', () => {
    expect(REPEAT_FACTOR).toBe(0.3);
    // The shown pair [10, 11] sums to 2 and so scores 0.6; the pair [12, 13] scores just under or over that.
    const just = (gap: number): PickerInput =>
      inputOf([10, 11, 12, 13], [1.9, 0.1, 0.01, 2 * REPEAT_FACTOR - 0.01 + gap], { shown: [[10, 11, 1]] });
    expect(adjacentPicker.pickPair(just(-0.01))).toEqual([10, 11]);
    expect(adjacentPicker.pickPair(just(0.01))).toEqual([12, 13]);
  });

  it('never asks the previous pair', () => {
    expect(adjacentPicker.pickPair(inputOf(order, u, { previousPair: pairKey(0, 6) }))).toEqual([6, 1]);
    expect(adjacentPicker.pickPair(inputOf([4, 9], [1, 1], { previousPair: pairKey(9, 4) }))).toBeNull();
  });

  it('has no pair under 2 offerable slots', () => {
    const four = inputOf([3, 0, 6, 1], [0.25, 0.5, 1, 0.375]);
    expect(adjacentPicker.pickPair(four)).toEqual([0, 6]);
    const one = inputOf([2], [1]);
    expect(adjacentPicker.pickPair(one)).toBeNull();
  });
});

describe('seeds under either picker', () => {
  it('give the same world, the same starting history and answer-aligned user noise', () => {
    const scenario = { ...scenarios('ci').find((s) => s.name === 'typical-rough-n60')!, budgetAnswers: 60 };
    const play = (picker: Picker | null) => {
      chosen.use = picker;
      const events: RankingEvent[] = [];
      let world: World | null = null;
      try {
        runScenario(scenario, 2, (step) => {
          world ??= step.world;
          events.push(step.event);
        });
      } finally {
        chosen.use = null;
      }
      const ranks = new Map(world!.ids.slice(0, 10).map((id) => [id, world!.trueRank(id)]));
      return { world: world!, ranks, events };
    };
    const strip = (event: RankingEvent) => JSON.stringify({ ...event, id: undefined, createdAt: undefined });
    const current = play(null);
    const adjacent = play(adjacentPicker);

    // The same world, drawn from the seed alone.
    expect(adjacent.ranks).toEqual(current.ranks);
    // The same starting history: both pickers open with the same question and the same answer.
    expect(strip(adjacent.events[0]!)).toBe(strip(current.events[0]!));
    // The pickers really differ later in the run.
    expect(adjacent.events.map(strip)).not.toEqual(current.events.map(strip));

    // Answer-aligned noise: replay each run's first k answers into a user with one seed, then ask
    // both the same close pair as answer k + 1. Their perception of it is the same.
    const world = current.world;
    const close = [...world.ids].sort((a, b) => world.trueRank(a) - world.trueRank(b)).slice(20, 22);
    const userAfter = (events: RankingEvent[], k: number) => {
      const user = makeBehaviour({
        model: scenario.model,
        strong: scenario.strong,
        seed: 7,
        world,
      });
      let given = 0;
      for (const event of events) {
        if (given === k) break;
        if (event.kind !== 'pair') continue;
        user.pair(event.leftItemId, event.rightItemId, true);
        given++;
      }
      return user;
    };
    const answersOf = (events: RankingEvent[], k: number) =>
      events
        .filter((e) => e.kind === 'pair')
        .slice(0, k)
        .map(strip);
    const ks = [1, 5, 10, 20, 30, 40, 50, 59];
    expect(answersOf(adjacent.events, 59)).not.toEqual(answersOf(current.events, 59));
    const seen = ks.map((k) => {
      const a = userAfter(current.events, k).pair(close[0]!, close[1]!, true);
      expect(userAfter(adjacent.events, k).pair(close[0]!, close[1]!, true), `answer ${k + 1}`).toEqual(a);
      return a;
    });
    // The pair is close enough that the noise shows: not every answer sees the same outcome.
    expect(new Set(seen).size).toBeGreaterThan(1);
  }, 120_000);
});
