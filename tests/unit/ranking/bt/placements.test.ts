/**
 * Placements (docs/ARCHITECTURE.md 6.8): a drag or a keyboard move places one item. Every move
 * follows one rule, whichever route it came from.
 */
import { describe, expect, it } from 'vitest';

import { EngineSession, replay, replayWithStats } from '@/lib/ranking/bt/engine';
import { between } from '@/tests/helpers/between';
import { seededRandom } from '@/tests/helpers/random';
import type { EngineList, RankingEvent } from '@/types/rankingEvents';

const base = { listId: 'l', createdAt: '2026-10-18T00:00:00.000Z' };
let next = 0;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `i${i}`);

function answers(n: number, count: number, seed: number): RankingEvent[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const a = Math.floor(random() * n);
    let b = Math.floor(random() * n);
    if (b === a) b = (a + 1) % n;
    return {
      ...base,
      id: `p${next++}`,
      kind: 'pair',
      leftItemId: `i${a}`,
      rightItemId: `i${b}`,
      outcome: a < b ? 'left' : 'right',
    } as RankingEvent;
  });
}

interface Move {
  itemId: string;
  aboveItemId?: string;
  belowItemId?: string;
}

function placement(move: Move): RankingEvent {
  return { ...base, id: `m${next++}`, kind: 'placement', ...move };
}

const list = (events: RankingEvent[], n = 12): EngineList => ({
  originalItemIds: ids(n),
  startingOrder: 'unordered',
  events,
});

describe('a placement', () => {
  it('fits once', () => {
    const history = answers(12, 60, 1);
    const ranked = replay(list(history)).ranked;
    const without = replayWithStats(list(history));
    const placed = replayWithStats(
      list([...history, placement({ itemId: ranked[9]!, aboveItemId: ranked[1] })]),
    );
    // A cold replay fits once at the placement and once at the end.
    expect(placed.fits).toBe(without.fits + 1);
  });

  it('shows the placed item between its rows, and a later move can be anchored on it', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const history = answers(12, 50, seed);
      const ranked = replay(list(history)).ranked;
      const first: Move = { itemId: ranked[10]!, aboveItemId: ranked[2], belowItemId: ranked[3] };
      const afterFirst = replay(list([...history, placement(first)])).ranked;
      expect(between(afterFirst, first), `seed ${seed}: ${first.itemId}`).toBe(true);
      // The next move is made against the order the first one left.
      const second: Move = { itemId: ranked[11]!, aboveItemId: first.itemId, belowItemId: ranked[3] };
      const afterSecond = replay(list([...history, placement(first), placement(second)])).ranked;
      expect(between(afterSecond, second), `seed ${seed}: ${second.itemId}`).toBe(true);
      const third: Move = { itemId: ranked[0]!, aboveItemId: ranked[7] };
      const afterThird = replay(
        list([...history, placement(first), placement(second), placement(third)]),
      ).ranked;
      expect(between(afterThird, third), `seed ${seed}: ${third.itemId}`).toBe(true);
    }
  });

  it('is skipped when its item is unknown or removed, or no row is there to anchor it', () => {
    const history = answers(8, 30, 4);
    const ranked = replay(list(history, 8)).ranked;
    const removal: RankingEvent = {
      ...base,
      id: `r${next++}`,
      kind: 'removal',
      itemIds: [ranked[5]!],
    };
    const before = replay(list([...history, removal], 8));
    for (const move of [
      { itemId: 'nobody', aboveItemId: ranked[0] },
      { itemId: ranked[5]!, aboveItemId: ranked[0] },
      { itemId: ranked[6]!, aboveItemId: 'nobody' },
    ]) {
      const after = replay(list([...history, removal, placement(move)], 8));
      expect(after.ranked, move.itemId).toEqual(before.ranked);
      expect(after.priorSource, move.itemId).toEqual(before.priorSource);
    }
  });

  it('sets the placed item aside for both sides, so a warm session and a cold replay agree', () => {
    const history = answers(12, 80, 5);
    const ranked = replay(list(history)).ranked;
    for (const move of [
      placement({ itemId: ranked[0]!, aboveItemId: ranked[8] }),
      placement({ itemId: ranked[11]!, belowItemId: ranked[1] }),
    ]) {
      const session = new EngineSession(list(history));
      session.append(move);
      const cold = replay(list([...history, move]));
      expect(session.state.ranked).toEqual(cold.ranked);
      expect(session.state.priorSource.get((move as Move).itemId)).toBe('placement');
      session.undo();
      expect(session.state.ranked).toEqual(ranked);
    }
  });
});
