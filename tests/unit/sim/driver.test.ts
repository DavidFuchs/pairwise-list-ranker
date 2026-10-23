import { describe, expect, it } from 'vitest';

import { runScenario, type DriverStep, type Scenario } from '@/tests/sim/driver';
import { measure } from '@/tests/sim/measures';
import type { RankingEvent } from '@/types/rankingEvents';

const TIMEOUT = 120000;

const base: Scenario = {
  name: 'small',
  n: 30,
  startingOrder: 'unordered',
  truth: 'uniform',
  quality: 'honest',
  model: 'typical',
  strong: 'often',
  budgetAnswers: 4 * 30,
};

function scenario(overrides: Partial<Scenario>): Scenario {
  const n = overrides.n ?? base.n;
  return { ...base, budgetAnswers: 4 * n, ...overrides };
}

/** Runs a scenario and keeps every step, with the number of visible items when each was taken. */
function steps(
  s: Scenario,
  seed = 1,
): { trace: ReturnType<typeof runScenario>; seen: (DriverStep & { visibleBefore: number })[] } {
  const seen: (DriverStep & { visibleBefore: number })[] = [];
  let visible = s.n;
  const trace = runScenario(s, seed, (step) => {
    seen.push({ ...step, visibleBefore: visible });
    visible = step.state.ranked.length;
  });
  return { trace, seen };
}

const answerKinds = (seen: DriverStep[]): RankingEvent['kind'][] =>
  seen.filter((step) => step.answer).map((step) => step.event.kind);

