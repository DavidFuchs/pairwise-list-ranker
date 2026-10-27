import { describe, expect, it } from 'vitest';

import {
  baseModelOf,
  compare,
  comparedScenarios,
  decide,
  formatDecision,
  parseGroups,
  scenarioGroupOf,
  type ResultFile,
} from '@/tests/sim/compare';
import type { MoveProbe, Sample, Trace } from '@/tests/sim/driver';

/** A sample with the two shares the compare tool reads; the other measures are fixed. */
function sample(answers: number, within5 = 1, within1 = 1): Sample {
  return {
    answers,
    changes: answers,
    asked: 'pairs',
    measures: { mean: 0, median: 0, worstDecile: 0, within5, within1, kendall: 1, top20: 1 },
  };
}

interface TraceSpec {
  gate: number | null;
  /** The last sample's answers: the budget, or less on an early stop. Default 800 (8n at n = 100). */
  last?: number;
  samples?: Sample[];
  probes?: MoveProbe[];
  probesSkipped?: number;
  /** The answers the gate is counted from (a drift scenario's drift point). */
  gateFrom?: number;
}

function trace(scenario: string, seed: number, spec: TraceSpec): Trace {
  return {
    scenario,
    seed,
    samples: spec.samples ?? [sample(0, 0.2, 0.05), sample(spec.last ?? 800)],
    answersToGate: spec.gate,
    probes: spec.probes ?? [],
    probesSkipped: spec.probesSkipped ?? 0,
    ...(spec.gateFrom === undefined ? {} : { gateFrom: spec.gateFrom }),
  };
}

/** A result file with seeds 1..k per scenario: a number is a gate, null a run that never reached it. */
function result(label: string, gates: Record<string, (number | null | TraceSpec)[]>): ResultFile {
  const runs = Object.entries(gates).map(([scenario, list]) => ({
    scenario,
    traces: list.map((g, k) => trace(scenario, k + 1, g === null || typeof g === 'number' ? { gate: g } : g)),
  }));
  const seedCount = Math.max(...Object.values(gates).map((list) => list.length));
  return {
    label,
    overrides: {},
    picker: 'current',
    seeds: Array.from({ length: seedCount }, (_, k) => k + 1),
    runs,
  };
}

const MODELS = ['careful', 'typical', 'fuzzy', 'sloppy'] as const;
const base = (model: string): string => `${model}-unordered-n100`;

/** Every base model's gate on three seeds, scaled per model by `factor` from 100, 120 and 140. */
function models(label: string, factor: (model: string) => number = () => 1, extra = {}): ResultFile {
  const gates: Record<string, number[]> = {};
  for (const model of MODELS) gates[base(model)] = [100, 120, 140].map((g) => g * factor(model));
  return result(label, { ...gates, ...extra });
}

const ALL = MODELS.map(base);

describe('baseModelOf', () => {
  it('names the model of a base scenario and of its groups and pairs variants', () => {
    expect(baseModelOf('careful-unordered-n100')).toBe('careful');
    expect(baseModelOf('sloppy-ranked-n400')).toBe('sloppy');
    expect(baseModelOf('fuzzy-rough-groups-n100')).toBe('fuzzy');
    expect(baseModelOf('typical-unordered-pairs-n60')).toBe('typical');
  });
  it('is null for the behaviour variants, which are guards', () => {
    for (const name of [
      'typical-unordered-corrector-n100',
      'typical-unordered-lazy30-n100',
      'typical-unordered-wrong-moves-n100',
      'typical-unordered-strong-often-pairs-n100',
      'typical-unordered-probe-near-n100',
    ]) {
      expect(baseModelOf(name)).toBeNull();
    }
  });
});

