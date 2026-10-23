import type { UserModel } from '@/tests/helpers/simUser';
import type { Scenario } from '@/tests/sim/driver';
import type { StartingOrder } from '@/types/rankingEvents';

/**
 * The named scenarios of docs/ARCHITECTURE.md 11. Names are stable, because the calibrations compare
 * runs by name: change a scenario's settings under a new name, never in place.
 *
 * Each scenario's `tags` list the docs/ARCHITECTURE.md 11 items it covers (an empty list for
 * the base models and the pairs variants, apart from the typical unordered
 * base, which is the "Much better often" case: every scenario uses "Much
 * better" as the user model does unless it says otherwise).
 */

const BASE_MODELS: readonly UserModel[] = ['careful', 'typical', 'fuzzy', 'sloppy'];
const STARTS: readonly StartingOrder[] = ['unordered', 'rough', 'ranked'];

/** Every scenario may give eight answers per item (covers the 6n pair gate with room). */
const BUDGET_PER_ITEM = 8;

/** Share of the items marked "don't recognize". */
const MARK_SHARE = 0.25;
/** Entries moved one after another in each multi-move group. */
const MULTI_MOVE_COUNT = 5;

/** A base scenario: pairs only, a uniform truth, an honest import. */
function base(model: UserModel, startingOrder: StartingOrder, n: number): Scenario {
  return {
    name: `${model}-${startingOrder}-n${n}`,
    tags: [],
    n,
    startingOrder,
    truth: 'uniform',
    quality: 'honest',
    model,
    strong: 'often',
    budgetAnswers: BUDGET_PER_ITEM * n,
  };
}

/** Starting orders the calibration families run in. */
const CAL_STARTS: readonly StartingOrder[] = ['unordered', 'rough'];

/** The calibrations compare runs at n = 100 (the ci set's n = 60 mirrors it); the 400-item scenarios carry no calibration tag. */
const calibrates = (n: number): boolean => n !== 400;

/** The base models in every starting order; the typical unordered one also covers "Much better" often. */
function baseSet(n: number): Scenario[] {
  return BASE_MODELS.flatMap((model) =>
    STARTS.map((start) => {
      const scenario = base(model, start, n);
      const tags: string[] = [];
      if (model === 'typical' && start === 'unordered') tags.push('strongOften');
      scenario.tags = tags;
      return scenario;
    }),
  );
}

/**
 * The typical unordered scenario under its pairs name (the 6n pair gate).
 * It plays the same game as the base typical unordered one, now that every scenario asks pairs
 * only, and keeps its name and tag so the recorded pairs results stay comparable.
 */
function pairsSet(n: number): Scenario[] {
  return [
    {
      ...base('typical', 'unordered', n),
      name: `typical-unordered-pairs-n${n}`,
      tags: calibrates(n) ? ['cal-pairs'] : [],
    },
  ];
}

/**
 * The other base models under their pairs names, from the unordered and rough
 * starts. The typical unordered one is pairsSet's, so it is left out.
 */
function calPairsSet(n: number, models: readonly UserModel[] = BASE_MODELS): Scenario[] {
  return models.flatMap((model) =>
    CAL_STARTS.filter((start) => !(model === 'typical' && start === 'unordered')).map((start) => ({
      ...base(model, start, n),
      name: `${model}-${start}-pairs-n${n}`,
      tags: ['cal-pairs'],
    })),
  );
}

/** The three "Much better" habits asked pairs only, so the strong outcomes can be told apart. */
function strongPairsSet(n: number): Scenario[] {
  return (['often', 'rarely', 'inconsistent'] as const).map((strong) => ({
    ...base('typical', 'unordered', n),
    name: `typical-unordered-strong-${strong}-pairs-n${n}`,
    strong,
    tags: ['cal-strong'],
  }));
}

/** Probe moves made in each probe scenario, and the answers between them. */
const PROBE_COUNT = 6;
const PROBE_EVERY = 25;

