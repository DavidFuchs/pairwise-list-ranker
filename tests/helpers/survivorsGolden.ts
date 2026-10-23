import { EngineSession } from '@/lib/ranking/bt/engine';
import { drivenHistory, type CorpusHistory } from '@/tests/helpers/engineCorpus';
import type { UserModel } from '@/tests/helpers/simUser';
import type { EngineList, RankingEvent, StartingOrder } from '@/types/rankingEvents';

export interface GoldenRecord {
  name: string;
  list: EngineList;
  at: {
    events: number;
    ranked: string[];
    unrecognized: string[];
    nextPair: [string, string] | null;
    strengths: Record<string, number>;
    uncertainty: Record<string, number>;
  }[];
}

/** Histories of the event kinds the app still writes: pairs, single-target placements, unrecognized marks and removals. */
export function survivorHistories(): CorpusHistory[] {
  const mix = {
    removal: 0.04,
    placement: 0.06,
    unrecognized: 0.04,
  };
  const specs: { user: UserModel; order: StartingOrder }[] = [
    { user: 'careful', order: 'unordered' },
    { user: 'typical', order: 'unordered' },
    { user: 'fuzzy', order: 'unordered' },
    { user: 'sloppy', order: 'unordered' },
    { user: 'typical', order: 'rough' },
    { user: 'typical', order: 'ranked' },
    { user: 'careful', order: 'unordered' },
    { user: 'fuzzy', order: 'unordered' },
  ];
  return specs.map(({ user, order }, index) => {
    const seed = 201 + index;
    return {
      name: `survivor-${user}-${order}-${seed}`,
      list: drivenHistory({ n: 40, events: 200, seed, user, startingOrder: order, mix }),
    };
  });
}

/**
 * Translates an event as the fixture stores it to the current format: a
 * `membership` event that only removes becomes a `removal`, a placement with
 * a one-element `targets` array becomes the flat placement, and anything else
 * is taken as it is. The fixture never adds, restores or places several items
 * at once, so an event that does is refused rather than translated.
 */
export function toCurrentFormat(event: unknown): RankingEvent {
  const stored = event as {
    kind: string;
    added?: string[];
    removed?: string[];
    restored?: string[];
    targets?: unknown[];
  };
  if (stored.kind === 'placement' && stored.targets !== undefined) {
    const { targets, ...base } = stored;
    if (targets.length !== 1) throw new Error('A survivor history places one item at a time.');
    return { ...base, ...(targets[0] as object) } as unknown as RankingEvent;
  }
  if (stored.kind !== 'membership') return event as RankingEvent;
  const { added = [], removed = [], restored = [], ...base } = stored;
  if (added.length > 0 || restored.length > 0) throw new Error('A survivor history never adds or restores.');
  return { ...base, kind: 'removal', itemIds: removed } as unknown as RankingEvent;
}

export function recordGolden(histories: CorpusHistory[]): GoldenRecord[] {
  return histories.map(({ name, list }) => {
    const total = list.events.length;
    const snapshot = (events: number): GoldenRecord['at'][number] => {
      const session = new EngineSession({ ...list, events: [] });
      for (const event of list.events.slice(0, events)) session.append(event);
      const { ranked, unrecognized, nextPair, strengths, uncertainty } = session.state;
      return {
        events,
        ranked: [...ranked],
        unrecognized: [...unrecognized],
        nextPair: nextPair ? [nextPair[0], nextPair[1]] : null,
        strengths: Object.fromEntries(strengths),
        uncertainty: Object.fromEntries(uncertainty),
      };
    };
    // An empty history has one record; any other is recorded at its half and its end.
    const half = Math.floor(total / 2);
    return { name, list, at: half === total ? [snapshot(total)] : [snapshot(half), snapshot(total)] };
  });
}