describe('compare', () => {
  it('pairs seeds by number, so the order of the traces does not matter', () => {
    const current = models('cur');
    const candidate = models('cand', (m) => (m === 'fuzzy' ? 0.9 : 1.05));
    const swapped: ResultFile = {
      ...candidate,
      seeds: [...candidate.seeds].reverse(),
      runs: candidate.runs.map((run) => ({ ...run, traces: [...run.traces].reverse() })),
    };
    const a = compare(current, candidate, ALL);
    const b = compare(current, swapped, ALL);
    expect(b.cells).toEqual(a.cells);
    expect(b.mean).toBeCloseTo(a.mean, 12);
    // Paired: 1.05x on every seed is +5%; unpaired means would agree here, so check a mismatched pair too.
    expect(a.byModel.get('careful')?.relativeChange).toBeCloseTo(0.05, 12);
    expect(a.byModel.get('fuzzy')?.relativeChange).toBeCloseTo(-0.1, 12);
  });

  it('compares each seed with the same seed, not the sorted values', () => {
    // Paired: seed 1 100 -> 140 (+40%), seed 2 140 -> 100 (-28.6%); an unpaired view would see no change.
    const current = result('cur', { [base('careful')]: [100, 140] });
    const candidate = result('cand', { [base('careful')]: [140, 100] });
    const cell = compare(current, candidate, [base('careful')]).cells[0]!;
    expect(cell.relativeChange).toBeCloseTo((0.4 + (100 - 140) / 140) / 2, 12);
  });

  it('notes seeds that are in one file only and leaves them out', () => {
    const current = result('cur', { [base('careful')]: [100, 100, 100] });
    const candidate = result('cand', { [base('careful')]: [110, 110] });
    const cell = compare(current, candidate, [base('careful')]).cells[0]!;
    expect(cell.pairedSeeds).toEqual([1, 2]);
    expect(cell.unpairedSeeds).toEqual([3]);
    expect(cell.relativeChange).toBeCloseTo(0.1, 12);
  });

  it('counts a null gate as the last sample and as censored', () => {
    const current = result('cur', { [base('careful')]: [100, 100] });
    const candidate = result('cand', { [base('careful')]: [null, { gate: null, last: 300 }] });
    const cell = compare(current, candidate, [base('careful')]).cells[0]!;
    expect(cell.meanGate).toBe((800 + 300) / 2);
    expect(cell.censored).toBe(2);
    expect(cell.currentCensored).toBe(0);
    expect(cell.currentMeanGate).toBe(100);
    expect(cell.relativeChange).toBeCloseTo((7 + 2) / 2, 12);
  });

  it('gives a 0 change when both gates are 0, and skips and notes a seed whose current gate is 0', () => {
    const current = result('cur', { 'careful-ranked-n100': [0, 0, 10] });
    const candidate = result('cand', { 'careful-ranked-n100': [0, 5, 11] });
    const cell = compare(current, candidate, ['careful-ranked-n100']).cells[0]!;
    expect(cell.skippedSeeds).toEqual([2]);
    expect(cell.relativeChange).toBeCloseTo((0 + 0.1) / 2, 12);
  });

  it('takes the mean over the base models, and keeps guards out of it while flagging them', () => {
    const guard = 'typical-unordered-corrector-n100';
    const current = models('cur', () => 1, { [guard]: [100, 100, 100] });
    const candidate = models('cand', () => 0.9, { [guard]: [130, 130, 130] });
    const out = compare(current, candidate, [...ALL, guard]);
    expect(out.mean).toBeCloseTo(-0.1, 12);
    expect([...out.byModel.keys()].sort()).toEqual([...MODELS].sort());
    expect(out.cells.find((c) => c.scenario === guard)?.model).toBeNull();
    expect(out.slowerGuards).toEqual([guard]);
    expect(out.slowerModels).toEqual([]);
  });

  it("averages a model's scenarios first, then the models", () => {
    // Typical has two scenarios (-10% and -30%), careful one (+10%): (-20% + 10%) / 2.
    const current = result('cur', {
      'typical-unordered-n100': [100],
      'typical-rough-n100': [100],
      'careful-unordered-n100': [100],
    });
    const candidate = result('cand', {
      'typical-unordered-n100': [90],
      'typical-rough-n100': [70],
      'careful-unordered-n100': [110],
    });
    const out = compare(current, candidate, [
      'typical-unordered-n100',
      'typical-rough-n100',
      'careful-unordered-n100',
    ]);
    expect(out.byModel.get('typical')?.relativeChange).toBeCloseTo(-0.2, 12);
    expect(out.mean).toBeCloseTo(-0.05, 12);
  });

  it('flags a model more than 10% slower', () => {
    const out = compare(
      models('cur'),
      models('cand', (m) => (m === 'sloppy' ? 1.12 : 0.8)),
      ALL,
    );
    expect(out.slowerModels).toEqual(['sloppy']);
  });

  it('takes the groups from a groupOf option', () => {
    const habits = ['often', 'rarely', 'inconsistent'];
    const names = habits.map((h) => `typical-unordered-strong-${h}-pairs-n100`);
    const groupOf = (s: string): string | null => /-strong-([a-z]+)-pairs-/.exec(s)?.[1] ?? null;
    const current = result('cur', Object.fromEntries(names.map((s) => [s, [300, 300]])));
    const candidate = result('cand', Object.fromEntries(names.map((s) => [s, [270, 270]])));
    const out = compare(current, candidate, names, { groupOf });
    expect([...out.byModel.keys()].sort()).toEqual(['inconsistent', 'often', 'rarely']);
    expect(out.mean).toBeCloseTo(-0.1, 12);
    expect(decide(current, [candidate], names, { groupOf }).chosen).toBe('cand');
  });

  it('names a scenario missing from either file', () => {
    const current = models('cur');
    expect(() => compare(current, models('cand'), [...ALL, 'typical-unordered-gaps-n100'])).toThrow(
      /typical-unordered-gaps-n100/,
    );
  });
});