/**
 * Probe moves after the first n answers: six moves, one every 25 answers, near
 * or far from the true place. The run lasts until a further 8n answers after
 * the last probe (n + 125 + 8n, 1025 answers at n = 100), not the usual 8n, so
 * every probe is measured at 2n, 4n and 8n. Up to 8n answers the run plays as
 * it would with a budget of 8n.
 */
function probeSet(n: number): Scenario[] {
  return (['near', 'far'] as const).map((kind) => ({
    ...base('typical', 'unordered', n),
    name: `typical-unordered-probe-${kind}-n${n}`,
    tags: ['cal-placement'],
    budgetAnswers: n + (PROBE_COUNT - 1) * PROBE_EVERY + BUDGET_PER_ITEM * n,
    extras: { probeMoves: { every: PROBE_EVERY, count: PROBE_COUNT, kind } },
  }));
}

/** A variant of the typical scenario, named `typical-<start>-<variant>-n<n>`. */
function variant(
  variantName: string,
  tag: string | string[],
  n: number,
  change: Partial<Scenario>,
): Scenario {
  const startingOrder = change.startingOrder ?? 'unordered';
  return {
    ...base('typical', startingOrder, n),
    ...change,
    name: `typical-${startingOrder}-${variantName}-n${n}`,
    tags: Array.isArray(tag) ? tag : [tag],
  };
}

/** The behaviour, truth, import, move and mark scenarios, each a typical user asked pairs only. */
function behaviourSet(n: number): Scenario[] {
  const half = Math.max(1, Math.round(n / 2));
  return [
    variant('strong-rarely', 'strongRarely', n, { strong: 'rarely' }),
    variant('strong-inconsistent', 'strongInconsistent', n, { strong: 'inconsistent' }),
    variant('ties', 'ties', n, { truth: 'tied' }),
    variant('gaps', 'gaps', n, { truth: 'gaps' }),
    // A loosely ordered list, and one with reversed sections, each declared "Ranked best to worst".
    variant('loose', 'looseImport', n, { startingOrder: 'ranked', quality: 'loose' }),
    variant('reversed-sections', 'reversedSections', n, {
      startingOrder: 'ranked',
      quality: 'reversedSections',
    }),
    // A wrong move every n/2 answers, left for the answers to correct...
    variant('wrong-moves', ['wrongMoves', 'cal-placement'], n, { extras: { wrongMoveEvery: half } }),
    // ...and corrected by another move n/10 answers later.
    variant('wrong-moves-corrected', ['wrongMoves', 'cal-placement'], n, {
      extras: { wrongMoveEvery: half, correctAfter: Math.max(1, Math.round(n / 10)) },
    }),
    // Several entries moved in a row, one placement each, every n answers.
    variant('multi-move', ['multiMove', 'cal-placement'], n, {
      extras: { multiMoveEvery: { answers: n, count: MULTI_MOVE_COUNT } },
    }),
    variant('marked', 'marked', n, { extras: { markShare: MARK_SHARE } }),
  ];
}

/**
 * `ci`: every scenario at n = 60. `full`: the base models and the pairs
 * variants at n = 100 and n = 400, the rest at n = 100.
 */
export function scenarios(size: 'ci' | 'full'): Scenario[] {
  if (size === 'ci') {
    return [
      ...baseSet(60),
      ...pairsSet(60),
      ...behaviourSet(60),
      // One member of the pairs family.
      ...calPairsSet(60, ['careful']).filter((s) => s.startingOrder === 'rough'),
      ...strongPairsSet(60),
      ...probeSet(60),
    ];
  }
  return [
    ...baseSet(100),
    ...baseSet(400),
    ...pairsSet(100),
    ...pairsSet(400),
    ...behaviourSet(100),
    ...calPairsSet(100),
    ...strongPairsSet(100),
    ...probeSet(100),
  ];
}
