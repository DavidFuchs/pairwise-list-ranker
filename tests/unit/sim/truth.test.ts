import { describe, expect, it } from 'vitest';

import { seededRandom } from '@/tests/helpers/random';
import { makeWorld } from '@/tests/sim/truth';

const options = { n: 100, kind: 'uniform', startingOrder: 'ranked', quality: 'honest', seed: 7 } as const;

describe('makeWorld', () => {
  it('is deterministic for a seed', () => {
    const a = makeWorld(options);
    const b = makeWorld(options);
    expect(a.ids.map((id) => a.value(id))).toEqual(b.ids.map((id) => b.value(id)));
    const c = makeWorld({ ...options, seed: 8, startingOrder: 'unordered' });
    const d = makeWorld({ ...options, startingOrder: 'unordered' });
    expect(c.ids.map((id) => c.trueRank(id))).not.toEqual(d.ids.map((id) => d.trueRank(id)));
  });

  it('names items i0..i(n-1) with values on 0..1 and a strict rank', () => {
    const world = makeWorld(options);
    expect(world.ids).toHaveLength(100);
    expect(world.ids[0]).toBe('i0');
    const ranks = world.ids.map((id) => world.trueRank(id)).sort((x, y) => x - y);
    expect(ranks).toEqual(Array.from({ length: 100 }, (_, i) => i));
    for (const id of world.ids) {
      expect(world.value(id)).toBeGreaterThan(0);
      expect(world.value(id)).toBeLessThanOrEqual(1);
    }
  });

  it('gives tied items one value and a span wider than a place', () => {
    const world = makeWorld({ ...options, kind: 'tied' });
    const byValue = new Map<number, string[]>();
    for (const id of world.ids) byValue.set(world.value(id), [...(byValue.get(world.value(id)) ?? []), id]);
    const clusters = [...byValue.values()];
    expect(clusters.every((c) => c.length >= 2 && c.length <= 7)).toBe(true);
    const truth = world.truthOver(world.ids);
    for (const cluster of clusters) {
      const [lo, hi] = truth.span(cluster[0]!);
      expect(hi - lo + 1).toBe(cluster.length);
    }
  });

  it('puts a few large steps between many close items in gaps', () => {
    const world = makeWorld({ ...options, kind: 'gaps' });
    const values = world.ids.map((id) => world.value(id)).sort((x, y) => y - x);
    const steps = values.slice(1).map((v, i) => values[i]! - v);
    const median = [...steps].sort((x, y) => x - y)[Math.floor(steps.length / 2)]!;
    expect(steps.filter((s) => s > 10 * median).length).toBeGreaterThanOrEqual(3);
  });

  it('reverses each block of a reversedSections import', () => {
    const world = makeWorld({ ...options, quality: 'reversedSections' });
    const ranks = world.ids.slice(0, 20).map((id) => world.trueRank(id));
    expect(ranks).toEqual([...ranks].sort((x, y) => y - x));
    expect(world.trueRank('i20')).toBeGreaterThan(world.trueRank('i0'));
  });

  it('ranks only the subset in truthOver, with places from 1', () => {
    const world = makeWorld({ ...options, startingOrder: 'unordered' });
    const subset = ['i5', 'i50', 'i70', 'i99'];
    const truth = world.truthOver(subset);
    const places = subset.map((id) => truth.span(id)[0]).sort((x, y) => x - y);
    expect(places).toEqual([1, 2, 3, 4]);
    const best = [...subset].sort((x, y) => world.trueRank(x) - world.trueRank(y))[0]!;
    expect(truth.span(best)).toEqual([1, 1]);
  });
});

describe('World.drift', () => {
  const small = { n: 10, kind: 'uniform', startingOrder: 'unordered', quality: 'honest', seed: 3 } as const;

  it("gives the picked items one another's values, each a new one, and keeps the set of values", () => {
    const world = makeWorld(small);
    const before = new Map(world.ids.map((id) => [id, world.value(id)]));
    const picked = world.drift(0.2, 2, seededRandom(11));
    expect(picked).toHaveLength(2);
    for (const id of picked) expect(world.value(id), id).not.toBe(before.get(id));
    for (const id of world.ids.filter((id) => !picked.includes(id)))
      expect(world.value(id)).toBe(before.get(id));
    const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
    expect(sorted(world.ids.map((id) => world.value(id)))).toEqual(sorted([...before.values()]));
  });

  it('ranks by the new values', () => {
    const world = makeWorld(small);
    world.trueRank('i0');
    world.drift(0.5, 2, seededRandom(11));
    const byValue = [...world.ids].sort((a, b) => world.value(b) - world.value(a));
    expect(byValue.map((id) => world.trueRank(id))).toEqual(Array.from({ length: 10 }, (_, k) => k));
  });

  it('picks the same items for the same stream', () => {
    expect(makeWorld(small).drift(0.2, 2, seededRandom(5))).toEqual(
      makeWorld(small).drift(0.2, 2, seededRandom(5)),
    );
  });
});
