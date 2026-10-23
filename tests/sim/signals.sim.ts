import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { runScenario } from '@/tests/sim/driver';
import type { UserModel } from '@/tests/helpers/simUser';
import type { Scenario } from '@/tests/sim/driver';
import { measure } from '@/tests/sim/measures';
import { expectedDisplacements, meanMovement, predictedWithin } from '@/tests/sim/signals';

/**
 * Records candidate progress signals next to the true accuracy, for choosing
 * what the app should show. For each user model, starting order, list size and
 * seed it plays 6n answers and, every n/10 answers, writes one row: the truth
 * (share of items within 5% of their true place, mean displacement, Kendall),
 * the answers per item, how many items have been compared at all, and each
 * signal. Rows go to SIGNALS_OUT (a JSON file); nothing in the repo changes.
 * SIGNALS_SIZES (comma separated, default 30,100,200) and SIGNALS_SEEDS
 * (default 3) limit a trial.
 */
const MODELS: readonly UserModel[] = ['careful', 'typical', 'fuzzy', 'sloppy'];
type Order = 'unordered' | 'rough' | 'ranked';
type Quality = 'honest' | 'loose' | 'reversedSections';

/** A pairs-only run of one user model on an honest, uniform list, played well past the gate. */
function scenarioFor(model: UserModel, order: Order, quality: Quality, n: number): Scenario {
  return {
    name: `signals-${model}-${order}-${quality}-n${n}`,
    tags: [],
    n,
    startingOrder: order,
    truth: 'uniform',
    quality,
    model,
    strong: 'often',
    budgetAnswers: 6 * n,
  };
}

const sizes = (process.env.SIGNALS_SIZES ?? '30,100,200').split(',').map(Number);
const orders = (process.env.SIGNALS_ORDERS ?? 'unordered,rough').split(',') as Order[];
const qualities = (process.env.SIGNALS_QUALITY ?? 'honest').split(',') as Quality[];
const seedsText = process.env.SIGNALS_SEEDS ?? '3';
const seeds = seedsText.includes(',')
  ? seedsText.split(',').map(Number)
  : Array.from({ length: Number(seedsText) }, (_, k) => k + 1);
const messy = process.env.SIGNALS_MESSY === '1';
const out = process.env.SIGNALS_OUT;
if (out === undefined) throw new Error('SIGNALS_OUT must name the file to write');

/** Window lengths of the movement signal, as shares of n answers. */
const WINDOWS = [0.05, 0.1, 0.25];
/** Window lengths of the contradiction rate, as shares of n answers (at least 10 answers). */
const AGAINST_WINDOWS = [0.25, 0.5, 1];
/** Inflation of the engine's uncertainties in the model-based signal. */
const SCALES = [1, 4];

interface Row {
  model: string;
  messy: number;
  order: string;
  quality: string;
  n: number;
  seed: number;
  answers: number;
  perItem: number;
  /** Share of items that have been in at least one answered pair. */
  covered: number;
  within5: number;
  meanDisp: number;
  kendall: number;
  [signal: string]: number | string;
}
const rows: Row[] = [];

describe('progress signal evaluation', () => {
  it('records the rows', () => {
    for (const n of sizes) {
      for (const order of orders) {
        for (const quality of qualities) {
          for (const model of MODELS) {
            for (const seed of seeds) {
              const scenario = {
                ...scenarioFor(model, order, quality, n),
                ...(messy
                  ? {
                      extras: {
                        markShare: 0.1,
                        wrongMoveEvery: Math.round(n / 2),
                        correctAfter: Math.max(1, Math.round(n / 10)),
                        multiMoveEvery: { answers: n, count: 5 },
                      },
                    }
                  : {}),
              };
              const step = Math.max(1, Math.round(n / 10));
              let previous = new Map<string, number>();
              const moves: number[] = [];
              /** 1 when an answer went against the order shown just before it, 0 when with it; draws are left out. */
              const against: number[] = [];
              const seen = new Set<string>();
              let answers = 0;
              runScenario(scenario, seed, ({ event, answer, state, world }) => {
                if (!answer) return;
                answers++;
                if (event.kind === 'pair') {
                  seen.add(event.leftItemId);
                  seen.add(event.rightItemId);
                  if (event.outcome !== 'draw') {
                    const leftPlace = previous.get(event.leftItemId);
                    const rightPlace = previous.get(event.rightItemId);
                    if (leftPlace !== undefined && rightPlace !== undefined) {
                      const leftWon = event.outcome.startsWith('left');
                      against.push(leftWon === leftPlace > rightPlace ? 1 : 0);
                    }
                  }
                }
                const shown = state.ranked;
                moves.push(meanMovement(previous, shown));
                previous = new Map(shown.map((id, place) => [id, place]));
                if (answers % step !== 0) return;

                const truth = measure(shown, world.truthOver(shown));
                const row: Row = {
                  model,
                  messy: messy ? 1 : 0,
                  order,
                  quality,
                  n,
                  seed,
                  answers,
                  perItem: answers / n,
                  covered: shown.filter((id) => seen.has(id)).length / shown.length,
                  within5: truth.within5,
                  meanDisp: truth.mean / shown.length,
                  kendall: truth.kendall,
                };
                for (const w of WINDOWS) {
                  const k = Math.max(2, Math.round(w * n));
                  const recent = moves.slice(-k);
                  row[`move${w}`] = recent.reduce((a, b) => a + b, 0) / recent.length;
                }
                for (const w of AGAINST_WINDOWS) {
                  const recent = against.slice(-Math.max(10, Math.round(w * n)));
                  row[`against${w}`] =
                    recent.length === 0 ? 0 : recent.reduce((a, b) => a + b, 0) / recent.length;
                }
                const s = shown.map((id) => state.strengths.get(id) as number);
                const u = shown.map((id) => state.uncertainty.get(id) as number);
                const limit = Math.max(1, 0.05 * n);
                for (const scale of SCALES) {
                  const expected = expectedDisplacements(s, u, scale);
                  row[`pred5_x${scale}`] = predictedWithin(expected, limit);
                  row[`disorder_x${scale}`] =
                    expected.reduce((a, b) => a + b, 0) / shown.length / shown.length;
                }
                rows.push(row);
              });
            }
          }
        }
      }
    }
    expect(rows.length).toBeGreaterThan(0);
  });

  afterAll(() => {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(rows));
  });
});
