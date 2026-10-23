import { describe, expect, it, vi } from 'vitest';

import { REPEAT_FACTOR } from '@/lib/ranking/bt/constants';
import { EngineSession } from '@/lib/ranking/bt/engine';
import * as picker from '@/lib/ranking/bt/picker';
import { parseOverrides, parsePicker } from '@/tests/sim/overrides';
import type { RankingEvent } from '@/types/rankingEvents';

/**
 * Checks that tests/sim/setup.ts's SIM_PICKER mock reaches the engine, so that
 * a run asking for the adjacent picker never quietly runs the real one. Run it
 * by hand, for example
 * `SIM_PICKER=adjacent npx vitest run --config vitest.sim.config.mts tests/sim/picker.sim.ts`;
 * with SIM_PICKER unset there is nothing to check and it is skipped.
 */
const chosen = process.env.SIM_PICKER;
const overrides = parseOverrides(process.env.SIM_OVERRIDES);

/**
 * A rough 20-item list after five answers, each between the items two places
 * apart from the top down, so that every other row has been answered and is
 * less uncertain. The real picker then asks rows 2 and 4, two places apart;
 * the adjacent picker can only ask neighbours.
 */
function alternatingSession(): EngineSession {
  const ids = Array.from({ length: 20 }, (_, k) => `i${k}`);
  const events: RankingEvent[] = [0, 4, 8, 12, 16].map((k, index) => ({
    id: `e${index}`,
    listId: 'sim-picker',
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    kind: 'pair',
    leftItemId: `i${k}`,
    rightItemId: `i${k + 2}`,
    outcome: 'left',
  }));
  return new EngineSession({ originalItemIds: ids, startingOrder: 'rough', events });
}

describe.skipIf(chosen === undefined)(`the SIM_PICKER mock (${chosen})`, () => {
  it.skipIf(parsePicker(chosen) !== 'adjacent')(
    "makes the engine's next question for a 20-item list an adjacent pair in displayed order",
    () => {
      const { ranked, uncertainty, nextPair } = alternatingSession().state;
      expect(nextPair).not.toBeNull();
      const [a, b] = nextPair!.map((id) => ranked.indexOf(id)) as [number, number];
      expect(b - a).toBe(1);
      // And it is the neighbours with the largest summed uncertainty, the first on a tie.
      const u = (p: number): number => uncertainty.get(ranked[p] as string) as number;
      let best = 0;
      for (let p = 1; p + 1 < ranked.length; p++) if (u(p) + u(p + 1) > u(best) + u(best + 1)) best = p;
      expect(a).toBe(best);
    },
  );

  it.skipIf(parsePicker(chosen) !== 'adjacent')('replaces the pair picker and leaves pairKey', async () => {
    const real = await vi.importActual<typeof import('@/lib/ranking/bt/picker')>('@/lib/ranking/bt/picker');
    expect(picker.pairKey).toBe(real.pairKey);
    expect(picker.pickPair).not.toBe(real.pickPair);
  });

  it.skipIf(parsePicker(chosen) !== 'adjacent' || !('REPEAT_FACTOR' in overrides))(
    'makes the adjacent picker read an overridden REPEAT_FACTOR',
    () => {
      expect(REPEAT_FACTOR).toBe(overrides.REPEAT_FACTOR);
      // Slots 10 and 11, shown once, sum to 2; slots 12 and 13 sum to just under or over 2 * REPEAT_FACTOR.
      const ask = (gap: number) => {
        const uncertainty = new Float64Array(14);
        uncertainty.set([1.9, 0.1, 0.01, 2 * REPEAT_FACTOR - 0.01 + gap], 10);
        const shown = new Map([[picker.pairKey(10, 11), 1]]);
        return picker.pickPair({
          order: [10, 11, 12, 13],
          strengths: new Float64Array(14),
          uncertainty,
          shown,
        });
      };
      expect(ask(-0.01)).toEqual([10, 11]);
      expect(ask(0.01)).toEqual([12, 13]);
    },
  );

  it.skipIf(parsePicker(chosen) !== 'current')('leaves the real picker in place', async () => {
    const real = await vi.importActual<typeof import('@/lib/ranking/bt/picker')>('@/lib/ranking/bt/picker');
    expect(picker.pickPair).toBe(real.pickPair);
    // The real picker asks two rows two places apart here.
    const { ranked, nextPair } = alternatingSession().state;
    expect(nextPair!.map((id) => ranked.indexOf(id))).toEqual([1, 3]);
  });
});
