import { describe, expect, it } from 'vitest';

import * as constants from '@/lib/ranking/bt/constants';
import { STRONG_WEIGHT } from '@/lib/ranking/bt/constants';
import { Evidence } from '@/lib/ranking/bt/evidence';
import { Timeline } from '@/lib/ranking/bt/timeline';
import { BT_CONSTANTS, parseOverrides } from '@/tests/sim/overrides';
import type { RankingEvent } from '@/types/rankingEvents';

/**
 * Checks that tests/sim/setup.ts's mocks reach the engine, so that a run with
 * SIM_OVERRIDES never quietly runs the defaults. Run it by hand with an
 * override, for example
 * `SIM_OVERRIDES='{"STRONG_WEIGHT":3}' npx vitest run --config vitest.sim.config.mts tests/sim/setup.sim.ts`;
 * with SIM_OVERRIDES unset there is nothing to check and it is skipped.
 */
const overrides = parseOverrides(process.env.SIM_OVERRIDES);

describe.skipIf(Object.keys(overrides).length === 0)('the SIM_OVERRIDES mocks', () => {
  it('give every overridden constant its value', () => {
    for (const name of BT_CONSTANTS) {
      if (name in overrides)
        expect((constants as Record<string, unknown>)[name], name).toEqual(overrides[name]);
    }
  });

  it.skipIf(!('STRONG_WEIGHT' in overrides))(
    'weigh a much better pair by STRONG_WEIGHT inside the engine',
    () => {
      expect(STRONG_WEIGHT).toBe(overrides.STRONG_WEIGHT);
      const ids = ['a', 'b'];
      const timeline = new Timeline(ids);
      const evidence = new Evidence();
      const event: RankingEvent = {
        id: 'p',
        listId: 'sim-setup',
        createdAt: '2026-10-19T12:00:00.000Z',
        kind: 'pair',
        leftItemId: 'a',
        rightItemId: 'b',
        outcome: 'left_strong',
      };
      timeline.apply(event, 0);
      evidence.add(event, 0, timeline);
      const [a, b] = ids.map((id) => timeline.slotOf(id));
      expect(evidence.activeTerms(timeline).pairs).toEqual([
        { winner: a, loser: b, weight: overrides.STRONG_WEIGHT, eventIndex: 0 },
      ]);
    },
  );
});
