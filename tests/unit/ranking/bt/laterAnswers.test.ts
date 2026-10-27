import { describe, expect, it, vi } from 'vitest';

import { replay, type EngineState } from '@/lib/ranking/bt/engine';
import { pairChances } from '@/lib/ranking/bt/progress';
import trips from './fixtures/trips-summer-47.json';
import type { RankingEvent } from '@/types/rankingEvents';

// The rule on at the spec's example factor, whatever value ships.
vi.mock('@/lib/ranking/bt/constants', async (original) => ({
  ...(await original<typeof import('@/lib/ranking/bt/constants')>()),
  RECENCY_FACTOR: 0.5,
}));

const idOf = (label: string): string => {
  const entry = Object.entries(trips.labels).find(([, name]) => name === label);
  if (entry === undefined) throw new Error(`no item ${label}`);
  return entry[0];
};

/** The chance of the pair being the wrong way round, whichever way the engine shows it. */
function chanceOf(state: EngineState, a: string, b: string): number {
  const found = pairChances(state)?.find(
    (pair) => (pair.above === a && pair.below === b) || (pair.above === b && pair.below === a),
  );
  if (found === undefined) throw new Error('pair not walked');
  return found.chance;
}

describe('later answers count more (docs/ARCHITECTURE.md 6.1)', () => {
  it("the owner's trips session: Lisbon stays above Amalfi Coast, out of the 'could go either way' band", () => {
    const lisbon = idOf('Lisbon');
    const amalfi = idOf('Amalfi Coast');
    const state = replay({
      originalItemIds: trips.originalItemIds,
      startingOrder: 'unordered',
      events: trips.events as RankingEvent[],
    });
    expect(state.ranked.indexOf(lisbon)).toBeLessThan(state.ranked.indexOf(amalfi));
    expect(chanceOf(state, lisbon, amalfi)).toBeLessThan(0.2);
  });
});
