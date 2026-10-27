import { describe, expect, it } from 'vitest';

import { runScenario } from '@/tests/sim/driver';
import { scenarios } from '@/tests/sim/scenarios';

/** The docs/ARCHITECTURE.md 11 items every scenario set must cover between its scenarios. */
const SPEC_ITEMS = [
  'strongOften',
  'strongRarely',
  'strongInconsistent',
  'ties',
  'gaps',
  'looseImport',
  'reversedSections',
  'wrongMoves',
  'multiMove',
  'marked',
];

const BASE_MODELS = ['careful', 'typical', 'fuzzy', 'sloppy'] as const;
const STARTS = ['unordered', 'rough', 'ranked'] as const;

describe.each(['ci', 'full'] as const)("scenarios('%s')", (size) => {
  const set = scenarios(size);

  it('has unique names', () => {
    const names = set.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives the same names on every call', () => {
    expect(scenarios(size).map((s) => s.name)).toEqual(set.map((s) => s.name));
  });

  it('covers every docs/ARCHITECTURE.md 11 item in some scenario', () => {
    const covered = new Set(set.flatMap((s) => s.tags ?? []));
    for (const item of SPEC_ITEMS) expect(covered, item).toContain(item);
  });

  it('gives every scenario a tags array and a budget of 8n answers, the probe and drift scenarios aside', () => {
    for (const s of set) {
      expect(Array.isArray(s.tags), s.name).toBe(true);
      if (s.extras?.probeMoves || s.extras?.drift) continue;
      expect(s.budgetAnswers, s.name).toBe(8 * s.n);
    }
  });

  it('runs each probe scenario until a further 8n answers after its last probe', () => {
    const probing = set.filter((s) => s.extras?.probeMoves);
    expect(probing).toHaveLength(2);
    for (const s of probing) {
      const { every, count } = s.extras!.probeMoves!;
      expect(s.budgetAnswers, s.name).toBe(s.n + (count - 1) * every + 8 * s.n);
    }
  });

  it('has every base model in every starting order, asked pairs only', () => {
    for (const model of BASE_MODELS) {
      for (const start of STARTS) {
        const found = set.filter(
          (s) =>
            s.model === model &&
            s.startingOrder === start &&
            s.truth === 'uniform' &&
            s.quality === 'honest' &&
            s.strong === 'often' &&
            s.extras === undefined,
        );
        expect(found.length, `${model} ${start}`).toBeGreaterThan(0);
      }
    }
  });

  it('has the typical unordered pairs scenario', () => {
    const n = set[0]!.n;
    expect(set.some((s) => s.name === `typical-unordered-pairs-n${n}`)).toBe(true);
  });

  it('has no scenario that asks groups, nor a sort mode or group behaviour to set', () => {
    for (const s of set) {
      expect(s.name, s.name).not.toMatch(/groups|lazy|corrector/);
      expect(s, s.name).not.toHaveProperty('sortMode');
      expect(s, s.name).not.toHaveProperty('group');
      for (const tag of s.tags ?? [])
        expect(tag, s.name).not.toMatch(/^(cal-groups|cal-auto|lazy10|lazy30|corrector)$/);
    }
  });

  it('has no big-edit scenario and none that asks for an edit', () => {
    for (const s of set) {
      expect(s.name, s.name).not.toMatch(/edit/);
      expect(s.tags ?? [], s.name).not.toContain('bigEdit');
      expect(s.extras ?? {}, s.name).not.toHaveProperty('editEvery');
    }
  });
});

describe('scenario sizes', () => {
  it("uses n = 60 for every scenario in 'ci'", () => {
    const sizes = new Set(scenarios('ci').map((s) => s.n));
    expect(sizes).toEqual(new Set([60]));
    for (const s of scenarios('ci')) expect(s.n).toBeLessThanOrEqual(100);
  });

  it("has the 400-item scenarios the release gates are stated for in 'full'", () => {
    const set = scenarios('full');
    const names = set.map((s) => s.name);
    for (const name of ['typical-unordered-n400', 'typical-unordered-pairs-n400']) {
      expect(names, name).toContain(name);
    }
    expect(set.find((s) => s.name === 'typical-unordered-pairs-n400')).toMatchObject({
      n: 400,
      model: 'typical',
      startingOrder: 'unordered',
      budgetAnswers: 3200,
      tags: [],
    });
  });

  it("uses n = 100 and n = 400 for the base models in 'full', n = 100 for the rest", () => {
    const set = scenarios('full');
    for (const model of BASE_MODELS) {
      for (const start of STARTS) {
        const sizes = set
          .filter(
            (s) =>
              s.model === model &&
              s.startingOrder === start &&
              (s.tags ?? []).every((tag) => tag === 'strongOften' || tag === 'cal-pairs') &&
              s.extras === undefined &&
              s.truth === 'uniform' &&
              s.quality === 'honest',
          )
          .map((s) => s.n);
        expect(new Set(sizes), `${model} ${start}`).toEqual(new Set([100, 400]));
      }
    }
    // The drift scenarios also run on short lists, where repeated pairs are common.
    const tagged = set.filter(
      (s) => (s.tags ?? []).some((tag) => tag !== 'strongOften') && !s.tags?.includes('cal-recency'),
    );
    expect(tagged.filter((s) => s.n !== 100).map((s) => s.name)).toEqual([]);
  });

  it('puts the size in every name', () => {
    for (const size of ['ci', 'full'] as const) {
      for (const s of scenarios(size)) expect(s.name.endsWith(`-n${s.n}`), s.name).toBe(true);
    }
  });
});

const taggedWith = (tag: string) =>
  scenarios('full')
    .filter((s) => s.tags?.includes(tag))
    .map((s) => s.name);