describe('compare extras', () => {
  /** A probe; `later` gives its 4n and 8n displacements, and leaving it out gives a probe from a file older than those fields. */
  const probe = (
    kind: 'near' | 'far',
    after: number | null,
    later?: { after4n: number | null; after8n: number | null },
  ): MoveProbe => ({
    itemId: 'i1',
    atAnswer: 100,
    kind,
    displacementAtMove: kind === 'far' ? 0.4 : 0.01,
    displacementAfter2n: after,
    ...(later ? { displacementAfter4n: later.after4n, displacementAfter8n: later.after8n } : {}),
  });

  const unmeasured = { measured: 0, kept: 0, share: null, meanDisplacement: null };

  it('gives the share of near and far probes back within 5% after 2n, out of the probes with a number', () => {
    const near = 'typical-unordered-probe-near-n100';
    const far = 'typical-unordered-probe-far-n100';
    const current = result('cur', {
      [near]: [{ gate: 70, probes: [probe('near', 0.01), probe('near', 0.2), probe('near', null)] }],
      [far]: [{ gate: 70, probes: [probe('far', 0.05), probe('far', 0.3)], probesSkipped: 2 }],
    });
    const candidate = result('cand', {
      [near]: [{ gate: 70, probes: [probe('near', 0.01), probe('near', 0.02)] }],
      [far]: [{ gate: 70, probes: [probe('far', 0.4)], probesSkipped: 1 }],
    });
    const out = compare(current, candidate, [near, far]);
    expect(out.probes.current.near.made).toBe(3);
    expect(out.probes.current.near.after['2n']).toEqual({
      measured: 2,
      kept: 1,
      share: 0.5,
      meanDisplacement: expect.closeTo(0.105, 12),
    });
    expect(out.probes.current.far.made).toBe(2);
    expect(out.probes.current.far.after['2n']).toEqual({
      measured: 2,
      kept: 1,
      share: 0.5,
      meanDisplacement: expect.closeTo(0.175, 12),
    });
    expect(out.probes.current.skipped).toBe(2);
    expect(out.probes.candidate.near.after['2n'].share).toBe(1);
    expect(out.probes.candidate.far.after['2n'].share).toBe(0);
    expect(out.probes.candidate.skipped).toBe(1);
    // Per scenario too.
    expect(out.cells.find((c) => c.scenario === near)?.current.probes.near.after['2n'].share).toBe(0.5);
  });

  it('gives the shares after 4n and 8n by the same rule, each out of the probes measured at that horizon', () => {
    const far = 'typical-unordered-probe-far-n100';
    const file = result('cur', {
      [far]: [
        {
          gate: 70,
          probes: [
            probe('far', 0.3, { after4n: 0.04, after8n: 0.01 }),
            probe('far', 0.2, { after4n: 0.1, after8n: null }),
            probe('far', null, { after4n: null, after8n: null }),
          ],
        },
      ],
    });
    const shares = compare(file, file, [far]).probes.current.far;
    expect(shares.made).toBe(3);
    expect(shares.after['2n']).toEqual({ measured: 2, kept: 0, share: 0, meanDisplacement: 0.25 });
    expect(shares.after['4n']).toEqual({
      measured: 2,
      kept: 1,
      share: 0.5,
      meanDisplacement: expect.closeTo(0.07, 12),
    });
    expect(shares.after['8n']).toEqual({ measured: 1, kept: 1, share: 1, meanDisplacement: 0.01 });
  });

  it('treats the 4n and 8n displacements as not measured in a file older than those fields', () => {
    const near = 'typical-unordered-probe-near-n100';
    const file = result('old', { [near]: [{ gate: 70, probes: [probe('near', 0.01), probe('near', 0.2)] }] });
    const shares = compare(file, file, [near]).probes.current.near;
    expect(shares.made).toBe(2);
    expect(shares.after['2n'].measured).toBe(2);
    expect(shares.after['4n']).toEqual(unmeasured);
    expect(shares.after['8n']).toEqual(unmeasured);
  });

  it('has a null share when no probe has a number', () => {
    const out = compare(models('cur'), models('cand'), ALL);
    expect(out.probes.current.near).toEqual({
      made: 0,
      after: { '2n': unmeasured, '4n': unmeasured, '8n': unmeasured },
    });
  });

  it('writes the probes made, measured and kept at each horizon', () => {
    const far = 'typical-unordered-probe-far-n100';
    const current = result('cur', {
      [far]: [{ gate: 70, probes: [probe('far', 0.3, { after4n: 0.04, after8n: null })] }],
    });
    const candidate = result('cand', {
      [far]: [{ gate: 70, probes: [probe('far', 0.01, { after4n: 0.01, after8n: 0.02 })] }],
    });
    const text = formatDecision(
      decide(current, [candidate], [far], { groupOf: scenarioGroupOf }),
      current,
      '',
    );
    expect(text).toContain('| Horizon |');
    // made 1, measured 1, kept 0 after 2n for the current value; measured 0 after 8n.
    expect(text).toMatch(/\| current \| far \| 2n \| 1 \| 1 \| 0 \| 0\.00 \| 0\.300 \|/);
    expect(text).toMatch(/\| current \| far \| 4n \| 1 \| 1 \| 1 \| 1\.00 \| 0\.040 \|/);
    expect(text).toMatch(/\| current \| far \| 8n \| 1 \| 0 \| 0 \| n\/a \| n\/a \|/);
    expect(text).toMatch(/\| candidate \| far \| 8n \| 1 \| 1 \| 1 \| 1\.00 \| 0\.020 \|/);
  });

  it('gives the mean within5 and within1 at the last sample and at the samples nearest 4n and 8n', () => {
    const samples = (w: number): Sample[] => [
      sample(0, 0.1, 0),
      sample(375, 0.5, 0.2),
      sample(425, 0.6, 0.3 + w),
      sample(800, 0.9, 0.6 + w),
    ];
    const current = result('cur', {
      [base('careful')]: [
        { gate: 100, samples: samples(0) },
        { gate: 100, samples: samples(0.2) },
      ],
    });
    const out = compare(current, current, [base('careful')]);
    const stats = out.cells[0]!.current;
    expect(stats.last.within5).toBeCloseTo(0.9, 12);
    expect(stats.last.within1).toBeCloseTo(0.7, 12);
    // 375 and 425 are equally near 400: the earlier one counts.
    expect(stats.at4n?.within1).toBeCloseTo(0.2, 12);
    expect(stats.at8n?.within1).toBeCloseTo(0.7, 12);
  });

  it('has no 4n or 8n figure for a scenario name without -n<size>', () => {
    const current = result('cur', { 'custom-run': [10] });
    const cell = compare(current, current, ['custom-run']).cells[0]!;
    expect(cell.current.at4n).toBeNull();
    expect(cell.current.at8n).toBeNull();
  });
});

