import { EngineSession, replayWithStats } from '@/lib/ranking/bt/engine';
import { exportSnapshot } from '@/lib/ranking/bt/snapshot';
import { benchmarkCorpus } from '@/tests/helpers/engineCorpus';
import type { EngineList, RankingEvent } from '@/types/rankingEvents';

export type Measure =
  'cold' | 'warm-pair' | 'undo-last' | 'undo-second' | 'rebuild-before-checkpoint' | 'cold-from-snapshot';

export interface BenchRow {
  history: string;
  /** 'construct' is the session's build time, reported with no gate. */
  measure: Measure | 'construct';
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  /**
   * Solves that missed the solver's test during this row alone (docs/ARCHITECTURE.md 6.5). The
   * session's own counter is cumulative, so each row reports the difference
   * across its measure and 'construct' reports the build: no miss is counted twice.
   */
  nonConverged?: number;
  /** Placements and events in the history, so the gate can tell a realistic history from one with many placements. */
  placements?: number;
  events?: number;
  /** JSON size of the snapshot, in characters (all ASCII, so also bytes). 'cold-from-snapshot' only. */
  snapshotChars?: number;
  /** Undos in this row that restored the in-memory snapshot (of its samples). */
  fromSnapshot?: number;
}

declare global {
  interface Window {
    __benchResults?: BenchRow[];
  }
}

const COLD_RUNS = 3;
const PAIR_STEPS = 50;
const UNDO_STEPS = 20;
const REBUILD_RUNS = 5;
const SNAPSHOT_RUNS = 3;
const SNAPSHOT_TAIL = 200;

function summarize(history: string, measure: BenchRow['measure'], samples: number[]): BenchRow {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number): number =>
    sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] as number;
  const row = { history, measure, medianMs: at(0.5), p95Ms: at(0.95), maxMs: at(1) };
  console.log(
    `${history} ${measure}: median ${row.medianMs.toFixed(1)} p95 ${row.p95Ms.toFixed(1)} max ${row.maxMs.toFixed(1)} ms (n=${samples.length})`,
  );
  return row;
}

function time<T>(run: () => T): [T, number] {
  const start = performance.now();
  const result = run();
  return [result, performance.now() - start];
}

function runHistory(name: string, list: EngineList): BenchRow[] {
  const rows: BenchRow[] = [];
  const listId = list.events[0]?.listId ?? 'bench-list';
  let serial = 0;
  const stamp = () => ({ id: `bench-${serial++}`, listId, createdAt: '2026-10-17T12:00:00.000Z' });

  let coldMisses = 0;
  const cold = Array.from({ length: COLD_RUNS }, () => {
    const [stats, ms] = time(() => replayWithStats(list));
    coldMisses += stats.nonConverged;
    return ms;
  });
  const placements = list.events.filter((event) => event.kind === 'placement').length;
  const shape = { placements, events: list.events.length };
  rows.push({ ...summarize(name, 'cold', cold), ...shape, nonConverged: coldMisses });

  const [session, constructMs] = time(() => new EngineSession(list));
  // The session counter is cumulative; each row below takes its own difference.
  let counted = session.nonConverged;
  const misses = (): number => {
    const added = session.nonConverged - counted;
    counted = session.nonConverged;
    return added;
  };
  rows.push({ ...summarize(name, 'construct', [constructMs]), nonConverged: counted });
  const events: RankingEvent[] = [...list.events];

  const pair: number[] = [];
  for (let i = 0; i < PAIR_STEPS; i++) {
    const next = session.state.nextPair;
    if (!next) break;
    const event: RankingEvent = {
      ...stamp(),
      kind: 'pair',
      leftItemId: next[0],
      rightItemId: next[1],
      outcome: 'left',
    };
    pair.push(time(() => session.append(event))[1]);
    events.push(event);
  }
  rows.push({ ...summarize(name, 'warm-pair', pair), nonConverged: misses() });

  // Each round answers a pair (untimed) and undoes it, so the first undo is of
  // the last append and restores the in-memory snapshot. The second undo, straight
  // after, has no snapshot and rebuilds from a checkpoint.
  const undo: number[] = [];
  const undoSecond: number[] = [];
  let lastFromSnapshot = 0;
  let secondFromSnapshot = 0;
  for (let i = 0; i < UNDO_STEPS; i++) {
    const next = session.state.nextPair;
    if (!next) break;
    const event: RankingEvent = {
      ...stamp(),
      kind: 'pair',
      leftItemId: next[0],
      rightItemId: next[1],
      outcome: 'left',
    };
    session.append(event);
    undo.push(time(() => session.undo())[1]);
    if (session.lastRebuild.fromSnapshot) lastFromSnapshot++;
    undoSecond.push(time(() => session.undo())[1]);
    if (session.lastRebuild.fromSnapshot) secondFromSnapshot++;
    events.pop();
  }
  // The undo rounds' misses (their appends, undos and rebuilds) are counted once, on undo-last.
  rows.push({
    ...summarize(name, 'undo-last', undo),
    fromSnapshot: lastFromSnapshot,
    nonConverged: misses(),
  });
  rows.push({
    ...summarize(name, 'undo-second', undoSecond),
    fromSnapshot: secondFromSnapshot,
    nonConverged: 0,
  });

  // An edit is cold path: drop a middle event, then go back (untimed).
  const full: EngineList = { ...list, events };
  const edited: EngineList = {
    ...list,
    events: events.filter((_, index) => index !== Math.floor(events.length / 2)),
  };
  const rebuild: number[] = [];
  for (let i = 0; i < REBUILD_RUNS; i++) {
    rebuild.push(time(() => session.reset(edited))[1]);
    session.reset(full);
  }
  rows.push({ ...summarize(name, 'rebuild-before-checkpoint', rebuild), nonConverged: misses() });

  // Opening from a cached snapshot taken 200 events before the end. Building the
  // prefix session and stringifying its snapshot are outside the timed section;
  // the timed one parses the JSON and replays the full list from it.
  const prefix: EngineList = { ...list, events: list.events.slice(0, -SNAPSHOT_TAIL) };
  const prefixSession = new EngineSession(prefix);
  const json = JSON.stringify(exportSnapshot(prefixSession));
  let snapshotMisses = prefixSession.nonConverged;
  const fromSnapshot = Array.from({ length: SNAPSHOT_RUNS }, () => {
    const [stats, ms] = time(() => replayWithStats(list, { snapshot: JSON.parse(json) as unknown }));
    if (stats.fromEvent !== prefix.events.length) {
      throw new Error(`${name}: the snapshot was not accepted (started at event ${stats.fromEvent})`);
    }
    snapshotMisses += stats.nonConverged;
    return ms;
  });
  // nonConverged: the untimed prefix build plus the replays, none of them in any row above.
  rows.push({
    ...summarize(name, 'cold-from-snapshot', fromSnapshot),
    nonConverged: snapshotMisses,
    snapshotChars: json.length,
  });
  return rows;
}

function main(): void {
  const results: BenchRow[] = [];
  for (const { name, list } of benchmarkCorpus()) {
    console.log(`history ${name}: ${list.originalItemIds.length} items, ${list.events.length} events`);
    results.push(...runHistory(name, list));
  }
  window.__benchResults = results;
  console.log('done');
}

// Let the page paint before the long synchronous run starts.
setTimeout(main, 50);
