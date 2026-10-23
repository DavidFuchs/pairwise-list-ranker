import { bench, describe } from 'vitest';

import { EngineSession, replay } from '@/lib/ranking/bt/engine';
import { exportSnapshot } from '@/lib/ranking/bt/snapshot';
import { benchmarkCorpus } from '@/tests/helpers/engineCorpus';
import type { EngineList, RankingEvent } from '@/types/rankingEvents';

/**
 * Unthrottled Node timings on two corpus histories. Iteration counts are small
 * because each cold replay takes seconds. The gate itself is the throttled
 * browser run (`npm run bench:engine:browser`).
 */
const NAMES = ['pairs', 'placements-middle'];
const options = { iterations: 3, warmupIterations: 1, time: 0, warmupTime: 0 };

const corpus = benchmarkCorpus().filter((history) => NAMES.includes(history.name));

function pairEvent(session: EngineSession, serial: number, listId: string): RankingEvent {
  const next = session.state.nextPair as [string, string];
  return {
    id: `bench-${serial}`,
    listId,
    createdAt: '2026-10-17T12:00:00.000Z',
    kind: 'pair',
    leftItemId: next[0],
    rightItemId: next[1],
    outcome: 'left',
  };
}

for (const { name, list } of corpus) {
  const listId = list.events[0]?.listId ?? 'bench-list';
  const middle = Math.floor(list.events.length / 2);
  const prefix: EngineList = { ...list, events: list.events.slice(0, -200) };
  const snapshotJson = JSON.stringify(exportSnapshot(new EngineSession(prefix)));
  const edited: EngineList = { ...list, events: list.events.filter((_, i) => i !== middle) };
  let session = new EngineSession(list);
  let serial = 0;
  const fresh = () => void (session = new EngineSession(list));

  describe(name, () => {
    bench('cold replay', () => void replay(list), options);
    bench('warm pair append', () => void session.append(pairEvent(session, serial++, listId)), {
      ...options,
      iterations: 20,
      setup: fresh,
    });
    bench('undo last', () => void session.undo(), {
      ...options,
      iterations: 10,
      setup: () => {
        fresh();
        session.append(pairEvent(session, serial++, listId));
      },
    });
    bench('undo second in a row', () => void session.undo(), {
      ...options,
      iterations: 10,
      setup: () => {
        fresh();
        for (let i = 0; i < 20; i++) session.append(pairEvent(session, serial++, listId));
        session.undo();
      },
    });
    bench(
      'cold from snapshot',
      () => void replay(list, { snapshot: JSON.parse(snapshotJson) as unknown }),
      options,
    );
    bench(
      'rebuild before checkpoint',
      () => {
        session.reset(edited);
        session.reset(list);
      },
      { ...options, setup: fresh },
    );
  });
}