describe('runScenario', () => {
  it(
    'gives an identical trace for the same scenario and seed',
    () => {
      const s = scenario({
        extras: {
          markShare: 0.1,
          wrongMoveEvery: 10,
          correctAfter: 3,
          multiMoveEvery: { answers: 30, count: 3 },
        },
      });
      expect(runScenario(s, 2)).toEqual(runScenario(s, 2));
      // Whole traces differ in Trace.seed anyway, so compare what the seed drives.
      expect(runScenario(s, 2).samples).not.toEqual(runScenario(s, 3).samples);
    },
    TIMEOUT,
  );

  it(
    'asks only pairs, whatever the list size',
    () => {
      for (const n of [4, 8, 30]) {
        const kinds = answerKinds(steps(scenario({ n })).seen);
        expect(kinds, `n = ${n}`).toHaveLength(4 * n);
        expect(new Set(kinds), `n = ${n}`).toEqual(new Set(['pair']));
      }
    },
    TIMEOUT,
  );

  it(
    'asks pairs only even when most items are marked, and ends on a pair',
    () => {
      const { trace, seen } = steps(scenario({ extras: { markShare: 0.9 } }));
      for (const step of seen.filter((s) => s.answer)) expect(step.event.kind).toBe('pair');
      expect(trace.samples.at(-1)!.asked).toBe('pairs');
    },
    TIMEOUT,
  );

  it(
    'never gives a group answer nor reads a group question',
    () => {
      const { seen } = steps(scenario({}));
      // Read as a plain string: no event type has a group any more.
      expect(seen.some((step) => (step.event.kind as string) === 'group')).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'stops with the samples so far when no question is left',
    () => {
      // Two items: once their pair is answered the picker will not repeat it, so nothing is left to ask.
      const two = runScenario(scenario({ n: 2 }), 1);
      expect(two.samples.map((s) => s.answers)).toEqual([0, 1]);
      // Every item marked, one before each answer, until too few are shown to ask anything.
      const { trace, seen } = steps(scenario({ extras: { markShare: 1 } }));
      const answered = seen.filter((step) => step.answer).length;
      expect(answered).toBeLessThan(120);
      expect(trace.samples.length).toBeLessThan(17);
      expect(trace.samples.at(-1)!.answers).toBeLessThanOrEqual(answered);
      const last = seen.at(-1)!.state;
      expect(last.nextPair).toBeNull();
    },
    TIMEOUT,
  );

  it(
    'scores only the items the ranking shows, not the marked ones',
    () => {
      const { trace, seen } = steps(scenario({ extras: { markShare: 0.3 } }));
      const last = seen.at(-1)!;
      const { ranked, unrecognized } = last.state;
      expect(unrecognized).toHaveLength(9);
      const final = trace.samples.at(-1)!;
      expect(final.measures).toEqual(measure(ranked, last.world.truthOver(ranked)));
      expect(final.measures.within5).toBeGreaterThanOrEqual(0.8);
      // Scored with the marked items at the bottom, as the app shows them, the share would fall below that.
      const all = [...ranked, ...unrecognized];
      expect(measure(all, last.world.truthOver(all)).within5).toBeLessThan(0.8);
    },
    TIMEOUT,
  );

  it(
    'takes a sample at answer 0, then one every n / 4 answers: 17 for a budget of 4n, none duplicated',
    () => {
      // n / 4 is 7.5 here: the k-th sample is at round(7.5 k), so the quarters do not drift.
      const { samples } = runScenario(scenario({}), 1);
      expect(samples).toHaveLength(17);
      expect(samples.map((s) => s.answers)).toEqual([
        0,
        ...Array.from({ length: 16 }, (_, i) => Math.round(((i + 1) * 30) / 4)),
      ]);
      expect(samples.at(-1)!.answers).toBe(120);
      expect(new Set(samples.map((s) => s.answers)).size).toBe(17);
    },
    TIMEOUT,
  );

  it(
    'ends on the budget when it is not a whole number of quarters',
    () => {
      const { samples } = runScenario(scenario({ budgetAnswers: 20 }), 1);
      expect(samples.map((s) => s.answers)).toEqual([0, 8, 15, 20]);
    },
    TIMEOUT,
  );

  it(
    'gives a null gate when the budget is too small to reach 0.9',
    () => {
      const trace = runScenario(scenario({ budgetAnswers: 8 }), 1);
      expect(trace.samples.every((s) => s.measures.within5 < 0.9)).toBe(true);
      expect(trace.answersToGate).toBeNull();
    },
    TIMEOUT,
  );

  it(
    'gives the gate at a dense sample, earlier than the quarter samples alone would',
    () => {
      const s = scenario({ budgetAnswers: 8 * 30 });
      // Dense samples every round(30 / 20) = 2 answers, from answer 0.
      let earlier = 0;
      for (const seed of [1, 2, 3]) {
        const within5At = new Map<number, number>();
        let answers = 0;
        const trace = runScenario(s, seed, (step) => {
          if (!step.answer) return;
          answers++;
          const { ranked } = step.state;
          within5At.set(answers, measure(ranked, step.world.truthOver(ranked)).within5);
        });
        // The gate is checked at every dense sample and at every quarter sample (answer 15 is one).
        const quarters = new Set(trace.samples.map((q) => q.answers));
        const gate =
          [...within5At].find(([at, within5]) => (at % 2 === 0 || quarters.has(at)) && within5 >= 0.9)?.[0] ??
          null;
        expect(gate).not.toBeNull();
        expect(trace.answersToGate).toBe(gate);
        const quarterGate = trace.samples.find((q) => q.measures.within5 >= 0.9)?.answers ?? null;
        expect(quarterGate).not.toBeNull();
        expect(trace.answersToGate!).toBeLessThanOrEqual(quarterGate!);
        if (trace.answersToGate! < quarterGate!) earlier++;
      }
      // The check bites: in at least one seed the dense sampling alone found the gate first.
      expect(earlier).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'counts marks and moves as changes but not answers',
    () => {
      const { trace, seen } = steps(
        scenario({
          extras: {
            markShare: 0.1,
            wrongMoveEvery: 10,
            correctAfter: 3,
            multiMoveEvery: { answers: 30, count: 3 },
          },
        }),
      );
      const kinds = new Set(seen.filter((step) => !step.answer).map((step) => step.event.kind));
      expect(kinds).toEqual(new Set(['unrecognized', 'placement']));
      // No removals or additions are simulated, and each placement moves one item.
      for (const step of seen) {
        if (step.event.kind === 'placement') expect(typeof step.event.itemId).toBe('string');
      }
      const final = trace.samples.at(-1)!;
      expect(final.answers).toBe(120);
      expect(final.changes).toBe(seen.length);
      expect(final.changes).toBeGreaterThan(final.answers);
    },
    TIMEOUT,
  );

  it(
    'makes multiMoveEvery as count separate single-target placements in a row, each between its true neighbours',
    () => {
      const { seen } = steps(scenario({ extras: { multiMoveEvery: { answers: 30, count: 3 } } }));
      let answers = 0;
      let shownBefore: readonly string[] = [];
      const groups: { at: number; moved: string[] }[] = [];
      let checked = 0;
      for (const step of seen) {
        if (step.answer) answers++;
        else if (step.event.kind === 'placement') {
          const target = step.event;
          const last = groups.at(-1);
          if (last && last.at === answers) last.moved.push(target.itemId);
          else groups.push({ at: answers, moved: [target.itemId] });
          // Each item sits between its true neighbours in the order shown just before it.
          const others = shownBefore.filter((id) => id !== target.itemId);
          const place = others.filter(
            (id) => step.world.trueRank(id) < step.world.trueRank(target.itemId),
          ).length;
          expect(target.aboveItemId).toBe(others[place - 1]);
          expect(target.belowItemId).toBe(others[place]);
          checked++;
        }
        shownBefore = step.state.ranked;
      }
      // After answers 30, 60 and 90; the one after 120 never comes, the budget is spent.
      expect(groups.map((g) => g.at)).toEqual([30, 60, 90]);
      for (const g of groups) {
        expect(g.moved).toHaveLength(3);
        expect(new Set(g.moved).size).toBe(3);
      }
      expect(checked).toBe(9);
    },
    TIMEOUT,
  );

  it(
    'corrects each wrong move correctAfter answers later, between its true neighbours',
    () => {
      const { seen } = steps(scenario({ extras: { wrongMoveEvery: 10, correctAfter: 3 } }));
      let answers = 0;
      let shownBefore: readonly string[] = [];
      const moves: { itemId: string; at: number; shown: readonly string[]; event: RankingEvent }[] = [];
      for (const step of seen) {
        if (step.answer) answers++;
        else if (step.event.kind === 'placement') {
          moves.push({
            itemId: step.event.itemId,
            at: answers,
            shown: shownBefore,
            event: step.event,
          });
        }
        shownBefore = step.state.ranked;
      }
      // Wrong moves after answers 10, 20, ..., 110; the one after 120 never comes, the budget is spent.
      expect(moves).toHaveLength(22);
      for (let k = 0; k < moves.length; k += 2) {
        const wrong = moves[k]!;
        const fix = moves[k + 1]!;
        expect(wrong.at).toBe(10 * (k / 2 + 1));
        expect(fix.itemId).toBe(wrong.itemId);
        expect(fix.at).toBe(wrong.at + 3);
        const world = seen[0]!.world;
        const others = fix.shown.filter((id) => id !== fix.itemId);
        const place = others.filter((id) => world.trueRank(id) < world.trueRank(fix.itemId)).length;
        const target = fix.event.kind === 'placement' ? fix.event : null;
        expect(target?.aboveItemId).toBe(others[place - 1]);
        expect(target?.belowItemId).toBe(others[place]);
      }
    },
    TIMEOUT,
  );

  it(
    'samples before the first question, and a list already at the gate reports 0',
    () => {
      const sorted = runScenario(scenario({ startingOrder: 'ranked', budgetAnswers: 60 }), 1);
      expect(sorted.samples[0]!.answers).toBe(0);
      expect(sorted.samples[0]!.changes).toBe(0);
      expect(sorted.samples[0]!.measures.within5).toBeGreaterThanOrEqual(0.9);
      expect(sorted.answersToGate).toBe(0);
      const shuffled = runScenario(scenario({ n: 50, budgetAnswers: 100 }), 1);
      expect(shuffled.samples[0]!.answers).toBe(0);
      expect(shuffled.samples[0]!.measures.within5).toBeLessThan(0.9);
    },
    TIMEOUT,
  );

  it(
    'does not hang on an empty list',
    () => {
      const trace = runScenario(scenario({ n: 0, budgetAnswers: 0 }), 1);
      expect(trace.samples.map((sample) => sample.answers)).toEqual([0]);
    },
    TIMEOUT,
  );

  describe('probeMoves', () => {
    for (const n of [30, 45]) {
      it(
        `makes three far moves and records where each stands, n = ${n}`,
        () => {
          const { trace, seen } = steps(
            scenario({ n, extras: { probeMoves: { every: 20, count: 3, kind: 'far' } } }),
          );
          expect(trace.probes).toHaveLength(3);
          const budget = 4 * n;
          for (const probe of trace.probes) {
            expect(probe.kind).toBe('far');
            expect(probe.displacementAtMove).toBeGreaterThan(0.25);
            if (probe.atAnswer + 2 * n <= budget) {
              expect(typeof probe.displacementAfter2n).toBe('number');
            } else {
              expect(probe.displacementAfter2n).toBeNull();
            }
            // Made at answer n or later, so a further 4n or 8n never fits a budget of 4n.
            expect(probe.displacementAfter4n).toBeNull();
            expect(probe.displacementAfter8n).toBeNull();
          }
          // Moves are changes but not answers.
          const moves = seen.filter((step) => !step.answer && step.event.kind === 'placement');
          expect(moves).toHaveLength(3);
          expect(seen.filter((step) => step.answer)).toHaveLength(budget);
        },
        TIMEOUT,
      );
    }

    it(
      'leaves a null for a probe whose 2n answers do not fit, and a number for one that does',
      () => {
        const { probes } = runScenario(
          scenario({ extras: { probeMoves: { every: 20, count: 3, kind: 'far' } } }),
          1,
        );
        expect(probes.some((p) => p.displacementAfter2n === null)).toBe(true);
        expect(probes.some((p) => typeof p.displacementAfter2n === 'number')).toBe(true);
      },
      TIMEOUT,
    );

    it(
      'records the displacement after 2n, 4n and 8n answers, by the same rule, or null when the run ends first',
      () => {
        const n = 30;
        // Probes at 30, 50 and 70; a budget of 9n = 270 fits every 2n and 4n horizon but only the first 8n one.
        const { trace, seen } = steps(
          scenario({ n, budgetAnswers: 9 * n, extras: { probeMoves: { every: 20, count: 3, kind: 'far' } } }),
        );
        expect(trace.probes).toHaveLength(3);
        // The state right after the answer that brought the count to `due`.
        const afterAnswer = new Map<number, DriverStep>();
        let given = 0;
        for (const step of seen) {
          if (!step.answer) continue;
          given++;
          afterAnswer.set(given, step);
        }
        const displacementAt = (itemId: string, due: number): number | null => {
          const step = afterAnswer.get(due);
          if (!step) return null;
          const shown = step.state.ranked;
          if (!shown.includes(itemId)) return null;
          const place = shown.indexOf(itemId) + 1;
          const [low, high] = step.world.truthOver(shown).span(itemId);
          const distance = place < low ? low - place : place > high ? place - high : 0;
          return distance / shown.length;
        };
        for (const probe of trace.probes) {
          expect(probe.displacementAfter2n).toBe(displacementAt(probe.itemId, probe.atAnswer + 2 * n));
          expect(probe.displacementAfter4n).toBe(displacementAt(probe.itemId, probe.atAnswer + 4 * n));
          expect(probe.displacementAfter8n).toBe(displacementAt(probe.itemId, probe.atAnswer + 8 * n));
        }
        expect(trace.probes.map((p) => typeof p.displacementAfter4n)).toEqual(['number', 'number', 'number']);
        expect(trace.probes.map((p) => p.displacementAfter8n === null)).toEqual([false, true, true]);
      },
      TIMEOUT,
    );

    it(
      'makes near moves that stay within 2% of the list of the true place',
      () => {
        const { trace, seen } = steps(
          scenario({ n: 50, extras: { probeMoves: { every: 20, count: 3, kind: 'near' } } }),
        );
        expect(trace.probes).toHaveLength(3);
        const shownCount = seen.at(-1)!.state.ranked.length;
        for (const probe of trace.probes) {
          expect(probe.kind).toBe('near');
          expect(probe.displacementAtMove).toBeLessThanOrEqual(0.02 + 1 / shownCount);
        }
      },
      TIMEOUT,
    );

    it(
      'counts no skipped probe when every move could be made',
      () => {
        const trace = runScenario(
          scenario({ extras: { probeMoves: { every: 20, count: 3, kind: 'far' } } }),
          1,
        );
        expect(trace.probes).toHaveLength(3);
        expect(trace.probesSkipped).toBe(0);
      },
      TIMEOUT,
    );

    it(
      'counts a probe it could not make as skipped: in a small tied list no place is far from the truth',
      () => {
        // A list of two never gets this far: its one pair cannot be asked twice in a row, so it stops after one answer.
        const trace = runScenario(
          scenario({ n: 4, truth: 'tied', extras: { probeMoves: { every: 6, count: 1, kind: 'far' } } }),
          1,
        );
        expect(trace.probes).toHaveLength(0);
        expect(trace.probesSkipped).toBeGreaterThan(0);
      },
      TIMEOUT,
    );

    it(
      'gives the same probes for the same seed',
      () => {
        const s = scenario({ extras: { probeMoves: { every: 20, count: 3, kind: 'far' } } });
        expect(runScenario(s, 4).probes).toEqual(runScenario(s, 4).probes);
      },
      TIMEOUT,
    );
  });
});
