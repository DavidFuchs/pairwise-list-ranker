import { describe, expect, it } from 'vitest';

import { countAnswers } from '@/lib/state/counts';
import type { RankingEvent } from '@/types/rankingEvents';

describe('countAnswers', () => {
  it('answers count pair events, draws included', () => {
    const base = { id: 'e', listId: 'l', createdAt: '2026-01-01T00:00:00.000Z' };
    const events: RankingEvent[] = [
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      { ...base, kind: 'pair', leftItemId: 'c', rightItemId: 'd', outcome: 'right_strong' },
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'c', outcome: 'draw' },
      { ...base, kind: 'unrecognized', itemIds: ['e'] },
    ];

    expect(countAnswers(events)).toBe(3);
  });
});
