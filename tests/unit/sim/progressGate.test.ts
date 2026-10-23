import { describe, expect, it } from 'vitest';

import { disorderOfState, levelOf } from '@/lib/ranking/bt/progress';
import type { UserModel } from '@/tests/helpers/simUser';
import { runScenario, type Scenario } from '@/tests/sim/driver';
import { measure } from '@/tests/sim/measures';

/**
 * Holds each progress level to what its wording says (docs/ARCHITECTURE.md 6.12), on
 * the real engine. Every user model plays a list of 60 items from an unordered
 * and from a rough start, and from a rough start whose sections are reversed;
 * once every item has been compared, the true share of items within 5% of their
 * place is read at every tenth answer, grouped by the level the app would show.
 * An engine change that moves the disorder, or the levels, so that a level
 * claims more than the simulation supports fails here; see
 * docs/engine-calibration.md, "Progress levels", for the full run behind the floors.
 */
const MODELS: readonly UserModel[] = ['careful', 'typical', 'fuzzy', 'sloppy'];
const N = 60;
const TIMEOUT = 300000;

interface Point {
  level: number;
  within5: number;
}

function play(
  model: UserModel,
  start: 'unordered' | 'rough',
  quality: Scenario['quality'],
  seed: number,
  n = N,
) {
  const scenario: Scenario = {
    name: `progress-gate-${model}-${start}-${quality}-n${n}`,
    tags: [],
    n,
    startingOrder: start,
    truth: 'uniform',
    quality,
    model,
    strong: 'often',
    budgetAnswers: 6 * n,
  };
  const points: Point[] = [];
  const seen = new Set<string>();
  const step = n < 26 ? 2 : 10;
  let answers = 0;
  runScenario(scenario, seed, ({ event, answer, state, world }) => {
    if (!answer) return;
    answers++;
    if (event.kind === 'pair') {
      seen.add(event.leftItemId);
      seen.add(event.rightItemId);
    }
    if (answers % step !== 0 || !state.ranked.every((id) => seen.has(id))) return;
    const disorder = disorderOfState(state);
    if (disorder === null) return;
    points.push({
      level: levelOf(disorder, n),
      within5: measure(state.ranked, world.truthOver(state.ranked)).within5,
    });
  });
  return points;
}

function collect(
  runs: readonly (readonly [UserModel, 'unordered' | 'rough', Scenario['quality'], number])[],
  n = N,
) {
  return runs.flatMap(([model, start, quality, seed]) => play(model, start, quality, seed, n));
}

const mean = (points: Point[]) => points.reduce((sum, p) => sum + p.within5, 0) / points.length;
const shareBelow = (points: Point[], floor: number) =>
  points.filter((p) => p.within5 < floor).length / points.length;
const atLevel = (points: Point[], level: number) => points.filter((p) => p.level === level);

describe('the progress levels match the simulation', () => {
  const ordinary = collect(
    MODELS.flatMap((model) =>
      (['unordered', 'rough'] as const).flatMap((start) =>
        [1, 2, 3].map((seed) => [model, start, 'honest', seed] as const),
      ),
    ),
  );
  const reversed = collect(MODELS.map((model) => [model, 'rough', 'reversedSections', 1] as const));

  it(
    'has enough checkpoints at each level to judge it',
    () => {
      for (const level of [0, 1, 2, 3]) {
        expect(atLevel(ordinary, level).length, `level ${level}`).toBeGreaterThanOrEqual(20);
      }
    },
    TIMEOUT,
  );

  it(
    '"Changes from here should be small" is true: nearly always at least 90% of items near their place',
    () => {
      for (const points of [ordinary, reversed]) {
        const top = atLevel(points, 3);
        expect(top.length).toBeGreaterThan(0);
        expect(mean(top)).toBeGreaterThanOrEqual(0.95);
        expect(shareBelow(top, 0.9)).toBeLessThanOrEqual(0.06);
      }
    },
    TIMEOUT,
  );

  it(
    '"Close" is true: nearly always at least 85% of items near their place',
    () => {
      for (const points of [ordinary, reversed]) {
        const close = atLevel(points, 2);
        expect(close.length).toBeGreaterThan(0);
        expect(mean(close)).toBeGreaterThanOrEqual(0.9);
        expect(shareBelow(close, 0.85)).toBeLessThanOrEqual(0.12);
      }
    },
    TIMEOUT,
  );

  it(
    '"Taking shape" is better than "Rough order", and the levels rise with the accuracy',
    () => {
      const means = [0, 1, 2, 3].map((level) => mean(atLevel(ordinary, level)));
      expect(means[1]).toBeGreaterThanOrEqual(0.6);
      expect(means[0]).toBeLessThan(means[1]!);
      expect(means[1]).toBeLessThan(means[2]!);
      expect(means[2]).toBeLessThanOrEqual(means[3]! + 0.02);
    },
    TIMEOUT,
  );
});

describe('the progress levels match the simulation for short lists', () => {
  const runs = MODELS.flatMap((model) =>
    (['unordered', 'rough'] as const).flatMap((start) =>
      [1, 2, 3, 4, 5].map((seed) => [model, start, 'honest', seed] as const),
    ),
  );
  // Lists of 10 and 20 items, where the window is one place.
  const short = [...collect(runs, 10), ...collect(runs, 20)];

  it(
    'has the levels that can be judged, and the top two hold their words',
    () => {
      const top = atLevel(short, 3);
      const close = atLevel(short, 2);
      expect(top.length).toBeGreaterThanOrEqual(20);
      expect(close.length).toBeGreaterThanOrEqual(20);
      expect(mean(top)).toBeGreaterThanOrEqual(0.95);
      expect(shareBelow(top, 0.9)).toBeLessThanOrEqual(0.06);
      expect(mean(close)).toBeGreaterThanOrEqual(0.9);
      expect(shareBelow(close, 0.85)).toBeLessThanOrEqual(0.12);
    },
    TIMEOUT,
  );

  it(
    'rises with the accuracy',
    () => {
      const means = [0, 1, 2, 3].map((level) => mean(atLevel(short, level)));
      expect(means[1]).toBeGreaterThanOrEqual(0.6);
      expect(means[0]).toBeLessThan(means[1]!);
      expect(means[1]).toBeLessThan(means[2]!);
      expect(means[2]).toBeLessThanOrEqual(means[3]! + 0.02);
    },
    TIMEOUT,
  );
});