describe('decide', () => {
  it('rejects a candidate 12% slower on one model even when its mean is best', () => {
    const current = models('cur');
    const fast = models('fast', (m) => (m === 'careful' ? 1.12 : 0.7));
    const steady = models('steady', () => 0.95);
    const out = decide(current, [fast, steady], ALL);
    expect(compare(current, fast, ALL).mean).toBeLessThan(compare(current, steady, ALL).mean);
    expect(out.chosen).toBe('steady');
    expect(out.table.find((row) => row.label === 'fast')?.status).toBe('rejected');
  });

  it('rejects a candidate more than 10% slower on a guard', () => {
    const guard = 'typical-unordered-lazy30-n100';
    const current = models('cur', () => 1, { [guard]: [100, 100, 100] });
    const candidate = models('cand', () => 0.9, { [guard]: [111, 111, 111] });
    const out = decide(current, [candidate], [...ALL, guard]);
    expect(out.chosen).toBe('cur');
    expect(out.table[0]?.status).toBe('rejected');
  });

  it('does not choose a candidate better by only 1% of the mean', () => {
    const out = decide(models('cur'), [models('cand', () => 0.99)], ALL);
    expect(out.chosen).toBe('cur');
    expect(out.reason).toBe('no gain');
    expect(out.table[0]?.status).toBe('no gain');
  });

  it('chooses a candidate better by 5% on every model', () => {
    const out = decide(models('cur'), [models('cand', () => 0.95)], ALL);
    expect(out.chosen).toBe('cand');
    expect(out.table[0]?.status).toBe('chosen');
    expect(out.reason).not.toBe('no gain');
  });

  it('chooses the eligible candidate with the fewest answers', () => {
    const out = decide(models('cur'), [models('a', () => 0.95), models('b', () => 0.9)], ALL);
    expect(out.chosen).toBe('b');
    expect(out.table.map((row) => row.status)).toEqual(['eligible', 'chosen']);
  });

  it('makes a candidate whose win rests on more censored seeds than the current value ineligible', () => {
    // The candidate's careful seed 1 never reaches the gate but stops early at 40 answers, so it counts as 40.
    const current = models('cur');
    const gates: Record<string, (number | TraceSpec)[]> = {};
    for (const model of MODELS) gates[base(model)] = [100, 120, 140];
    gates[base('careful')] = [{ gate: null, last: 40 }, 120, 140];
    const candidate = result('cand', gates);
    const comparison = compare(current, candidate, ALL);
    expect(comparison.mean).toBeLessThan(-0.02);
    expect(comparison.censoredSeeds).toBe(1);
    expect(comparison.currentCensoredSeeds).toBe(0);
    const out = decide(current, [candidate], ALL);
    expect(out.chosen).toBe('cur');
    expect(out.table[0]?.status).toBe('ineligible');
  });

  it('keeps a candidate eligible when it has no more censored seeds than the current value', () => {
    const current = result('cur', Object.fromEntries(ALL.map((s) => [s, [null, 100]])));
    const candidate = result('cand', Object.fromEntries(ALL.map((s) => [s, [null, 80]])));
    expect(decide(current, [candidate], ALL).chosen).toBe('cand');
  });

  it('returns the current label with the reason "no gain" when no candidate qualifies', () => {
    const out = decide(
      models('cur'),
      [models('slow', () => 1.2), models('same'), models('tiny', () => 0.995)],
      ALL,
    );
    expect(out.chosen).toBe('cur');
    expect(out.reason).toBe('no gain');
  });

  it('keeps the current value when every compared scenario is a guard', () => {
    const guard = 'typical-unordered-probe-far-n100';
    const out = decide(result('cur', { [guard]: [100] }), [result('cand', { [guard]: [50] })], [guard]);
    expect(out.chosen).toBe('cur');
    expect(out.reason).toMatch(/guard/);
  });
});

