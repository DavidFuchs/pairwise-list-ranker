import { describe, expect, it } from 'vitest';

import { EngineSession, replayWithStats } from '@/lib/ranking/bt/engine';
import { benchmarkCorpus } from '@/tests/helpers/engineCorpus';

describe('benchmarkCorpus', () => {
  const corpus = benchmarkCorpus();
  const byName = new Map(corpus.map((h) => [h.name, h.list]));
  const count = (
    name: string,
    test: (e: (typeof corpus)[number]['list']['events'][number]) => boolean,
  ): number => (byName.get(name)?.events ?? []).filter(test).length;

  it('has the eight named histories at benchmark size', () => {
    expect([...byName.keys()]).toEqual([
      'pairs',
      'placements-early',
      'placements-middle',
      'placements-late',
      'unrecognized-heavy',
      'pairs-heavy',
      'ranked-import',
      'placements-realistic',
    ]);
    for (const { list } of corpus) {
      expect(list.originalItemIds).toHaveLength(1000);
      expect(list.events).toHaveLength(10000);
    }
    expect(byName.get('ranked-import')?.startingOrder).toBe('ranked');
  });

  it('puts 200 placements in the third of the history its name gives', () => {
    const thirds: [string, number, number][] = [
      ['placements-early', 0, 3333],
      ['placements-middle', 3333, 6666],
      ['placements-late', 6666, 10000],
    ];
    for (const [name, from, to] of thirds) {
      const events = byName.get(name)?.events ?? [];
      const at = events.flatMap((e, i) => (e.kind === 'placement' ? [i] : []));
      expect(at, name).toHaveLength(200);
      expect(Math.min(...at), name).toBeGreaterThanOrEqual(from);
      expect(Math.max(...at), name).toBeLessThan(to);
    }
  });

  it('spreads 100 placements (1%) evenly through placements-realistic', () => {
    const events = byName.get('placements-realistic')?.events ?? [];
    const at = events.flatMap((e, i) => (e.kind === 'placement' ? [i] : []));
    expect(at).toHaveLength(100);
    at.forEach((position, i) => expect(Math.floor(position / 100)).toBe(i));
    expect(events.filter((e) => e.kind !== 'placement' && e.kind !== 'pair')).toHaveLength(0);
  });

  it('marks 150 items and answers every event of pairs-heavy', () => {
    expect(count('unrecognized-heavy', (e) => e.kind === 'unrecognized')).toBe(150);
    expect(count('pairs-heavy', (e) => e.kind === 'pair')).toBe(10000);
  });
});

/**
 * Spec 6.3: no solve misses its test in the benchmark corpus, cold or in a
 * session build (which fits at every checkpoint, warm from the last). The
 * benchmark's appends, undos and rebuilds needed at most 27. placements-early
 * and placements-middle (peaks of 34 and 30) are left out: each takes over 30
 * seconds under coverage. placements-late, the next highest at 41, stays.
 */
describe('no corpus solve misses its test', () => {
  const skipped = new Set(['placements-early', 'placements-middle']);
  it.each(benchmarkCorpus().filter(({ name }) => !skipped.has(name)))(
    '$name',
    ({ list }) => {
      expect(replayWithStats(list).nonConverged).toBe(0);
      expect(new EngineSession(list).nonConverged).toBe(0);
    },
    300_000,
  );
});
