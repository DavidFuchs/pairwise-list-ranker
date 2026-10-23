import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STRONG_GAP } from '@/tests/helpers/simUser';
import { makeBehaviour } from '@/tests/sim/behaviours';
import { makeWorld } from '@/tests/sim/truth';

const world = makeWorld({ n: 100, kind: 'uniform', startingOrder: 'ranked', quality: 'honest', seed: 3 });
const byTruth = [...world.ids].sort((a, b) => world.trueRank(a) - world.trueRank(b));
const make = (strong: Parameters<typeof makeBehaviour>[0]['strong'] = 'often', seed = 1) =>
  makeBehaviour({ model: 'careful', strong, seed, world });

describe('the behaviour', () => {
  it('answers pairs only: it has no group sorting', () => {
    const b = make() as unknown as Record<string, unknown>;
    expect(b.sortGroup).toBeUndefined();
    expect(typeof b.pair).toBe('function');
    expect(typeof b.wrongMove).toBe('function');
  });

  it('prefers the truly better item when the gap is wide', () => {
    expect(make('often').pair(byTruth[0]!, byTruth[90]!, false)).toBe('left_strong');
    expect(make('often').pair(byTruth[90]!, byTruth[0]!, false)).toBe('right_strong');
  });
});

describe('strong use', () => {
  const best = byTruth[0]!;
  const mid = byTruth[45]!; // a gap of about 0.45
  const far = byTruth[80]!; // a gap of about 0.8
  const isStrong = (outcome: string): boolean => outcome.endsWith('_strong');

  it('rarely gives no strong outcome for a gap between 0.3 and 0.6', () => {
    const b = make('rarely');
    for (let i = 0; i < 50; i++) expect(isStrong(b.pair(best, mid, false))).toBe(false);
  });

  it('often gives one for that gap, and rarely does for a gap over 0.6', () => {
    expect(isStrong(make('often').pair(best, mid, false))).toBe(true);
    expect(isStrong(make('rarely').pair(best, far, false))).toBe(true);
  });

  it('inconsistent gives a mix', () => {
    const b = make('inconsistent');
    const count = Array.from({ length: 200 }, () => isStrong(b.pair(best, far, false))).filter(
      Boolean,
    ).length;
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThan(160);
  });

  it('repeats for a seed', () => {
    const run = (): string[] => {
      const b = make('inconsistent', 9);
      return Array.from({ length: 30 }, () => b.pair(best, far, true));
    };
    expect(run()).toEqual(run());
  });
});

describe('answer-aligned draws', () => {
  // A fuzzy user (noise 0.04) on items 0.01 apart, so the answers really depend on the noise.
  const near = byTruth.slice(30, 35);
  const seeds = Array.from({ length: 40 }, (_, k) => k + 1);
  const fuzzy = (strong: 'often' | 'inconsistent', seed: number) =>
    makeBehaviour({ model: 'fuzzy', strong, seed, world });
  /** Earlier answers that use the random numbers differently: a clear pair, a draw-prone pair, a close pair. */
  const histories: ((b: ReturnType<typeof makeBehaviour>) => void)[] = [
    (b) => {
      b.pair(byTruth[0]!, byTruth[50]!, false);
      b.pair(byTruth[60]!, byTruth[61]!, true);
      b.pair(byTruth[70]!, byTruth[71]!, false);
    },
    (b) => {
      b.pair(byTruth[10]!, byTruth[11]!, false);
      b.pair(byTruth[80]!, byTruth[81]!, true);
      b.pair(byTruth[5]!, byTruth[6]!, false);
    },
    (b) => {
      b.pair(byTruth[40]!, byTruth[40]!, true); // the same item twice: a draw almost surely
      b.pair(byTruth[20]!, byTruth[21]!, true);
      b.pair(byTruth[22]!, byTruth[90]!, false);
    },
  ];

  /** The fourth answer of each seed after each history; the rows must be equal, and must vary by seed. */
  const fourth = <T>(
    make: (seed: number) => ReturnType<typeof makeBehaviour>,
    answer: (b: ReturnType<typeof makeBehaviour>) => T,
  ) =>
    histories.map((history) =>
      seeds.map((seed) => {
        const b = make(seed);
        history(b);
        return JSON.stringify(answer(b));
      }),
    );
  const expectAligned = (rows: string[][]) => {
    for (const row of rows.slice(1)) expect(row).toEqual(rows[0]);
    expect(new Set(rows[0]).size).toBeGreaterThan(1);
  };

  it('give the k-th pair the same answer whatever the earlier answers were', () => {
    expectAligned(
      fourth(
        (seed) => fuzzy('often', seed),
        (b) => b.pair(near[0]!, near[1]!, true),
      ),
    );
  });

  it('give the k-th inconsistent "much better" coin the same draw', () => {
    expectAligned(
      fourth(
        (seed) => fuzzy('inconsistent', seed),
        (b) => b.pair(byTruth[0]!, byTruth[90]!, false),
      ),
    );
  });

  it('keep wrong moves on their own count, apart from the answers', () => {
    const shown = byTruth.slice(0, 40);
    const a = make('often', 4);
    const b = make('often', 4);
    b.pair(byTruth[0]!, byTruth[1]!, true);
    b.pair(near[0]!, near[1]!, true);
    expect(b.wrongMove(shown)).toEqual(a.wrongMove(shown));
    // And an answer after a wrong move is the same answer as without it.
    const c = make('often', 4);
    const d = make('often', 4);
    d.wrongMove(shown);
    expect(d.pair(near[0]!, near[1]!, true)).toEqual(c.pair(near[0]!, near[1]!, true));
  });
});

describe('the "much better" threshold', () => {
  it("is simUser's STRONG_GAP, imported by behaviours.ts rather than mirrored", () => {
    expect(STRONG_GAP).toBe(0.3);
    const source = readFileSync(join(process.cwd(), 'tests', 'sim', 'behaviours.ts'), 'utf8');
    expect(source).toMatch(/import \{[^}]*\bSTRONG_GAP\b[^}]*\} from '@\/tests\/helpers\/simUser'/);
    expect(source).not.toMatch(/\b(const|let|var)\s+STRONG_GAP\b/);
  });
});

describe('wrongMove', () => {
  const shown = byTruth.slice(0, 40);

  it('moves an item to a place off its true place by more than 10% of the list', () => {
    const b = make();
    for (let i = 0; i < 30; i++) {
      const move = b.wrongMove(shown)!;
      expect(move).not.toBeNull();
      const others = shown.filter((id) => id !== move.itemId);
      const target = move.aboveItemId === undefined ? 0 : others.indexOf(move.aboveItemId) + 1;
      if (move.belowItemId !== undefined) expect(others.indexOf(move.belowItemId)).toBe(target);
      else expect(target).toBe(others.length);
      const truePlace = others.filter((o) => world.trueRank(o) < world.trueRank(move.itemId)).length;
      expect(Math.abs(target - truePlace)).toBeGreaterThan(0.1 * shown.length);
    }
  });

  it('returns null for lists under 10 items', () => {
    expect(make().wrongMove(byTruth.slice(0, 9))).toBeNull();
    expect(make().wrongMove(byTruth.slice(0, 10))).not.toBeNull();
  });
});