describe('parseGroups', () => {
  it('groups by base model by default, or makes each scenario its own group', () => {
    expect(parseGroups(undefined)('careful-rough-n100')).toBe('careful');
    expect(parseGroups('')('typical-unordered-corrector-n100')).toBeNull();
    expect(parseGroups('model')('fuzzy-unordered-pairs-n100')).toBe('fuzzy');
    const habit = 'typical-unordered-strong-often-pairs-n100';
    expect(parseGroups('scenario')(habit)).toBe(habit);
  });
  it('names an unknown grouping', () => {
    expect(() => parseGroups('habit')).toThrow(/SIM_GROUPS.*habit/);
  });
});

describe('comparedScenarios', () => {
  const catalogue = [
    { name: 'typical-unordered-strong-often-pairs-n100', tags: ['cal-strong'] },
    { name: 'careful-unordered-n100', tags: ['cal-auto'] },
  ];
  it('selects by name or tag among the scenarios of the current file', () => {
    const names = ['careful-unordered-n100', 'typical-unordered-strong-often-pairs-n100', 'renamed-n100'];
    expect(comparedScenarios(names, /cal-strong/, catalogue)).toEqual([
      'typical-unordered-strong-often-pairs-n100',
    ]);
    expect(comparedScenarios(names, /renamed/, catalogue)).toEqual(['renamed-n100']);
    expect(comparedScenarios(names, undefined, catalogue)).toEqual(names);
  });
});