describe('the calibration scenarios', () => {
  const full = scenarios('full');
  const names = full.map((s) => s.name);
  const ci = scenarios('ci');

  it('has the new families under stable names', () => {
    const expected: string[] = [];
    for (const model of BASE_MODELS) {
      for (const start of ['unordered', 'rough']) {
        expected.push(`${model}-${start}-pairs-n100`);
      }
    }
    for (const habit of ['often', 'rarely', 'inconsistent']) {
      expected.push(`typical-unordered-strong-${habit}-pairs-n100`);
    }
    expected.push('typical-unordered-probe-near-n100', 'typical-unordered-probe-far-n100');
    for (const name of expected) expect(names, name).toContain(name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the names the first baseline already ran', () => {
    for (const name of [
      'typical-unordered-n100',
      'typical-unordered-strong-rarely-n100',
      'typical-unordered-strong-inconsistent-n100',
      'typical-unordered-wrong-moves-n100',
      'typical-unordered-multi-move-n100',
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it('selects the expected number of scenarios with each calibration tag', () => {
    // The group-asking families are gone.
    expect(taggedWith('cal-groups')).toEqual([]);
    expect(taggedWith('cal-auto')).toEqual([]);
    // 4 models x 2 starts, pairs only.
    expect(taggedWith('cal-pairs')).toHaveLength(8);
    // The three "Much better" habits.
    expect(taggedWith('cal-strong')).toHaveLength(3);
    // The two probes, the two wrong-move scenarios and the multi-move one.
    expect(taggedWith('cal-placement')).toHaveLength(5);
  });

  it('puts the calibration tags on the scenarios the plan names', () => {
    expect(taggedWith('cal-pairs')).toEqual(
      expect.arrayContaining(['typical-unordered-pairs-n100', 'careful-rough-pairs-n100']),
    );
    expect(taggedWith('cal-placement')).toEqual(
      expect.arrayContaining([
        'typical-unordered-wrong-moves-n100',
        'typical-unordered-wrong-moves-corrected-n100',
        'typical-unordered-multi-move-n100',
        'typical-unordered-probe-near-n100',
        'typical-unordered-probe-far-n100',
      ]),
    );
  });

  it('gives every new scenario a budget of 8n answers, the probe and drift scenarios aside', () => {
    const calibration = full.filter(
      (s) =>
        (s.tags ?? []).some((tag) => tag.startsWith('cal-')) && !s.extras?.probeMoves && !s.extras?.drift,
    );
    expect(calibration.length).toBeGreaterThan(0);
    for (const s of calibration) expect(s.budgetAnswers, s.name).toBe(8 * s.n);
  });

  it('has the drift scenarios: 6, 12 and 100 items in full, 60 in ci, each 8n answers past the drift', () => {
    expect(taggedWith('cal-recency')).toEqual([
      'typical-unordered-drift-n6',
      'typical-unordered-drift-n12',
      'typical-unordered-drift-n100',
    ]);
    const expected: Record<string, number> = {
      'typical-unordered-drift-n6': 24,
      'typical-unordered-drift-n12': 48,
      'typical-unordered-drift-n100': 300,
      'typical-unordered-drift-n60': 180,
    };
    for (const s of [...full, ...ci].filter((x) => x.tags?.includes('cal-recency'))) {
      const at = expected[s.name];
      expect(at, s.name).toBeDefined();
      expect(s.extras?.drift, s.name).toEqual({ at, share: 0.2, minItems: 2 });
      expect(s.budgetAnswers, s.name).toBe((at as number) + 8 * s.n);
    }
    expect(ci.filter((s) => s.tags?.includes('cal-recency')).map((s) => s.name)).toEqual([
      'typical-unordered-drift-n60',
    ]);
  });

  it('has the three strong habits', () => {
    const strong = full.filter((s) => s.tags?.includes('cal-strong'));
    expect(strong.map((s) => s.strong).sort()).toEqual(['inconsistent', 'often', 'rarely']);
  });

  it('has the probe scenarios move six items, one every 25 answers', () => {
    for (const kind of ['near', 'far']) {
      const s = full.find((x) => x.name === `typical-unordered-probe-${kind}-n100`);
      expect(s?.extras?.probeMoves).toEqual({ every: 25, count: 6, kind });
    }
  });

  it("has a member of every new family in 'ci' at n = 60", () => {
    for (const tag of ['cal-pairs', 'cal-strong', 'cal-placement']) {
      expect(
        ci.some((s) => s.tags?.includes(tag)),
        tag,
      ).toBe(true);
    }
    expect(ci.filter((s) => s.tags?.includes('cal-strong'))).toHaveLength(3);
    expect(ci.filter((s) => s.name.includes('-probe-'))).toHaveLength(2);
    expect(ci.some((s) => s.name === 'careful-rough-pairs-n60')).toBe(true);
  });

  describe('the strong pairs scenarios', () => {
    const strongOutcomes = (habit: string): number => {
      const scenario = ci.find((s) => s.name === `typical-unordered-strong-${habit}-pairs-n60`);
      expect(scenario, habit).toBeDefined();
      let strong = 0;
      runScenario(scenario!, 1, ({ event }) => {
        if (event.kind === 'pair' && event.outcome.endsWith('_strong')) strong++;
      });
      return strong;
    };

    it('emit strong outcomes, rarely fewer than often', () => {
      const often = strongOutcomes('often');
      const rarely = strongOutcomes('rarely');
      expect(often).toBeGreaterThan(0);
      expect(rarely).toBeLessThan(often);
    }, 120000);

    it('emit some for the inconsistent habit', () => {
      expect(strongOutcomes('inconsistent')).toBeGreaterThan(0);
    }, 120000);
  });
});
