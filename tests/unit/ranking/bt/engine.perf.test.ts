import { describe, expect, it } from 'vitest';

import { EngineSession, replay } from '@/lib/ranking/bt/engine';
import { benchmarkCorpus } from '@/tests/helpers/engineCorpus';
import { seededRandom } from '@/tests/helpers/random';
import type { EngineList, RankingEvent } from '@/types/rankingEvents';

/**
 * Engine timings at 1,000 items and 10,000 events (docs/ARCHITECTURE.md 6.5 speed gate,
 * unthrottled Node). Timing depends on the machine, so this runs only with
 * PERF=1: `PERF=1 npx vitest run tests/unit/ranking/bt/engine.perf.test.ts --silent=false`.
 */
const N = 1000;
const EVENTS = 10000;
const ROUNDS = 40;
const base = { listId: 'list-1', createdAt: '2026-10-17T12:00:00.000Z' };

/**
 * Answers drawn from hidden true strengths, so the fit looks like a real
 * history. A draw adds two terms, so a large drawShare gives the largest
 * evidence set 10,000 events can hold.
 */
function history(seed: number, drawShare: number, placements: number) {
  const random = seededRandom(seed);
  const ids = Array.from({ length: N }, (_, i) => `i${i}`);
  const truth = ids.map(() => 40 * random());
  let next = 0;
  const distinct = (count: number): number[] => {
    const slots: number[] = [];
    while (slots.length < count) {
      const slot = Math.floor(random() * N);
      if (!slots.includes(slot)) slots.push(slot);
    }
    return slots;
  };
  const strength = (slot: number): number => truth[slot] ?? 0;
  const answer = (): RankingEvent => {
    const id = `e${next++}`;
    const draw = random() < drawShare;
    const [a, b] = distinct(2) as [number, number];
    const aWins = random() < 1 / (1 + Math.exp(-(strength(a) - strength(b)) / Math.SQRT2));
    return {
      ...base,
      id,
      kind: 'pair',
      leftItemId: `i${a}`,
      rightItemId: `i${b}`,
      outcome: draw ? 'draw' : aWins ? 'left' : 'right',
    };
  };
  const placement = (): RankingEvent => {
    const [item, above, below] = distinct(3) as [number, number, number];
    return {
      ...base,
      id: `e${next++}`,
      kind: 'placement',
      itemId: `i${item}`,
      aboveItemId: `i${above}`,
      belowItemId: `i${below}`,
    };
  };
  const spacing = placements === 0 ? Infinity : Math.floor(EVENTS / placements);
  const events = Array.from({ length: EVENTS }, (_, e) =>
    e % spacing === spacing - 1 ? placement() : answer(),
  );
  const list: EngineList = { originalItemIds: ids, startingOrder: 'unordered', events };
  return { list, answer };
}

function report(label: string, times: number[]): void {
  const sorted = times.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? NaN;
  const max = sorted[sorted.length - 1] ?? NaN;
  process.stderr.write(
    `${label}: median ${median.toFixed(2)} ms, max ${max.toFixed(2)} ms over ${times.length}\n`,
  );
}

function warmAppendTimes(seed: number, drawShare: number): number[] {
  const { list, answer } = history(seed, drawShare, 0);
  const session = new EngineSession(list);
  const times: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const event = answer();
    const start = performance.now();
    session.append(event);
    times.push(performance.now() - start);
  }
  expect(session.state.eventCount).toBe(EVENTS + ROUNDS);
  return times;
}

describe.runIf(process.env.PERF === '1')('engine timing', () => {
  it('warm append of a pair (pair-heavy history)', () => {
    report('warm pair append', warmAppendTimes(21, 0));
  }, 120000);

  it('warm append on a history of 80% draws, the largest evidence set', () => {
    report('warm append (80% draws)', warmAppendTimes(22, 0.8));
  }, 120000);

  it('cold replay with 200 placements', () => {
    const { list } = history(23, 0.5, 200);
    const times: number[] = [];
    for (let r = 0; r < 3; r++) {
      const start = performance.now();
      replay(list);
      times.push(performance.now() - start);
    }
    report('cold replay', times);
    const start = performance.now();
    new EngineSession(list);
    report('new EngineSession', [performance.now() - start]);
  }, 120000);

  it('construction on the pairs corpus history, cold and from a snapshot of all of it', () => {
    const pairs = benchmarkCorpus().find(({ name }) => name === 'pairs');
    if (pairs === undefined) throw new Error('no pairs history');
    const cold: number[] = [];
    const fromSnapshot: number[] = [];
    let snapshot: unknown;
    for (let r = 0; r < 3; r++) {
      const start = performance.now();
      const session = new EngineSession(pairs.list);
      cold.push(performance.now() - start);
      snapshot = JSON.parse(JSON.stringify(session.exportSnapshot()));
    }
    for (let r = 0; r < 3; r++) {
      const start = performance.now();
      const session = new EngineSession(pairs.list, { snapshot });
      fromSnapshot.push(performance.now() - start);
      expect(session.lastRebuild.fromEvent).toBe(pairs.list.events.length);
    }
    report('pairs: new EngineSession (cold)', cold);
    report('pairs: new EngineSession (from snapshot)', fromSnapshot);
  }, 300000);
});