describe('formatDecision', () => {
  it('writes the decision, each candidate and the labels, with no em-dash', () => {
    const current = models('cur');
    const text = formatDecision(decide(current, [models('cand', () => 0.95)], ALL), current, 'cal-auto');
    expect(text).toContain('cur');
    expect(text).toContain('cand');
    expect(text).toContain('cal-auto');
    expect(text).toContain('careful-unordered-n100');
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  it('names the recency grouping in the header', () => {
    const current = models('cur');
    const text = formatDecision(decide(current, [models('cand')], ALL), current, '', 'recency');
    expect(text).toContain(
      'Groups: each drift scenario its own (the mean is over them; every other scenario is a guard).',
    );
  });
});

describe('a drift scenario that never reached its gate', () => {
  it('counts its answers from the drift, as a reached one is counted', () => {
    const name = 'typical-unordered-drift-n12';
    const current = result('cur', {
      [name]: [
        { gate: null, last: 144, gateFrom: 48 },
        { gate: 40, gateFrom: 48 },
      ],
    });
    const candidate = result('cand', {
      [name]: [
        { gate: 48, gateFrom: 48 },
        { gate: 40, gateFrom: 48 },
      ],
    });
    const decision = decide(current, [candidate], [name], { groupOf: parseGroups('recency') });
    const cell = decision.table[0]!.comparison.cells[0]!;
    expect(cell.currentMeanGate).toBe((96 + 40) / 2);
  });
});

describe("parseGroups('recency')", () => {
  it('makes each drift scenario its own group and every other a guard', () => {
    const groupOf = parseGroups('recency');
    expect(groupOf('typical-unordered-drift-n6')).toBe('typical-unordered-drift-n6');
    expect(groupOf('typical-unordered-drift-n100')).toBe('typical-unordered-drift-n100');
    expect(groupOf('typical-unordered-pairs-n100')).toBeNull();
  });
});
